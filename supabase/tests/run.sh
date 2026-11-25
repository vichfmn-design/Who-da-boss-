#!/usr/bin/env bash
# Rejoue les migrations et le scénario de jeu sur un Postgres local.
# Usage : PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists wdb_test" && $P -c "create database wdb_test"
for f in supabase/tests/00_supabase_shim.sql supabase/migrations/20261125000001_schema.sql \
         supabase/migrations/20261125000002_game.sql supabase/seed.sql supabase/tests/01_game_flow.sql; do
  $P -d wdb_test -f "$f" 2>&1 >/dev/null | sed -n 's/.*NOTICE: *//p; /ERROR/p'
done
echo "Tous les tests SQL sont passés."
