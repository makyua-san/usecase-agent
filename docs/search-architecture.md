# 検索アーキテクチャ

エージェントが「何を」「どこから」「どうやって」検索しているかの全体像。
機能追加時にこのドキュメントを参照し、既存の検索フローを壊さないようにする。

## 検索の目的

「生成AIの実運用事例」を見つけること。市場レポートやイベント告知ではなく、
「誰が・何を・どうやって」の実践知見がある記事を優先的に収集する。

## 検索フロー全体像

```
┌─────────────────────────────────────────────────────────────┐
│ Step 2: 過去のReflectionを読む                               │
│   └─ 前回の学びを検索戦略に反映                              │
├─────────────────────────────────────────────────────────────┤
│ Step 3: ソース一覧を取得                                     │
│   └─ trust_score順、quarantine除外                           │
├─────────────────────────────────────────────────────────────┤
│ Step 4: next_plan.jsonを読む                                 │
│   └─ 前回の推奨事項を反映                                    │
├─────────────────────────────────────────────────────────────┤
│ Step 5: ソース巡回（上位3〜5件）                             │
│   ├─ 5b. ページ取得（Crawl4AI）                              │
│   │   └─ crawl_strategy_jsonに基づく                         │
│   ├─ 5c. 各記事の処理                                        │
│   │   ├─ 重複チェック（content_hash）                        │
│   │   ├─ 品質分類（Level A/B/C）                             │
│   │   ├─ タグ付け                                            │
│   │   └─ DB保存                                              │
│   └─ 5d. 新ソース発見                                        │
│       └─ trust_score 0.3で自動登録                           │
├─────────────────────────────────────────────────────────────┤
│ Step 6: Trust Score更新                                      │
│   └─ 検索結果の品質フィードバック                             │
├─────────────────────────────────────────────────────────────┤
│ Step 7: Reflection生成                                       │
│   └─ 次回の検索改善に使うメタ情報                             │
└─────────────────────────────────────────────────────────────┘
```

## ソース（どこから検索するか）

### ソースの定義

`sources` テーブルに登録されたWebサイト/API。各ソースが以下の属性を持つ:

| 属性 | 意味 | 検索への影響 |
|------|------|------------|
| `url` | 巡回の起点URL | ここからリンクを抽出する |
| `depth` | 探索深度 (1-3) | 1=リスト取得のみ、2=記事も取得、3=記事内リンクも辿る |
| `trust_score` | 信頼スコア (0.0-1.0) | 高いソースを優先巡回。低すぎると隔離 |
| `crawl_strategy_json` | 取得戦略 | セレクタ、URL パターン、取得数制限 |
| `quarantined_until` | 隔離期限 | この期間中は巡回をスキップ |

### 初期ソース (seeds.json)

| ソースID | URL | 種別 | 深度 | 特記事項 |
|---------|-----|------|------|---------|
| `hackernews_show_ai` | Algolia API (Show HN + AI) | API (JSON) | 2 | `$.hits[*]` でJSON解析 |
| `qiita_llm_genai` | qiita.com/tags/llm | HTML | 2 | `article a[href*='/items/']` |
| `zenn_genai` | zenn.dev/topics/generativeai | HTML | 2 | `article a[href*='/articles/']` |
| `note_genai` | note.com 検索 (生成AI) | HTML | 1 | アンチボット対策あり。depth 1のみ |
| `developersio_ai` | dev.classmethod.jp/tags/generative-ai/ | HTML | 2 | RSS フォールバックあり |

### ソースの追加・変更

- **自動登録:** エージェントが巡回中に良質なソースを発見 → `trust_score 0.3`, `depth 1` で登録
- **手動登録:** `seeds.json` に追加して `bun run init-db.ts`（空テーブル時のみシード）
- **隔離:** run_quality が 0.1 未満 → 24時間隔離 (`quarantined_until`)
- **復帰:** 隔離期限経過後、自動的に巡回対象に戻る

## crawl_strategy_json（どうやって取得するか）

各ソースの `crawl_strategy_json` がクロール戦略を定義する。

### 構造

```json
{
  "type": "html" | "api",
  "list_selector": "CSSセレクタ or JSONPath",
  "content_selector": "記事本文のセレクタ",
  "url_pattern": "正規表現（リンクフィルタ）",
  "max_links": 15,
  "wait_for": "DOMセレクタ（JS描画待ち）",
  "rss_url": "RSSフィードURL（フォールバック用）",
  "notes": "人間/エージェント向けメモ"
}
```

### フィールド詳細

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `type` | Yes | `"html"` = HTMLページをパース、`"api"` = JSONレスポンスをパース |
| `list_selector` | Yes | リンク一覧を抽出するセレクタ。HTML: CSSセレクタ、API: JSONPath |
| `content_selector` | No | 個別記事の本文を抽出するセレクタ。depth 2以上で使用 |
| `url_pattern` | Yes | 抽出したリンクをフィルタする正規表現。マッチするURLのみ処理 |
| `max_links` | Yes | 1回のrunで処理する最大リンク数 (10-30) |
| `wait_for` | No | JSレンダリング待ちのDOMセレクタ。SPAサイトで必要 |
| `rss_url` | No | HTMLパースが失敗した場合のRSSフォールバック |
| `notes` | No | ソース固有の注意事項（アンチボット、レート制限など） |

### 取得フロー

```
1. ソースのURLにアクセス（Crawl4AI Docker経由）
   │
   ├─ type="html" の場合:
   │   ├─ wait_for があれば JS描画を待つ
   │   ├─ list_selector でリンク一覧を抽出
   │   └─ url_pattern でフィルタ
   │
   └─ type="api" の場合:
       ├─ JSONレスポンスをパース
       ├─ list_selector (JSONPath) でデータ抽出
       └─ url_pattern でフィルタ
   │
2. フィルタ後のリンク（max_links件まで）について:
   │
   ├─ depth 1: リスト情報のみ（タイトル、URL）→ 分類・保存
   │
   └─ depth 2+: 個別ページにもアクセス
       ├─ content_selector で本文を抽出
       ├─ Markdown形式で保存 (data/raw/{run_id}/{case_id}.md)
       └─ 本文の内容も加味して分類
```

### 取得ツールチェーン

```
優先: Crawl4AI スキル (.claude/skills/crawl4ai/)
  │   Docker コンテナ経由で実行
  │   ポート: 11235
  │
  └─ フォールバック: Playwright MCP
      └─ Crawl4AI が利用不可の場合のみ
```

## 品質分類（何を採用するか）

### 判定基準

「誰が (who)」「何を (what)」「どうやって (how)」の3軸。2つ以上明確 → Level A。

```
                   who  what  how
Level A (実運用知見)  ✓    ✓    ✓   → 2/3以上が明確
Level B (事例概要)    ✓    ✓    ✗   → whoとwhatは見えるがhowが不明
Level C (シグナル)    ✗    △    ✗   → 具体的事例なし
```

### 分類後の処理の違い

| Level | DB保存 | 生コンテンツ保存 | タグ付け |
|-------|--------|----------------|---------|
| A | 全フィールド (who, what, how, summary, tags) | data/raw/ に Markdown | 2-5個 |
| B | メタデータ (title, url, level, tags) | data/raw/ に Markdown | 2-5個 |
| C | メタデータのみ (title, url, level) | なし | なし |

## 重複排除（同じものを二度取らない）

### content_hash の生成

エージェントがタイトル + ドメインから正規化したハッシュを生成。

```
content_hash = hash(normalize(title) + domain)
```

### チェックフロー

```
新しい記事を発見
  │
  ├─ content_hash を計算
  ├─ SELECT COUNT(*) FROM cases WHERE content_hash = ?
  │
  ├─ 0件 → 新規。分類・保存に進む
  └─ 1件以上 → 重複。[SKIPPED] をログに記録してスキップ
```

### 制約

- `cases` テーブルに `UNIQUE INDEX idx_cases_content_hash ON cases(content_hash)` が存在
- DB側でも重複INSERT時にエラーとなる安全弁

## 検索の最適化（どう賢くなるか）

### Trust Score の進化

各ソースの信頼度がrunを重ねるごとに更新される:

```
run_quality = (level_A_count * 3 + level_B_count * 2) / total_fetched
normalized  = min(run_quality / 5.0, 1.0)
new_score   = old_score * 0.7 + normalized * 0.3
```

- 良質な事例が多いソース → スコア上昇 → 巡回優先度が上がる
- ノイズが多いソース → スコア低下 → 0.1未満で24時間隔離

### Reflection による学習

各runの終了時にエージェントが自己評価を記録:

| フィールド | 内容 | 次runへの影響 |
|-----------|------|-------------|
| `what_worked` | 成功した戦略 | 次回も同じアプローチを継続 |
| `what_failed` | 失敗した点 | 次回は回避 |
| `source_evaluations_json` | ソース別のhit/noise | trust_score計算の入力 |
| `strategy_improvements` | 改善提案 | next_plan.jsonに反映 |
| `open_questions` | 未解決の疑問 | 次回の探索テーマ候補 |

### next_plan.json による戦略伝達

```
Run N の終了時:
  └─ next_plan.json を生成
      ├─ recommended_next_mode: Explore / Deepen / Maintain
      ├─ recommended_focus: ["注目トピック"]
      ├─ source_adjustments: [深度変更、優先度変更、隔離]
      └─ search_improvements: ["検索改善案"]

Run N+1 の開始時:
  └─ next_plan.json を読み込み
      └─ 戦略に反映
```

## タグ体系（何をインデックスするか）

3軸のタグで事例を分類:

| 軸 | 例 | 目的 |
|---|---|------|
| Industry（業界） | 製造業, 金融, 医療, EC, SaaS | 業界別トレンド分析 |
| Technology（技術） | LLM, RAG, fine-tuning, agent, vision | 技術別の普及状況 |
| Use case（用途） | カスタマーサポート, コード生成, 文書要約 | 実用途の把握 |

タグは `tags_json` カラムにJSON配列として保存: `["金融", "LLM", "RAG"]`

## 制約と設計判断

### なぜソース数を3-5件に制限するか

Claude Code headless の1回の実行で消費するコンテキスト量を制限するため。
各ソースのHTML/テキストが大きいため、5件を超えると1Mトークンの上限に近づく。

### なぜ depth 1 から始めるか

未知のソースのリスク管理。list取得だけなら:
- 取得データ量が小さい（リスト1ページ分のみ）
- ソースの品質が事前評価できる（タイトルだけで判断）
- アンチボット対策に引っかかりにくい

### なぜ note.com は depth 1 のみか

アンチボット対策が厳しい。depth 2 でリスト内の個別記事にアクセスすると
ブロックされるリスクが高い。タイトルとメタ情報のみで分類する。

### なぜ content_hash でタイトル+ドメインを使うか

同じ記事が複数ソースに出現するケース（Qiita→HN転載等）を検出するため。
URL単体では同じ記事の別URLを見逃す。

## ファイル参照マップ

検索に関わるコードの所在:

| ファイル | 検索における役割 |
|---------|----------------|
| `seeds.json` | 初期ソース定義（crawl_strategy_json含む） |
| `init-db.ts` | sourcesテーブルのスキーマ定義 + シード投入 |
| `agent-prompt.md` Step 3 | ソース一覧取得クエリ（trust_score順、quarantine除外） |
| `agent-prompt.md` Step 5b | crawl_strategy_jsonに基づくページ取得フロー |
| `agent-prompt.md` Step 5c | 重複チェック + 品質分類 + タグ付け |
| `agent-prompt.md` Step 5d | 新ソース自動発見・登録 |
| `agent-prompt.md` Step 6 | Trust Score更新の計算式 |
| `agent-prompt.md` 品質分類基準 | Level A/B/Cの判定ルールと具体例 |
| `agent-prompt.md` タグ付けルール | 3軸タグ体系の定義 |
| `.claude/skills/crawl4ai/` | 実際のWeb取得を行うCrawl4AIスキル |
| `docker-compose.yml` | Crawl4AI Dockerコンテナの定義 (port 11235) |
| `harness.ts` | run_id生成、DB登録、エージェント起動 |
| `lib/db.ts` | 共通DB接続（検索結果の保存先） |
| `eval.ts` | 分類精度の検証（10テストケース、目標>70%） |
