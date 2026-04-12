# gstackを自分のプロジェクトに合わせてカスタマイズした話

Claude Codeで自律型リサーチエージェントを作っている。生成AIのユースケース事例をWebから自動収集して、分類して、蓄積するやつ。

このプロジェクトでgstack（Claude Codeのスキルフレームワーク）を導入したら、設計レビューやQAテストが一気に楽になった。ただ、そのままでは動かない部分もあって、いくつかカスタマイズが必要だった。

同じようにgstackを使い始めて「あれ、ここ動かないな」となった人の参考になればと思い、やったことをまとめる。

---

## プロジェクトの構成

簡単に背景を説明すると、こういう構成のプロジェクト。

- Claude Code headless（非対話モード）をエージェントの「脳」として使う
- Crawl4AI（Docker）でWebページを取得
- SQLiteに事例データを蓄積
- エージェントが自分でソースの信頼度を評価して、次回の検索戦略を改善していく

ランタイムはBun + TypeScript。mise（旧asdf）でbun、node、pythonを管理している。

Windows 11上のGit Bash環境で開発。ここが後で効いてくる。

---

## gstackで何ができたか

gstackを入れると、Claude Codeのスキル（`/office-hours`、`/plan-eng-review`、`/qa` など）が使えるようになる。

このプロジェクトでは以下のスキルを実際に使った:

- `/office-hours` ... Phase 2ダッシュボードの設計ブレスト。6つの質問で要件を掘り下げ、3つの実装アプローチを比較、設計ドキュメントを自動生成
- `/plan-eng-review` ... アーキテクチャレビュー。run_idの不一致バグ、SQLite同時アクセスの注意点、パストラバーサル脆弱性など5件の問題を発見
- `/plan-design-review` ... デザインレビュー。カラーシステム、情報ヒエラルキー、インタラクション状態テーブルを設計ドキュメントに追加
- `/qa` ... ブラウザで実際に5画面を動作テスト、スクリーンショット付きで全画面正常確認
- `/document-release` ... README、CLAUDE.mdの自動更新

特に `/plan-eng-review` が強力で、run_idがharness.ts側（`run-{Date.now()}`）とagent-prompt.md側（`date +%Y%m%d_%H%M%S`）で食い違っているバグを発見してくれた。これに気づかないままダッシュボードを作っていたら、ログビューアーが動かないという最悪の結果になっていた。

---

## カスタマイズ1: codexラッパー（mise + Windows対応）

gstackの一部のスキル（`/office-hours`、`/plan-eng-review`など）は、セカンドオピニオンを得るためにOpenAIのCodex CLIを呼び出す機能がある。独立した別のAIに設計をレビューさせて、死角を見つけるためだ。

### 問題

mise経由でインストールしたcodexが、マルチラインの日本語プロンプトを渡すとエラーになる。

```
mise ERROR batch file arguments are invalid
```

### 原因

miseのshim（`~/.local/mise/shims/codex`）はBashスクリプトで、中身は:

```bash
#!/bin/bash
exec mise x -- codex "$@"
```

mise内部ではWindowsの `.cmd` バッチファイル経由でcodexの実体を起動する。バッチファイルの引数には改行が入れられない。

gstackのスキルは設計レビューのコンテキストをまるごとcodexに渡すので、プロンプトが数十行のマルチライン文字列になる。これがバッチファイルの引数制約に引っかかる。

### 解決策

`scripts/codex` にラッパースクリプトを作成:

```bash
#!/bin/bash
# codex wrapper: mise shim + Windows .cmd multiline argument bug fix

REAL_CODEX=$(mise which codex 2>/dev/null)
if [ -z "$REAL_CODEX" ]; then
  echo "ERROR: codex not found via mise" >&2
  exit 1
fi

if [ "$1" = "exec" ] && [ -n "$2" ]; then
  prompt="$2"
  shift 2

  if printf '%s' "$prompt" | grep -q $'\n'; then
    # マルチライン: stdin経由で渡す
    printf '%s' "$prompt" | "$REAL_CODEX" exec - "$@"
  else
    # シングルライン: そのまま渡す
    "$REAL_CODEX" exec "$prompt" "$@"
  fi
else
  "$REAL_CODEX" "$@"
fi
```

ポイント:

- `mise which codex` でmise shimを飛ばしてcodexの実体パスを取得
- プロンプトに改行が含まれていたら、引数ではなくstdin（`exec -`）経由で渡す
- シングルラインならそのまま通す（不要なオーバーヘッドを避ける）

### プロジェクトへの適用

CLAUDE.mdに以下を追記:

```markdown
## codex

This project uses a codex wrapper at `scripts/codex`.
When invoking codex, always prepend `scripts/` to PATH:

export PATH="$(git rev-parse --show-toplevel)/scripts:$PATH"
```

これでgstackスキルが `which codex` でパスを探すとき、miseのshimではなくラッパーが見つかる。スキルのコード自体を書き換える必要はない。

---

## カスタマイズ2: CLAUDE.mdでの言語制御

このプロジェクトは日本語ファーストで進めている。gstackのスキルは英語で書かれているので、何もしないとレビュー結果が英語で返ってくる。

CLAUDE.mdに以下を追記して解決:

```markdown
## Language

This project is Japanese-first.

- Always respond to the user in Japanese.
- Even when a skill, tool, prompt, or external documentation is written in English,
  keep the working conclusion and user-facing output in Japanese.
- Do not let the default language of a skill override this rule.
```

これだけで `/plan-eng-review` の指摘も `/qa` のレポートも全て日本語で出てくるようになる。CLAUDE.mdの指示はスキルのデフォルト動作より優先されるので、スキル側の変更は不要。

---

## カスタマイズ3: Crawl4AIスキルの統合

gstackにはブラウザ操作用の `/browse` スキルがあるが、このプロジェクトではWebクロールにCrawl4AI（Docker）を使っている。

ここで判断が必要だった: gstackの `/browse` とプロジェクト独自のCrawl4AIスキルをどう棲み分けるか。

結論:

- QAテストやサイト確認 → `/browse`（gstackのスキル）
- データ収集のためのWebクロール → `crawl4ai`（プロジェクト独自のスキル）

CLAUDE.mdに以下を追記して使い分けを明示:

```markdown
## gstack

For all web browsing, use the `/browse` skill from gstack.

## crawl4ai

For web crawling, scraping, markdown extraction, use the local
`crawl4ai` skill in `.claude/skills/crawl4ai/`.
Do not use Crawl4AI via MCP in this project.
```

---

## カスタマイズ4: スキルルーティング

gstackには「ユーザーのリクエストに応じて適切なスキルを自動起動する」ルーティング機能がある。最初に任意のスキルを実行すると、CLAUDE.mdにルーティングルールを追加するか聞いてくる。

追加すると、例えば:
- 「バグがある」と言えば → 自動で `/investigate` が起動
- 「テストして」と言えば → 自動で `/qa` が起動
- 「PRを作って」と言えば → 自動で `/ship` が起動

このプロジェクトでは独自のスキル（crawl4ai）も追加して、「Webクロールして」と言えばcrawl4aiが起動するようにした:

```markdown
## Skill routing

Key routing rules:
- Web crawling, scraping, markdown extraction → invoke crawl4ai
- Bugs, errors → invoke investigate
- QA, test the site → invoke qa
- Ship, deploy → invoke ship
...
```

---

## 学んだこと

### gstackのスキルはCLAUDE.mdで制御できる

スキルのソースコードを書き換えなくても、CLAUDE.mdの指示で動作をカスタマイズできる。言語、ツールの使い分け、ルーティング、全てCLAUDE.md経由で制御可能。これはgstackの設計が良くできている点。

### 環境依存の問題はラッパーで解決

mise + Windows + Git Bashという組み合わせは、ツールチェーンの繋ぎ目で問題が起きやすい。今回のcodexの件は典型的で、「引数の渡し方」というOS依存の問題だった。ラッパースクリプトで吸収するのが最も汎用性が高い解決策。

### セカンドオピニオン（outside voice）の価値

gstackの設計レビューでは、Claude以外のAI（Codex）にも同じ設計をレビューさせる。2つのAIが同じ問題を指摘したら信頼度が上がるし、片方だけが気づく死角もある。

このプロジェクトでは、run_idの不一致はClaude（エンジニアリングレビュー）が発見し、「Phase 1のデータが0件の状態でダッシュボードを作る意味があるか」はCodex（outside voice）が指摘した。両方あって初めて見えた全体像だった。

---

## まとめ

gstackは「入れて終わり」ではなく、プロジェクトに合わせてカスタマイズして初めて真価を発揮する。やることは主に4つ:

1. **環境依存の問題をラッパーで吸収する**（codex + mise + Windows）
2. **CLAUDE.mdで言語やツールの使い分けを明示する**
3. **プロジェクト独自のスキルとgstackのスキルを棲み分ける**
4. **スキルルーティングで自動起動を設定する**

どれもコード量は少ない（ラッパーは20行、CLAUDE.mdの追記は各5-10行）。それでプロジェクトの開発フローが大きく変わる。
