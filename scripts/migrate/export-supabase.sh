#!/usr/bin/env bash
# One-shot migration, step 1: export data from the Supabase project.
#
#   scripts/migrate/export-supabase.sh
#
# Reads SUPABASE_DB_URL from .env.local (Supabase dashboard → Connect →
# "Session pooler" URI; the direct connection is IPv6-only). Writes:
#   .migration/public-data.sql   data-only dump of the public schema
#   .migration/auth-users.csv    auth.users rows (id, email, bcrypt hash, …)
#   .migration/source-counts.txt row counts to verify the import against
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=.migration
mkdir -p "$OUT"

URL=$(grep -E '^SUPABASE_DB_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '"' || true)
[ -n "$URL" ] || { echo "SUPABASE_DB_URL is not set in .env.local"; exit 1; }

PGBIN=$( [ -x "$(brew --prefix libpq 2>/dev/null)/bin/pg_dump" ] && echo "$(brew --prefix libpq)/bin" || dirname "$(command -v pg_dump)" )

echo "▶ dumping public schema data"
"$PGBIN/pg_dump" "$URL" \
  --data-only --no-owner --no-privileges \
  --schema=public \
  --exclude-table=public.spatial_ref_sys \
  --exclude-table=public.test \
  --exclude-table=public.schema_migrations \
  -f "$OUT/public-data.sql"

echo "▶ exporting auth.users"
"$PGBIN/psql" "$URL" -v ON_ERROR_STOP=1 -q -c "\copy (select id, lower(email) as email, encrypted_password, (email_confirmed_at is not null) as email_verified, created_at, coalesce(updated_at, created_at) as updated_at, last_sign_in_at, coalesce(raw_user_meta_data->>'name', '') as name from auth.users order by created_at) to '$OUT/auth-users.csv' csv header"

echo "▶ recording source row counts"
"$PGBIN/psql" "$URL" -v ON_ERROR_STOP=1 -At -c "
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
" | tee "$OUT/source-counts.txt"

ls -la "$OUT"
