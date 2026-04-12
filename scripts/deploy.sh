#!/bin/bash
set -euo pipefail

echo "=== usecase-agent deploy ==="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# 1. 必須ツール確認
echo "[1/9] Checking required tools..."
for cmd in docker sqlite3; do
  command -v "$cmd" >/dev/null || { echo "ERROR: $cmd is required but not found"; exit 1; }
done
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose is required"; exit 1; }
command -v mise >/dev/null || { echo "ERROR: mise is required. Install: https://mise.jdx.dev/"; exit 1; }
command -v claude >/dev/null || { echo "ERROR: claude CLI is required. Run: claude login"; exit 1; }
echo "  All tools found."

# 2. mise でランタイムインストール
echo "[2/9] Installing runtimes via mise..."
mise install

# bunの絶対パスを動的解決 (miseバージョン変更に対応)
BUN_PATH=$(mise which bun)
echo "  Bun path: $BUN_PATH"

# 3. データディレクトリ
echo "[3/9] Creating data directories..."
mkdir -p data/raw data/logs data/plans data/backups

# 4. DB初期化
echo "[4/9] Initializing database..."
"$BUN_PATH" run init-db.ts

# 5. Crawl4AI起動
echo "[5/9] Starting Crawl4AI..."
docker compose up -d
echo "  Waiting for Crawl4AI health..."
TIMEOUT=120
ELAPSED=0
until curl -sf http://localhost:11235/health >/dev/null 2>&1; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "  WARNING: Crawl4AI did not become healthy within ${TIMEOUT}s"
    echo "  Check: docker compose logs crawl4ai"
    break
  fi
done
[ "$ELAPSED" -lt "$TIMEOUT" ] && echo "  Crawl4AI is healthy."

# 6. ダッシュボードビルド
echo "[6/9] Building dashboard..."
cd dashboard && "$BUN_PATH" install && "$BUN_PATH" run build && cd ..

# 7. .env確認
echo "[7/9] Checking .env..."
if [ ! -f .env ]; then
  cp scripts/.env.example .env
  echo "  WARNING: .env created from template. Edit it with your keys:"
  echo "    Required: ANTHROPIC_API_KEY"
  echo "    Optional: WEBHOOK_URL (Slack/Discord)"
fi

# 8. systemd units インストール
echo "[8/9] Installing systemd units..."
for unit in usecase-agent-dashboard.service usecase-agent-run.service usecase-agent-run.timer; do
  sed "s|__PROJECT_DIR__|${PROJECT_DIR}|g; s|__USER__|$(whoami)|g; s|__BUN_PATH__|${BUN_PATH}|g" \
    "scripts/$unit" | sudo tee "/etc/systemd/system/$unit" > /dev/null
done

sudo systemctl daemon-reload

# 冪等: 既にenableされていても安全に再起動
sudo systemctl enable usecase-agent-dashboard.service
sudo systemctl restart usecase-agent-dashboard.service
sudo systemctl enable --now usecase-agent-run.timer

# 9. ヘルスチェック
echo "[9/9] Verifying..."
sleep 2
if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "  Dashboard: OK (http://localhost:3000)"
else
  echo "  Dashboard: STARTING... (may take a few seconds)"
fi

if systemctl is-active --quiet usecase-agent-run.timer; then
  echo "  Timer: active"
  NEXT=$(systemctl list-timers usecase-agent-run.timer --no-pager 2>/dev/null | grep usecase | awk '{print $1, $2}')
  [ -n "$NEXT" ] && echo "  Next run: $NEXT"
else
  echo "  Timer: FAILED — check: journalctl -u usecase-agent-run.timer"
fi

echo ""
echo "=== Deploy complete ==="
echo ""
echo "Dashboard:  http://localhost:3000"
echo "Logs:       journalctl -u usecase-agent-run -f"
echo "Status:     systemctl status usecase-agent-dashboard"
echo "Manual run: sudo systemctl start usecase-agent-run"
echo ""
echo "Optional: Install Caddy for external HTTPS access"
echo "  sudo apt install -y caddy"
echo "  Edit scripts/Caddyfile with your domain"
echo "  sudo cp scripts/Caddyfile /etc/caddy/Caddyfile"
echo "  sudo systemctl reload caddy"
