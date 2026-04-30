#!/bin/zsh

# Starts backend and frontend dev servers together from the repository root.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Prefer a repo-local .env when present, otherwise fall back to the team database defaults.
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
else
  export PORT="${PORT:-4000}"
  export FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
  export PGHOST="${PGHOST:-csce-315-db.engr.tamu.edu}"
  export PGPORT="${PGPORT:-5432}"
  export PGDATABASE="${PGDATABASE:-team_26_db}"
  export PGUSER="${PGUSER:-team_26}"
  export PGPASSWORD="${PGPASSWORD:-26}"
  export PGSSLMODE="${PGSSLMODE:-require}"
fi

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Starting Bubble Tea POS web app..."
echo "Backend DB: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:${PORT}"

(cd "$ROOT_DIR/backend" && npm run dev) &
(cd "$ROOT_DIR/frontend" && npm run dev) &

wait
