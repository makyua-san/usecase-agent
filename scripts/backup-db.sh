#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$PROJECT_DIR/data/usecase.db"
BACKUP_DIR="$PROJECT_DIR/data/backups"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

if [ -f "$DB_PATH" ]; then
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  sqlite3 "$DB_PATH" ".backup $BACKUP_DIR/usecase-$TIMESTAMP.db"
  echo "Backup: $BACKUP_DIR/usecase-$TIMESTAMP.db"

  # 世代管理: KEEP_DAYS日より古いバックアップを削除
  find "$BACKUP_DIR" -name "usecase-*.db" -mtime +$KEEP_DAYS -delete
  echo "Cleanup: removed backups older than ${KEEP_DAYS} days"
else
  echo "No database found at $DB_PATH — skipping backup (first run)"
fi
