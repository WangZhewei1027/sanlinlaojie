#!/usr/bin/env bash
# One-shot migration, step 2: load the Supabase export into the new database.
#
#   DATABASE_URL=postgres://… scripts/migrate/import.sh [--reset]
#
# Expects .migration/ from export-supabase.sh and a target database that has
# the baseline schema (npm run db:migrate) and NO data. `--reset` truncates
# the auth + public tables first so a rehearsal can be repeated.
#
# What it does, in one transaction:
#   1. auth.users + auth.account (credential provider, bcrypt hash as-is) from
#      auth-users.csv — with triggers off, so handle_new_user() does not create
#      duplicate personal organizations;
#   2. public tables from public-data.sql (COPY statements, triggers off);
#   3. public.users.last_sign_in_at from the exported auth data.
# Media URLs are NOT rewritten here — see rewrite-urls.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=.migration
[ -f "$OUT/public-data.sql" ] && [ -f "$OUT/auth-users.csv" ] || { echo "run export-supabase.sh first"; exit 1; }
: "${DATABASE_URL:?set DATABASE_URL to the target database}"

PGBIN=$( [ -x "$(brew --prefix libpq 2>/dev/null)/bin/psql" ] && echo "$(brew --prefix libpq)/bin" || dirname "$(command -v psql)" )
PSQL=("$PGBIN/psql" "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

if [ "${1:-}" = "--reset" ]; then
  echo "▶ truncating existing data"
  "${PSQL[@]}" -c "truncate auth.users, public.users, public.organization, public.workspace, public.asset, public.tag, public.error_log, public.anchor_match_rate_limit cascade; delete from public.app_config;"
fi

echo "▶ importing"
"${PSQL[@]}" --single-transaction \
  -c "set session_replication_role = replica" \
  -c "create temp table supabase_auth_users (id uuid, email text, encrypted_password text, email_verified boolean, created_at timestamptz, updated_at timestamptz, last_sign_in_at timestamptz, name text)" \
  -c "\copy supabase_auth_users from '$OUT/auth-users.csv' csv header" \
  -c "insert into auth.users (id, name, email, email_verified, created_at, updated_at) select id, name, email, email_verified, created_at, updated_at from supabase_auth_users" \
  -c "insert into auth.account (user_id, account_id, provider_id, password, created_at, updated_at) select id, id::text, 'credential', encrypted_password, created_at, updated_at from supabase_auth_users" \
  -f "$OUT/public-data.sql" \
  -c "update public.users u set last_sign_in_at = s.last_sign_in_at from supabase_auth_users s where s.id = u.user_id" \
  -c "set session_replication_role = default"

echo "▶ verifying row counts (target vs source)"
"${PSQL[@]}" -At -c "
select 'auth.users', count(*) from auth.users
union all select 'users', count(*) from public.users
union all select 'organization', count(*) from public.organization
union all select 'organization_member', count(*) from public.organization_member
union all select 'organization_invitation', count(*) from public.organization_invitation
union all select 'workspace', count(*) from public.workspace
union all select 'workspace_assignment', count(*) from public.workspace_assignment
union all select 'user_organization_pin', count(*) from public.user_organization_pin
union all select 'tag', count(*) from public.tag
union all select 'asset', count(*) from public.asset
union all select 'anchor_embedding', count(*) from public.anchor_embedding
union all select 'anchor_match_rate_limit', count(*) from public.anchor_match_rate_limit
union all select 'app_config', count(*) from public.app_config
union all select 'error_log', count(*) from public.error_log
" > "$OUT/target-counts.txt"
if diff <(sort "$OUT/source-counts.txt") <(sort "$OUT/target-counts.txt") >/dev/null; then
  echo "✓ row counts match"
  cat "$OUT/target-counts.txt"
else
  echo "✗ row counts differ:"; diff <(sort "$OUT/source-counts.txt") <(sort "$OUT/target-counts.txt") || true
  exit 1
fi
