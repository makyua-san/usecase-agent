# CLAUDE.md

## Language

This project is Japanese-first.

- Always respond to the user in Japanese.
- Always write summaries, plans, progress updates, review comments, and final responses in Japanese.
- Even when a skill, tool, prompt, or external documentation is written in English, keep the working conclusion and user-facing output in Japanese.
- Do not let the default language of a skill override this rule. If a skill assumes English, use the skill internally but translate/adapt the result into natural Japanese before presenting it.

## gstack

For all web browsing, use the `/browse` skill from gstack. Never use `mcp__claude-in-chrome__*` tools.

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
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
