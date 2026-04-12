#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_DIR/.env" 2>/dev/null || true

[ -z "${WEBHOOK_URL:-}" ] && exit 0

# 最新runの情報を取得 (run_idを変数経由でSQLに渡さない)
LATEST=$(sqlite3 "$PROJECT_DIR/data/usecase.db" \
  "SELECT run_id, status, started_at, ended_at FROM runs ORDER BY started_at DESC LIMIT 1" \
  -separator '|' 2>/dev/null || echo "")

[ -z "$LATEST" ] && exit 0

RUN_ID=$(echo "$LATEST" | cut -d'|' -f1)
STATUS=$(echo "$LATEST" | cut -d'|' -f2)
STARTED=$(echo "$LATEST" | cut -d'|' -f3)
ENDED=$(echo "$LATEST" | cut -d'|' -f4)

CASES_A=$(sqlite3 "$PROJECT_DIR/data/usecase.db" \
  "SELECT COUNT(*) FROM cases WHERE run_id=(SELECT run_id FROM runs ORDER BY started_at DESC LIMIT 1) AND level='A'" 2>/dev/null || echo "0")
CASES_B=$(sqlite3 "$PROJECT_DIR/data/usecase.db" \
  "SELECT COUNT(*) FROM cases WHERE run_id=(SELECT run_id FROM runs ORDER BY started_at DESC LIMIT 1) AND level='B'" 2>/dev/null || echo "0")
TOTAL=$(sqlite3 "$PROJECT_DIR/data/usecase.db" \
  "SELECT COUNT(*) FROM cases WHERE run_id=(SELECT run_id FROM runs ORDER BY started_at DESC LIMIT 1)" 2>/dev/null || echo "0")

ICON="white_check_mark"
[ "$STATUS" != "success" ] && ICON="x"

MSG=":${ICON}: usecase-agent run ${STATUS} | Run: ${RUN_ID} | ${STARTED} → ${ENDED} | A=${CASES_A}, B=${CASES_B}, total=${TOTAL}"

WEBHOOK_TYPE="${WEBHOOK_TYPE:-discord}"
if [ "$WEBHOOK_TYPE" = "slack" ]; then
  PAYLOAD="{\"text\": \"${MSG}\"}"
else
  PAYLOAD="{\"content\": \"${MSG}\"}"
fi

curl -sf -X POST "$WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" > /dev/null 2>&1 || true
