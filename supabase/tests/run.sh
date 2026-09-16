#!/usr/bin/env bash
# Runs the database test suite against a throwaway Postgres.
#
#   bash supabase/tests/run.sh
#
# Needs a local PostgreSQL 15+ (psql, initdb, pg_ctl). Nothing touches your
# real databases: a temporary cluster is created on port 55432 and deleted.
set -euo pipefail

PGBIN="${PGBIN:-/c/Program Files/PostgreSQL/18/bin}"
PORT="${PGPORT_TEST:-55432}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/hy-pgtest-$$"

psql() { "$PGBIN/psql" -h localhost -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

cleanup() { "$PGBIN/pg_ctl" -D "$TMP" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP" -U postgres -A trust -E UTF8 --no-locale >/dev/null
"$PGBIN/pg_ctl" -D "$TMP" -o "-p $PORT -c listen_addresses=localhost" -w start >/dev/null

psql -d postgres -c "create database hashyard_test"
psql -d hashyard_test -f "$DIR/tests/00_supabase_stub.sql"
for f in "$DIR"/migrations/*.sql; do
  case "$f" in *_cron.sql) continue ;; esac   # cron needs Supabase's pg_cron + pg_net
  echo "migrate: $(basename "$f")"
  psql -d hashyard_test -f "$f"
done
# -t -A: print only messages, not the empty result row of every check
psql -d hashyard_test -t -A -f "$DIR/tests/10_money_and_security.sql" 2>&1   | sed -e 's/^psql:.*: NOTICE:  //' -e 's/^psql:.*: ERROR:  /ERROR: /' | grep -v '^$'
