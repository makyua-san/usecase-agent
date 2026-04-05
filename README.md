# usecase-agent

生成AIのユースケースをWeb上から自律的に収集・整理するエージェント。

Claude Code の非対話モードをエージェントの「脳」として使い、Crawl4AI でページを取得し、品質分類・ソース評価・次回戦略の自動生成までを1回の run で完結させる。

## アーキテクチャ

```
┌─────────────┐
│ cron / 手動  │
└──────┬──────┘
       │ bun run harness.ts
       ▼
┌──────────────────────────────────────┐
│ harness.ts                           │
│  Docker healthcheck → init-db → CC   │
│  30分ハードタイムアウト              │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│ Claude Code headless                 │
│  agent-prompt.md の指示に従い:       │
│  ソース巡回 → 抽出 → 分類 → 保存    │
│  → reflection → next_plan.json      │
└──────┬───────────┬───────────┬───────┘
       ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌────────┐
│ Crawl4AI │ │ SQLite   │ │ data/  │
│ (Docker) │ │          │ │ logs/  │
│ MCP      │ │          │ │ raw/   │
└──────────┘ └──────────┘ └────────┘
```

- **harness.ts** ... CC の起動・タイムアウト・Docker 管理だけを担当する薄いラッパー
- **agent-prompt.md** ... エージェントの行動原則・分類基準・reflection ルールの全て
- **CLAUDE.md** ... プロジェクトコンテキスト（CC が自動読み込み）

## 必要環境

- Ubuntu 22.04+ (amd64)
- [mise](https://mise.jdx.dev/) ... ランタイム管理
- [Docker](https://docs.docker.com/engine/install/ubuntu/) + Docker Compose
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) ... 認証済み

## セットアップ

### 1. システム依存のインストール

```bash
# Docker (公式手順に従う)
# https://docs.docker.com/engine/install/ubuntu/

# mise
curl https://mise.jdx.dev/install.sh | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
source ~/.bashrc

# sqlite3 CLI (agent が DB 操作に使う)
sudo apt-get update && sudo apt-get install -y sqlite3
```

### 2. リポジトリのセットアップ

```bash
git clone <repo-url> usecase-agent
cd usecase-agent

# bun を mise 経由でインストール
mise install

# Claude Code CLI のインストールと認証
npm install -g @anthropic-ai/claude-code
claude login
```

### 3. データディレクトリの作成と DB 初期化

```bash
mkdir -p data/raw data/logs data/plans

# SQLite スキーマ作成 + 初期ソース投入
bun run init-db.ts
```

確認:

```bash
sqlite3 data/usecase.db ".tables"
# → cases  reflections  runs  source_scores  sources  tasks

sqlite3 data/usecase.db "SELECT name, depth, trust_score FROM sources"
# → 5件のソースが表示される
```

### 4. Crawl4AI の起動

```bash
docker compose up -d

# ヘルスチェック
curl -s http://localhost:11235/health || echo "まだ起動中..."
# 初回はイメージの pull に数分かかる
```

### 5. MCP サーバーの準備

`.claude/mcp.json` に Crawl4AI MCP と Playwright MCP を設定済み。
依存パッケージのインストール:

```bash
# Crawl4AI MCP (Python/uvx 経由)
pip install uvx crawl4ai-mcp

# Playwright MCP (Node 経由)
npx @anthropic-ai/mcp-playwright
```

> MCP の設定は `.claude/mcp.json` を参照。Crawl4AI MCP が動かない場合、Playwright MCP にフォールバックする設計。

## 使い方

### 手動で 1 回実行

```bash
bun run harness.ts
```

ログは `data/logs/run-{timestamp}.log` に出力される。

### 品質分類の eval

agent-prompt.md の分類精度を測定する。10件の既知記事で正答率を確認:

```bash
bun run eval.ts
```

目標: 70% 以上。下回る場合は agent-prompt.md の分類基準や例を調整する。

### 定期実行 (cron)

```bash
# 毎時0分に実行
crontab -e
```

```cron
0 * * * * cd /path/to/usecase-agent && /home/<user>/.local/share/mise/installs/bun/latest/bin/bun run harness.ts >> data/logs/cron.log 2>&1
```

> cron 環境では mise の PATH が通らないため bun のフルパスを指定する。
> `mise where bun` でパスを確認できる。

### 結果の確認

```bash
# 収集済みユースケース一覧
sqlite3 data/usecase.db "SELECT level, title FROM cases ORDER BY created_at DESC LIMIT 20"

# ソース別の信頼スコア
sqlite3 data/usecase.db "SELECT name, trust_score FROM sources ORDER BY trust_score DESC"

# 最新の reflection
sqlite3 data/usecase.db "SELECT what_worked, what_failed FROM reflections ORDER BY reflection_id DESC LIMIT 1"

# 次回プラン
cat data/plans/$(ls -t data/plans/ | head -1)
```

## ファイル構成

```
usecase-agent/
├── CLAUDE.md              プロジェクトコンテキスト (CC 自動読み込み)
├── agent-prompt.md        エージェントの行動指示 (--prompt で渡す)
├── harness.ts             CC headless の起動・管理
├── init-db.ts             SQLite スキーマ初期化 + シード
├── eval.ts                品質分類の精度測定
├── seeds.json             初期ソース定義 (5件)
├── docker-compose.yml     Crawl4AI Docker
├── .claude/mcp.json       MCP サーバー設定
├── requirements.md        設計要件書
└── data/                  (gitignore)
    ├── usecase.db         SQLite データベース
    ├── raw/               取得した生テキスト
    ├── logs/              run ごとのログ
    └── plans/             next_plan.json の履歴
```

## SQLite スキーマ

| テーブル | 用途 |
|---------|------|
| runs | run の実行履歴 (開始・終了・ステータス) |
| sources | 巡回対象ソース (URL・深度・信頼スコア・巡回戦略) |
| cases | 収集したユースケース (タイトル・分類・タグ・要約) |
| reflections | run 終了時の振り返り (成功・失敗・改善案) |
| source_scores | ソースごとの run 別評価 (ヒット率・ノイズ率) |
| tasks | 未処理タスク (将来のマルチエージェント用) |

## エージェントの成長ループ

```
run N                         run N+1
  │                             │
  ├─ ソース巡回                  ├─ 前回の reflection を読む
  ├─ 品質分類                    ├─ trust_score に基づきソース順序変更
  ├─ reflection 生成             ├─ 前回の失敗を避ける戦略調整
  ├─ trust_score 更新            ├─ 新ソースを自動発見・登録
  └─ next_plan.json 出力        └─ ...
```

run を重ねるごとに、良いソースが上位に来て、ノイズの多いソースは quarantine される。

## トラブルシューティング

### Crawl4AI が起動しない

```bash
docker compose logs crawl4ai
# メモリ不足の場合は docker-compose.yml の memory limit を調整
```

### CC headless が認証エラー

```bash
claude login
# API キーの有効期限を確認
```

### sqlite3 が見つからない

```bash
sudo apt-get install -y sqlite3
```

### cron で bun が見つからない

```bash
# bun のフルパスを確認
mise where bun
# → /home/<user>/.local/share/mise/installs/bun/latest

# crontab にフルパスを指定
```

### run がタイムアウトする

harness.ts の `HARD_TIMEOUT_MS` を調整するか、agent-prompt.md のソース数制限 (3-5) を減らす。

## ライセンス

MIT
