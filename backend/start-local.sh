#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

PGBIN="${PGBIN:-/usr/lib/postgresql/18/bin}"
PGDATA="${PGDATA:-$PWD/.pgdata}"

if ! "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" -o "-p 5433 -k /tmp" start
fi

if curl -fsS http://127.0.0.1:8000/ >/dev/null 2>&1; then
  echo "Backend déjà actif sur http://localhost:8000"
  exit 0
fi

exec .venv/bin/uvicorn app.main:app --reload --port 8000
