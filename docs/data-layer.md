# Data layer, auth and storage (post-Supabase)

The web platform runs on a self-hosted PostgreSQL + PostGIS database, Better
Auth for sessions, and Aliyun OSS for media. This document is the reference
for writing server code against them; it is also the conversion guide that was
used to move every route off supabase-js.

| Concern | Module | Replaces |
|---|---|---|
| SQL | `lib/db` (Kysely + `pg`) | `createClient().from()` / `.rpc()` |
| Session | `lib/auth/server.ts` → `getSessionUser()` | `supabase.auth.getUser()` |
| Browser auth | `lib/auth/client.ts` → `authClient` | `createBrowserClient().auth.*` |
| Account admin | `lib/auth/users.server.ts` | `auth.admin.createUser/deleteUser/updateUserById/listUsers` |
| Permissions | `lib/permissions.server.ts` (no client arg) | same, with a client arg |
| Error log | `lib/log-error.ts` → `logError(entry)` | `logError(supabase, entry)` |
| Media | `lib/storage/oss.ts`, `lib/storage/public-url.ts` | `supabase.storage.from()` |
| Uploads | `POST /api/upload` (relay) | browser direct upload to the bucket |

Schema: `db/schema.sql` (baseline), `db/migrations/*.sql` (incremental),
applied with `npm run db:migrate`. Types: `lib/db/types.ts`, regenerated with
`npm run db:codegen` against a database that has the schema (`DATABASE_URL`).

## Route handler shape

```ts
import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserContext } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });
  try {
    const { globalRole, orgRole } = await getUserContext(user.id, orgId);
    if (!isSuperAdmin(globalRole) && !hasOrgPermission(orgRole, "org.assets.write")) {
      await logError({ userId: user.id, method: "POST", path: "/api/x", status: 403, message: "权限不足" });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }
    const rows = await db.selectFrom("asset").selectAll().where("id", "in", ids).execute();
    return NextResponse.json({ data: rows });
  } catch (error) {
    await logError({ method: "POST", path: "/api/x", status: 500, message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "失败" }, { status: 500 });
  }
}
```

`getSessionUser()` returns `{ id, email, name, emailVerified, … } | null`.
`user.id` is the same UUID as before (`public.users.user_id`). There is no
"admin client": the single `db` connection has full access, and every
permission decision is made in code — exactly as the Supabase-era routes
already did (RLS was never relied on except for `user_organization_pin`,
which is now checked in the route).

## Translating supabase-js queries to Kysely

| supabase-js | Kysely |
|---|---|
| `.from("t").select("a,b")` | `db.selectFrom("t").select(["a","b"])` |
| `.select("*")` | `.selectAll()` |
| `.eq("a", v)` / `.neq` / `.gt` | `.where("a", "=", v)` / `"<>"` / `">"` |
| `.in("a", list)` | `.where("a", "in", list)` (guard empty lists — SQL `in ()` is invalid) |
| `.is("a", null)` / `.not("a","is",null)` | `.where("a", "is", null)` / `.where("a", "is not", null)` |
| `.ilike("a", "%x%")` | `.where("a", "ilike", \`%${x}%\`)` |
| `.or("a.ilike.%x%,b.ilike.%x%")` | `.where((eb) => eb.or([eb("a","ilike",p), eb("b","ilike",p)]))` |
| `.contains("workspace_id", [id])` (uuid[] ⊇) | `.where(sql<boolean>\`workspace_id @> array[${id}::uuid]\`)` |
| `.overlaps("workspace_id", ids)` | `.where("workspace_id", "&&", ids)` |
| `.containedBy("workspace_id", ids)` | `.where(sql<boolean>\`workspace_id <@ ${ids}::uuid[]\`)` |
| `.order("a", { ascending: false })` | `.orderBy("a", "desc")` |
| `.limit(n)` / `.range(a, b)` | `.limit(n)` / `.limit(b-a+1).offset(a)` |
| `.single()` | `.executeTakeFirstOrThrow()` |
| `.maybeSingle()` | `.executeTakeFirst()` (undefined when missing) |
| plain list | `.execute()` |
| `.select("id", { count: "exact", head: true })` | `.select(({ fn }) => fn.countAll<number>().as("count")).executeTakeFirstOrThrow()` |
| `.insert(row).select().single()` | `db.insertInto("t").values(row).returningAll().executeTakeFirstOrThrow()` |
| `.update(patch).eq("id", id).select()` | `db.updateTable("t").set(patch).where("id","=",id).returningAll().executeTakeFirst()` |
| `.upsert(row, { onConflict: "a,b", ignoreDuplicates: true })` | `.values(row).onConflict((oc) => oc.columns(["a","b"]).doNothing())` |
| `.upsert(row, { onConflict: "a" })` | `.onConflict((oc) => oc.column("a").doUpdateSet({ … }))` |
| `.delete().eq("id", id)` | `db.deleteFrom("t").where("id","=",id).execute()` |
| `.rpc("fn", { p_a: a })` returning scalar | ``const { rows } = await sql<{ v: T }>`select public.fn(${a}) as v`.execute(db)`` |
| `.rpc("fn", …)` returning rows | ``(await sql<Row>`select * from public.fn(${a}, ${b})`.execute(db)).rows`` |
| nested select `organization(name)` | `jsonObjectFrom(eb.selectFrom("organization").select("name").whereRef("organization.id","=","organization_member.organization_id")).as("organization")` |
| nested list `workspace_assignment(id, workspace(name))` | `jsonArrayFrom(eb.selectFrom("workspace_assignment").select([...]).whereRef(...)).as("workspace_assignment")` |
| `fetchAllRows(...)` (1000-row paging) | not needed — just `.execute()` |

Notes

- There is no `{ data, error }` envelope: queries **throw** on failure. Wrap
  the handler body in try/catch (the pattern above) instead of checking `error`.
- `jsonArrayFrom` / `jsonObjectFrom` come from `@/lib/db`. They return JSON,
  so timestamps inside nested objects are strings (same as PostgREST).
- `jsonb` columns: pass objects for inserts/updates as `JSON.stringify(obj)`;
  reads come back parsed. Casting a JS array is enough for `uuid[]`/`text[]`.
- `geometry` columns: keep writing the same `POINT(lng lat)` WKT string the
  old code used (`.values({ location: wkt })` — Postgres casts it; existing
  rows have no SRID and the functions apply 4326 themselves) and read with
  ``sql<number>`ST_X(location::geometry)`.as("longitude")``. Raw `location`
  reads are hex EWKB strings — don't expose them where the old API returned
  WKT; most responses carry coordinates in `metadata` anyway.
- `count(*)` is returned as a JS number (type parser in `lib/db/index.ts`).
- Transactions: `await db.transaction().execute(async (trx) => { … })`.
- Postgres functions (`move_assets`, `purge_organizations`, `error_log_query`,
  `get_user_organizations`, …) are unchanged; call them with `sql`.

## Auth

Server (route handlers, server components, server actions):

```ts
const user = await getSessionUser();      // null when logged out
```

Browser (`"use client"`):

```ts
import { authClient } from "@/lib/auth/client";
const { data: session, isPending } = authClient.useSession();   // session?.user
await authClient.signIn.email({ email, password });              // { data, error }
await authClient.signUp.email({ email, password, name: "" });
await authClient.signOut();
await authClient.requestPasswordReset({ email, redirectTo: "/auth/update-password" });
await authClient.resetPassword({ newPassword, token });          // token from ?token= in the reset link
await authClient.changePassword({ currentPassword, newPassword });
```

Calls return `{ data, error }`; `error` has `{ code, message, status }` —
codes such as `INVALID_EMAIL_OR_PASSWORD`, `USER_ALREADY_EXISTS`,
`EMAIL_NOT_VERIFIED`, `PASSWORD_TOO_SHORT`, `INVALID_TOKEN`. `lib/auth/auth-error.ts`
maps them to i18n keys.

Phone accounts keep the virtual-email scheme (`lib/phone-email.ts`): login is
`signIn.email` with the virtual email; sign-up / reset go through the server
actions in `lib/auth/sms.ts`, which call `lib/auth/users.server.ts` after the
SMS ticket check. Admin creation (`POST /api/users`, batch script) uses
`createUserWithPassword()`; deletion uses `deleteAuthUser()` (cascades to
`public.users` and memberships). `last_sign_in_at` lives on `public.users`
(maintained by a trigger on `auth.session`).

Email confirmation and password-reset mail need SMTP (`lib/email.ts`); without
it sign-up still works and reset-by-email reports that mail is unavailable.

## Storage

```ts
import { putObject, deleteObjects, headObject, listObjects, mediaUrl, assetKeyFromUrl, ASSETS_PREFIX } from "@/lib/storage/oss";
```

- Object keys: `assets/{userId}/{ts}-{rand}.{ext}`, `wechat-qrcodes/release/…png`.
- The database stores full public URLs (`NEXT_PUBLIC_MEDIA_BASE_URL` + key).
  `assetKeyFromUrl(url)` → key or null; `storagePathFromUrl` in
  `lib/storage-cleanup.server.ts` is the same thing.
- Reference counting before deleting shared files is unchanged:
  `removeStorageFileIfUnreferenced(url, ctx)`.
- Browser uploads: `FileUploadService.uploadToStorage()` posts to
  `/api/upload`, which dedups by content hash and writes to OSS.
