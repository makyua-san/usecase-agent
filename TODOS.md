# TODOS

## Phase 1 バックポート

### run_id 統一 (CRITICAL - Phase 2 の前提条件)
- **What:** harness.ts が run_id を生成し、runsテーブルにINSERT、agent-prompt.md の環境変数として注入。agent-prompt.md の Step 1 から run_id 生成を削除。
- **Why:** 現状 harness.ts (`run-{Date.now()}`) と agent-prompt.md (`date +%Y%m%d_%H%M%S`) で run_id が異なる。DB の run_id からログファイルを見つけられない。
- **Depends on:** なし

### Phase 1 テストスイート
- **What:** harness.ts、init-db.ts、eval.ts のユニットテスト (bun:test)
- **Why:** Phase 1 にテストが0件。run_id統一のバックポート後、リグレッション防止が必要。
- **Depends on:** run_id 統一完了後

### Phase 1 テストrun実行
- **What:** harness.ts を実行して実際のrunデータを生成。ログの構造化度を確認。
- **Why:** ダッシュボード開発には実データが必要。ログパーサーの設計も実ログを見てから。
- **Depends on:** run_id 統一完了後、Crawl4AI Docker + Claude Code 認証が必要

## Phase 2 設計補足

### lib/db.ts 共通化
- **What:** プロジェクトルートに lib/db.ts を作成。DB接続 (パス解決、PRAGMA WAL、busy_timeout=5000) を共通化。init-db.ts と dashboard/server/ の両方から使う。
- **Why:** DRY。DB接続パターンの重複を防止。
- **Depends on:** なし

### Dashboard stats 集約エンドポイント
- **What:** GET /api/dashboard/stats を追加。総ケース数、Level分布、アクティブソース数、最新run、Top/Bottomソース、最新reflectionを1レスポンスで返す。
- **Why:** Dashboard画面の6つの集計クエリを1リクエストに集約。
- **Depends on:** API サーバー実装

### API JSON フィールドのパース
- **What:** tags_json、source_evaluations_json、crawl_strategy_json をAPI側でパースしてオブジェクト/配列として返す。
- **Why:** フロントエンドの毎回 JSON.parse() を排除。
- **Depends on:** API サーバー実装
