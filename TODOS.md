# TODOS

## Phase 1 バックポート

### ~~run_id 統一~~ ✅ 完了 (2026-04-12)
- harness.ts が run_id を生成し DB に INSERT、agent-prompt.md に注入するように変更済み。

### Phase 1 テストスイート
- **What:** harness.ts、init-db.ts、eval.ts のユニットテスト (bun:test)
- **Why:** Phase 1 にテストが0件。リグレッション防止が必要。
- **Depends on:** なし

### Phase 1 テストrun実行
- **What:** harness.ts を実行して実際のrunデータを生成。ログの構造化度を確認。
- **Why:** ダッシュボード開発には実データが必要。ログパーサーの設計も実ログを見てから。
- **Depends on:** Crawl4AI Docker + Claude Code 認証が必要

## Phase 2 設計補足

### ~~lib/db.ts 共通化~~ ✅ 完了 (2026-04-12)
### ~~Dashboard stats 集約エンドポイント~~ ✅ 完了 (2026-04-12)
### ~~API JSON フィールドのパース~~ ✅ 完了 (2026-04-12)

---

## 要望リスト (次サイクルのフィードバック)

以下はユーザーからの要望。次の開発サイクルで検討・実装する候補。

### W-001: ダッシュボードからrunを実行キック
- **What:** ダッシュボードUI上のボタンからエージェントのrunを起動できるようにする
- **Why:** 現状は `bun run harness.ts` をターミナルで手動実行する必要がある。ダッシュボードから直接テスト実行できれば、UI上で「実行→結果確認→改善」のループが完結する。
- **検討事項:**
  - APIエンドポイント `POST /api/runs/start` を追加し、サーバー側でharness.tsを子プロセスとして起動
  - run中のリアルタイムステータス表示（ポーリング or SSE）
  - 同時実行の防止（既にrunning中なら起動不可）
  - タイムアウト・キャンセルのUI操作
- **影響範囲:** dashboard/server/routes/runs.ts、dashboard/client/pages/Runs.tsx、harness.ts（子プロセス起動対応）
- **Phase:** 読み取り専用→書き込み可能への転換点。Phase 3 (HITL) の入り口になる。
- **Depends on:** Phase 1テストrun実行（まず手動で動作確認してから）

### W-002: 蓄積データの保護（ノウハウ・事例の不変性保証）
- **What:** 機能追加・リファクタ時に、既に収集した事例データやエージェントのノウハウ（reflections、trust_score履歴）が壊れないことを保証する仕組み
- **Why:** このプロジェクトの価値の本体は「蓄積されたデータ」。コードは書き直せるがデータは取り戻せない。機能追加のたびにDBマイグレーションやスキーマ変更でデータが飛ぶリスクがある。
- **検討事項:**
  - DBマイグレーションの仕組み導入（init-db.tsの「CREATE IF NOT EXISTS」だけでは列追加・変更に対応できない）
  - データのバックアップ自動化（run前にDB snapshot）
  - casesテーブルの既存行は更新・削除不可のルール（append-only）
  - reflectionsも同様にimmutable
  - テストスイートにデータ整合性テスト追加（既存データが読めることを確認するスモークテスト）
- **影響範囲:** init-db.ts、harness.ts、dashboard全API
- **Depends on:** Phase 1テストスイート

### W-003: 事例からの考察・学び（インサイト生成）
- **What:** 収集した事例を単に一覧表示するだけでなく、「この事例から見える考察」「学べること」をエージェントが生成し、ダッシュボードに表示する
- **Why:** 事例の生データだけではYouTube/ブログのコンテンツにしにくい。「だからどうなのか」まで含めて提示することで、コンテンツ作成の効率が上がる。
- **検討事項:**
  - casesテーブルに `insights` カラム追加（エージェントが分類時に同時生成）
  - 複数事例の横断分析：「同じ業界で3社がRAGを導入→業界トレンドとして見える」
  - タグクラスタリング：同じタグの事例が増えてきたら「注目トレンド」としてダッシュボードに表示
  - Cases画面の展開詳細に「考察」セクション追加
  - agent-prompt.mdに「事例ごとにinsight（この事例から学べる1-2文）を生成する」ステップ追加
- **影響範囲:** agent-prompt.md（Step 5c追加）、init-db.ts（スキーマ拡張）、dashboard Cases画面
- **Depends on:** W-002（スキーマ変更の安全な仕組みが先）

### W-004: 評価指標のサジェスト & ユーザー承認フロー
- **What:** エージェントが自身の評価指標（分類基準、trust_score計算式、ソース選定戦略など）の改善をサジェストするが、勝手には変更しない。ダッシュボードからユーザーが承認して初めて適用される。
- **Why:** エージェントの自己改善は重要だが、「勝手に基準を変えて品質が下がった」は最悪のシナリオ。Human-in-the-loopの核心部分。
- **検討事項:**
  - **サジェスト生成:** エージェントがrun中のreflectionで「この基準を変えるべき」と気づいたら、`suggestions`テーブルに書き込む（直接agent-prompt.mdは変更しない）
  - **suggestionsテーブル設計:**
    ```sql
    CREATE TABLE suggestions (
      suggestion_id TEXT PRIMARY KEY,
      run_id TEXT REFERENCES runs(run_id),
      category TEXT,          -- 'classification', 'trust_score', 'source_strategy', 'tag_system'
      current_value TEXT,     -- 現在の設定値
      proposed_value TEXT,    -- 提案する変更
      reasoning TEXT,         -- なぜこの変更を提案するか
      evidence TEXT,          -- 根拠となるデータ（事例数、精度変化など）
      status TEXT DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
      decided_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    ```
  - **ダッシュボード表示:** 新しい「設定提案」ページ or Dashboard画面に通知バッジ
  - **承認フロー:** ユーザーがサジェストを確認→ Accept / Reject → Acceptした場合、次回runで適用
  - **適用メカニズム:** 承認済みサジェストをエージェントが次回run時に読み込み、行動に反映
  - **カテゴリ例:**
    - `classification`: 「Level Bの基準を厳しくすべき。現在Level Bに分類されているものの60%がLevel Cに近い」
    - `trust_score`: 「note.comのtrust_scoreをリセットすべき。最近3runで品質が改善している」
    - `source_strategy`: 「新しいソースを追加すべき: dev.toのAIタグ」
    - `tag_system`: 「新タグ"agent"を追加すべき。最近の事例の30%がエージェント関連」
- **影響範囲:** init-db.ts（suggestionsテーブル追加）、agent-prompt.md（サジェスト生成ステップ）、dashboard/server/routes/suggestions.ts（新規）、dashboard/client/pages/Suggestions.tsx（新規）
- **Phase:** Phase 3 (HITL) の中核機能。W-001（runキック）と組み合わせて「サジェスト確認→承認→runキック→結果確認」の完全ループが実現する。
- **Depends on:** W-001, W-002

### W-005: Ubuntuサーバーへのデプロイ & 自動実行 ⚡ 優先度高
- **What:** Ubuntuサーバー上でエージェントのcron自動実行 + ダッシュボードの常時起動を1コマンドでセットアップできるデプロイ構成を定義する
- **Why:** 現状はローカルで手動実行のみ。「寝ている間にエージェントが動いて、朝起きたらダッシュボードで結果確認」がこのプロジェクトの本来の姿。
- **検討事項:**
  - **セットアップスクリプト (`scripts/deploy.sh`):**
    - mise + bun インストール確認
    - Docker + docker compose 確認、Crawl4AI起動
    - `bun install` (dashboard依存)
    - `bun run init-db.ts`
    - `bun run build` (dashboard本番ビルド)
    - Claude Code CLI 認証確認 (`claude --version`)
    - systemd ユニットファイル生成
  - **systemd サービス (2つ):**
    - `usecase-agent.service`: ダッシュボードサーバー (`bun run dashboard/server/index.ts`) を常時起動。再起動ポリシー付き。
    - `usecase-agent.timer` + `usecase-agent-run.service`: harness.ts を定期実行（systemd timer。cronより管理しやすい）。
  - **実行スケジュール:**
    - デフォルト: 毎時0分 (`OnCalendar=*-*-* *:00:00`)
    - 設定可能にする（環境変数 or 設定ファイル）
  - **ログ管理:**
    - systemd journal に統合（`journalctl -u usecase-agent` で確認可能）
    - data/logs/ のrun別ログも従来通り保持
  - **ダッシュボードのアクセス:**
    - デフォルトは `localhost:3000` のみ
    - リバースプロキシ（nginx/caddy）設定はオプションで案内
  - **環境変数管理:**
    - `.env` ファイルから読み込み（ANTHROPIC_API_KEY等）
    - systemd の `EnvironmentFile=` ディレクティブで注入
  - **ヘルスチェック:**
    - ダッシュボードサーバーのヘルスエンドポイント `GET /api/health`
    - Crawl4AI Docker のヘルスチェック（既存の `docker compose ps`）
  - **想定ファイル構成:**
    ```
    scripts/
    ├── deploy.sh              # ワンショットセットアップ
    ├── usecase-agent.service   # ダッシュボード systemd
    ├── usecase-agent-run.service  # harness.ts 1回実行
    ├── usecase-agent-run.timer    # 定期実行スケジュール
    └── .env.example            # 環境変数テンプレート
    ```
- **影響範囲:** scripts/ (新規)、dashboard/server/index.ts (healthエンドポイント追加)、README.md (デプロイセクション更新)
- **Depends on:** Phase 1テストrun実行（実際に動くことの確認が先）

### W-006: 事例データへのスコアリング
- **What:** 収集した各事例（casesテーブル）に品質スコアを付与する仕組み。現在のLevel A/B/Cは粗い3段階分類だが、同じLevel A内でも「圧倒的に良い事例」と「ギリギリA」がある。この差を数値で表現する。
- **Why:** YouTube/ブログのコンテンツ選定で「Level Aの中から特に良いものを選ぶ」作業が発生する。スコアがあればソートするだけ。また、エージェントの分類精度の改善にもフィードバックとして使える。
- **検討事項:**
  - **スコアの軸（案）:**
    - `detail_score` (0-10): 技術的詳細度。アーキテクチャ図、コード例、設定値、メトリクスの有無
    - `novelty_score` (0-10): 新規性。既存事例との差分。「またRAGの話」vs「初めて見るアプローチ」
    - `actionability_score` (0-10): 実践可能度。読者が自分で再現できるか
    - `composite_score` (0-10): 総合スコア（上記の加重平均）
  - **スコアの生成タイミング:**
    - エージェントが分類時に同時生成（agent-prompt.md Step 5cに追加）
    - 既存事例には一括バッチで後付け可能にする
  - **スキーマ拡張:**
    ```sql
    ALTER TABLE cases ADD COLUMN detail_score REAL;
    ALTER TABLE cases ADD COLUMN novelty_score REAL;
    ALTER TABLE cases ADD COLUMN actionability_score REAL;
    ALTER TABLE cases ADD COLUMN composite_score REAL;
    ```
  - **ダッシュボード連携:**
    - Cases画面でcomposite_scoreでソート可能にする
    - スコアバー or 星表示で視覚化
    - 「コンテンツ候補 Top 10」ビュー（composite_score上位）
  - **W-003との関係:** インサイト生成（W-003）とスコアリング（W-006）は補完関係。スコアが高い事例のインサイトがコンテンツの素材になる。
  - **W-004との関係:** スコアリング基準自体もサジェスト対象にできる（「detail_scoreの重みを上げるべき」等）
- **影響範囲:** agent-prompt.md（Step 5c拡張）、init-db.ts（スキーマ拡張）、dashboard/server/routes/cases.ts（ソート追加）、dashboard/client/pages/Cases.tsx（スコア表示）
- **Depends on:** W-002（スキーマ変更の安全な仕組みが先）

### W-007: マルチエージェント並列実行
- **What:** harness.tsをパラメタ化して、複数テーマ（例: 生成AI、MLOps、データエンジニアリング）のエージェントを並列実行できるようにする
- **Why:** 1つのテーマだけでは収集範囲が限定される。複数テーマを並列で回すことで、「複数のリサーチャーが同時に動いている」状態を実現する。
- **検討事項:**
  - 各テーマが別のagent-prompt.mdと別のseeds.jsonを持つ
  - SQLite WALモードの同時書き込み制約（busy_timeout拡大が必要かも）
  - systemd templateユニット（`usecase-agent-run@.service`）でテーマをパラメータ化
  - ダッシュボードでテーマ別フィルタリング
- **影響範囲:** harness.ts（パラメータ化）、agent-prompt.md（テーマ別分離）、seeds.json（テーマ別分離）、systemd units
- **Phase:** Phase 1が安定運用に入ってから。W-005デプロイ後の次ステップ。
- **Depends on:** W-005（デプロイ基盤が先）
