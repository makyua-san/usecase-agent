# CLAUDE.md

## Project overview

生成AIの実運用事例を自律的に収集・分類するリサーチエージェント。
Claude Code を headless モードで動かし、Crawl4AI (Docker) でWebページを取得、SQLite に結果を蓄積する。

### Tech stack

- **Runtime:** Bun (TypeScript)
- **AI Agent:** Claude Code CLI (`claude --print`)
- **Web Crawling:** Crawl4AI (Docker, port 11235)
- **Database:** SQLite (WAL mode) — `data/usecase.db`
- **Tool Manager:** mise (bun, node, python)

### Key files

| File | Role |
|------|------|
| `harness.ts` | オーケストレーション: Docker確認、run_id生成・DB登録、CC起動、30分タイムアウト、ログ管理 |
| `agent-prompt.md` | エージェント行動指示 (9ステップワークフロー、分類ルール、タグ体系) |
| `init-db.ts` | SQLite スキーマ初期化 + シードデータ投入 (冪等) |
| `lib/db.ts` | 共通DB接続 (パス解決、PRAGMA WAL、busy_timeout) |
| `eval.ts` | 品質分類の精度測定 (10テストケース、目標 >70%) |
| `seeds.json` | 初期ソース定義 (Hacker News, Qiita, Zenn, note.com, DevelopersIO) |
| `dashboard/` | 管制塔ダッシュボード (Hono API + React SPA) |
| `TODOS.md` | 要望リスト・タスク管理 |

### Commands

```bash
# セットアップ
mise install
mkdir -p data/raw data/logs data/plans
bun run init-db.ts
docker compose up -d

# 実行
bun run harness.ts          # 単発実行
bun run eval.ts             # 分類精度テスト

# ダッシュボード
cd dashboard && bun install  # 初回のみ
bun run build                # フロントエンドビルド
bun run start                # http://localhost:3000
bun run dev                  # 開発モード (Vite HMR + API)

# 確認
sqlite3 data/usecase.db "SELECT level, title FROM cases ORDER BY created_at DESC LIMIT 20"
```

### Classification levels

- **A:** 実運用知見あり (who + what + how のうち2つ以上が明確) → markdown保存
- **B:** 事例は見えるが詳細不足 → メタデータのみ
- **C:** シグナルのみ (ニュース・イベント) → メタデータのみ

### Data directories (gitignored)

- `data/usecase.db` — SQLite DB
- `data/raw/` — Level A/B のmarkdownエクスポート
- `data/logs/` — 実行ログ
- `data/plans/` — next_plan.json 履歴

## Language

This project is Japanese-first.

- Always respond to the user in Japanese.
- Always write summaries, plans, progress updates, review comments, and final responses in Japanese.
- Even when a skill, tool, prompt, or external documentation is written in English, keep the working conclusion and user-facing output in Japanese.
- Do not let the default language of a skill override this rule. If a skill assumes English, use the skill internally but translate/adapt the result into natural Japanese before presenting it.

## gstack

For all web browsing, use the `/browse` skill from gstack. Never use `mcp__claude-in-chrome__*` tools.

## crawl4ai

For web crawling, scraping, markdown extraction, structured data extraction, and batch URL processing, use the local `crawl4ai` skill in `.claude/skills/crawl4ai/`.

- Do not use Crawl4AI via MCP in this project.
- Prefer the bundled `crawl4ai` skill and its Docker-based wrapper scripts.
- Even if external docs mention MCP setup, follow this repository's skill-based workflow first.

### Available skills

- `/office-hours` - YC-style brainstorming and idea validation
- `/plan-ceo-review` - CEO/founder-mode plan review
- `/plan-eng-review` - Engineering architecture review
- `/plan-design-review` - Designer's eye plan review
- `/plan-devex-review` - Developer experience plan review
- `/design-consultation` - Design system and brand consultation
- `/design-shotgun` - Generate multiple design variants for comparison
- `/design-html` - Production-quality HTML/CSS from approved designs
- `/review` - Pre-landing PR code review
- `/ship` - Ship workflow: tests, review, changelog, PR
- `/land-and-deploy` - Merge PR, wait for CI, verify production
- `/canary` - Post-deploy canary monitoring
- `/benchmark` - Performance regression detection
- `/browse` - Headless browser for QA testing and web browsing
- `/connect-chrome` - Launch visible AI-controlled Chromium
- `/qa` - QA test a web app and fix bugs found
- `/qa-only` - QA report only, no fixes
- `/design-review` - Visual audit and design polish
- `/setup-browser-cookies` - Import real browser cookies for authenticated testing
- `/setup-deploy` - Configure deployment settings
- `/retro` - Weekly engineering retrospective
- `/investigate` - Systematic debugging with root cause analysis
- `/document-release` - Update docs after shipping
- `/codex` - Independent code review via OpenAI Codex
- `/cso` - Chief Security Officer audit
- `/autoplan` - Run all review skills automatically
- `/devex-review` - Live developer experience audit
- `/careful` - Safety guardrails for destructive commands
- `/freeze` - Restrict edits to a specific directory
- `/guard` - Full safety mode (careful + freeze)
- `/unfreeze` - Remove freeze boundary
- `/gstack-upgrade` - Upgrade gstack to latest version
- `/learn` - Manage project learnings across sessions

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Web crawling, scraping, markdown extraction, structured extraction → invoke crawl4ai
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
