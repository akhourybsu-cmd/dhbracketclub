#!/usr/bin/env bash
# Regenerate docs/PRIVACY_MATRIX.md from pg_policies.
# Requires PG* env vars (Lovable Cloud "Read database" mode).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp)"
psql -tAF $'\t' -c "
SELECT tablename, cmd,
  string_agg(DISTINCT policyname || ' | roles=' || array_to_string(roles,',') || ' | USING=' || coalesce(replace(qual,E'\n',' '),'-') || ' | CHECK=' || coalesce(replace(with_check,E'\n',' '),'-'), E'\n  ' ORDER BY 1)
FROM pg_policies WHERE schemaname='public' GROUP BY tablename, cmd ORDER BY tablename, cmd;" > "$TMP"
POLICIES_TSV="$TMP" python3 "$DIR/scripts/build-privacy-matrix.py"
rm -f "$TMP"
echo "Wrote $DIR/docs/PRIVACY_MATRIX.md"
