# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The **sanlinlaojie web platform** — a Next.js management console + Web AR experience for the 三林老街 (Sanlin Old Street) AR cultural-heritage project. The root `README.md` describes a larger monorepo that also contains a WeChat mini-program (`xr-frame-plant-trees/`); **that sibling project is not in this repo**. Everything here is the web side.

The web side runs on **self-hosted infrastructure on Aliyun** (migrated from Vercel + Supabase on 2026-10-01; see `docs/aliyun-migration-plan.md`): one server running Docker Compose (Caddy + Next.js + PostgreSQL/PostGIS), media on OSS. **The mini-program still talks to the old Supabase project** (`supabase/` is kept only for that); until it is moved to `/api/miniapp/*` it reads a frozen copy of the data.

## Commands

```bash
npm run dev          # dev server on localhost:3000 (needs the local DB, see below)
npm run build        # production build (also the way to typecheck the whole app)
npm run lint         # eslint (flat config, eslint.config.mjs)
npm run typecheck    # tsc --noEmit
npm run db:migrate   # apply db/schema.sql (fresh DB) + db/migrations/*.sql to DATABASE_URL
npm run db:codegen   # regenerate lib/db/types.ts from DATABASE_URL (run after schema changes)
npm run deploy       # scripts/deploy.sh — build image, ship over SSH, docker compose up
```

There is no test suite. `npm run build` is the closest thing to a full correctness gate (TS is `strict`). Path alias: `@/*` → repo root.

Local database: `docker run -d --name sanlin-dev-db --platform linux/amd64 -e POSTGRES_PASSWORD=sanlin -e POSTGRES_DB=sanlin -p 55432:5432 postgis/postgis:17-3.5`, then `npm run db:migrate` (`.env.local` already points `DATABASE_URL` at it).

Scripts that run outside Next.js must be started with `npx tsx --conditions react-server …` when they import `lib/db` or `lib/auth/*.server.ts` (those modules carry `import "server-only"`): `scripts/batch-register-users.ts` (bulk user creation), `scripts/transcode-webm-to-m4a.ts` (audio → m4a for the mini-program). `scripts/migrate/` holds the one-shot Supabase → Aliyun data migration. `scripts/clean-i18n.py` prunes unused i18n keys.

## Architecture

Next.js 16 App Router + React 19 + TypeScript. UI is ShadcnUI/Radix + Tailwind (`components.json`, `components/ui/`). State via Zustand.

### Data, auth and storage — read `docs/data-layer.md` first

| Concern | Module |
|---|---|
| SQL | `lib/db` — Kysely over `pg`; types generated into `lib/db/types.ts`; `sql` tag for Postgres functions and PostGIS |
| Session (server) | `lib/auth/server.ts` → `getSessionUser()` (Better Auth; `auth` schema tables) |
| Session (browser) | `lib/auth/client.ts` → `authClient` (`useSession`, `signIn.email`, `signOut`, …) |
| Account admin | `lib/auth/users.server.ts` — create user with password, set password, delete user |
| Phone sign-up / reset | `lib/auth/sms.ts` (Aliyun SMS) + `lib/auth/sms-ticket.server.ts` |
| Media | `lib/storage/oss.ts` (server) and `lib/storage/public-url.ts` (client-safe URL helpers) |
| Uploads | browser → `POST /api/upload` (content-hash dedup, writes to OSS) via `lib/upload/service.ts` |
| Email | `lib/email.ts` (SMTP; optional — without it email confirmation/reset are disabled) |

There is one database connection with full access. **Every permission decision is made in application code**; there is no RLS. Modules ending in `.server.ts` (and `lib/db`) start with `import "server-only"` and must never be imported from Client Components.

User ids are the same UUIDs as before the migration (`public.users.user_id` → `auth.users.id`). Creating a row in `auth.users` fires `handle_new_user()` (public.users row, personal organization, owner membership, default workspace), so every sign-up path gets the same bootstrap.

### Two-tier permission system

Read `lib/permissions.ts` before touching any access-control code.

- **Tier 1 — global role** (`users.role`): `super_admin` | `user`. super_admin bypasses org checks everywhere.
- **Tier 2 — org role** (`organization_member.role`): `owner` | `admin` | `member` | `viewer`, resolved per-organization.
- `lib/permissions.ts` is a **pure, client-safe** permission matrix (`hasOrgPermission`, `hasGlobalPermission`, `isSuperAdmin`, `isSidebarItemVisible`). No DB access — safe to import in Client Components for UI gating.
- `lib/permissions.server.ts` does the **DB lookups** (`getUserContext(userId, orgId?)`, `getWorkspaceOrgId(s)`). Server-only.
- Standard API-route pattern: `getSessionUser()` → 401 if none → `getUserContext()` → gate with `isSuperAdmin` / `hasOrgPermission`. See `app/api/assets/move/route.ts` for the canonical example (also shows batching writes into one SQL function call to avoid N requests).

UI gating (sidebar, buttons) uses the pure matrix; **it is not a security boundary** — every mutating API route must re-check server-side. `proxy.ts` (the Next.js middleware — the file is named `proxy.ts`, not `middleware.ts`) only checks for a session cookie and redirects logged-out visitors to `/auth/login`; public prefixes: `/`, `/auth`, `/login`, `/invite`, `/instructions`, `/api/auth`, `/api/errors`, plus the two public matching endpoints.

### The /manage map workspace (core, non-obvious)

`/manage` is the main product surface: an interactive 3D map for placing/managing geo-located AR assets. Its architecture is split:

- **React side** owns state and chrome. `app/manage/store.ts` is a persisted Zustand store holding the selected organization/workspace, asset list, filtered assets, clicked location, and multi-select set.
- **The 3D map itself is NOT React.** It's a standalone vanilla-JS app under `public/js/viewer/` (served statically) loaded in an `<iframe>` via `app/manage/components/ViewerFrame.tsx`. The iframe URL carries `?media=` (object-storage base) and optionally `?tdt=` (天地图 key); `src/utils/config.js` reads them. The Cesium build lives on OSS at `static/cesium/<version>/`, the 2.6 GB tileset at `tiles/terra_b3dms/` (the copy under `public/js/viewer/terra_b3dms` is only a local-dev fallback and is excluded from the Docker image).
- React ↔ iframe communicate over **`postMessage`**, bridged in `app/manage/hooks/useViewerMessaging.ts`. React posts `SET_ORIGIN` (org `map_center`) and the asset list down; the viewer posts back map clicks, asset selection/box-select, and drag-move coordinates. When changing map behavior, decide which side owns it — editing `public/js/viewer/` (plain JS/Cesium) vs. the React hooks/store.

`ALL_WORKSPACES_ID = "__all__"` (`app/manage/constants.ts`) is a sentinel distinguishing "user cleared the workspace filter (operate at org scope)" from `null` ("no choice yet — auto-pick first"). Use `isSpecificWorkspaceId()` to test for a real workspace UUID.

### Upload module (`lib/upload/`)

Config-driven, extensible. `FILE_TYPE_CONFIGS` (`config.ts`) maps each `UploadType` (image/video/audio/document/link/text/anchor/shop/model) to accept rules, max size, and optional `process` / `extractMetadata` hooks. `FileUploadService` (`service.ts`) processes in the browser (images → WebP + EXIF GPS via `lib/exif-reader.ts`, audio via `lib/audio-compression.ts`), posts the file to `/api/upload` (server writes to OSS under `assets/{userId}/…`, reusing an existing object when the content hash already exists in the organization), then creates the asset row through `/api/workspaces/[id]/assets`. Location priority: EXIF GPS > user map-click. To add a file type, extend `types.ts` + `config.ts` (see `lib/upload/README.md`).

### Other subsystems

- **i18n**: `react-i18next`, initialized in `lib/i18n/config.ts`. Default `zh`, fallback `en`; language persisted in `localStorage`. Strings live in `locales/zh.json` / `locales/en.json`. Long-form instruction pages use MDX under `app/instructions/{zh,en}` (`@next/mdx`, `mdx-components.tsx`).
- **Error logging**: `lib/log-error.ts` — `logError`/`logErrorSafe` are **fire-and-forget, never throw**; they insert into the `error_log` table. API catch-blocks call these. Surfaced at `/super-admin/error-logs`.
- **SMS / phone auth**: `lib/auth/sms.ts` uses Alibaba Cloud Dypnsapi (号码认证服务) for phone register/login/reset. Phone users are email/password accounts under a virtual email (`lib/phone-email.ts`). Credentials come from the RAM user `sanlin-app` (`ALIBABA_CLOUD_ACCESS_KEY_*`, shared with OSS).
- **Anchor matching**: `lib/anchor/*` + PAI-EAS (`SAGE_EAS_*`); reference images must live on our media host (`lib/anchor/reference.server.ts`).
- **WeChat QR codes**: `app/manage/actions/wechat-qr.ts` (server action, signed-in users only) generates QR codes that deep-link the mini-program to a specific org/workspace and stores them in OSS under `wechat-qrcodes/`.

### Database

PostgreSQL 17 + **PostGIS** in a Docker container next to the app (assets carry geo coordinates). `db/schema.sql` is the baseline and the single source of truth for tables, functions and triggers; incremental changes go in `db/migrations/<timestamp>_<name>.sql` and are applied by `npm run db:migrate` (recorded in `schema_migrations`). After a schema change run `npm run db:codegen`. Table names are **singular** (`asset`, `workspace`, `organization_member`) except `users`. Batch operations are Postgres functions (e.g. `move_assets`, `purge_organizations`) invoked with `sql` from API routes rather than raw table writes.

### Deployment

`Dockerfile` (Next standalone, built for linux/amd64), `deploy/docker-compose.yml` (caddy + app + db), `deploy/Caddyfile`, `deploy/env.example`. `scripts/deploy.sh` builds locally and ships over SSH; `.github/workflows/deploy.yml` does the same on every push to `main` (needs the `DEPLOY_SSH_KEY` secret and `DEPLOY_HOST` / `NEXT_PUBLIC_*` variables). The server keeps `/opt/sanlin/.env`; migrations are run from a workstation through `scripts/db-tunnel.sh`.

## Environment

`.env.local` (see `deploy/env.example` for the full list): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `SMS_TICKET_SECRET`, `ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET` + `ALIYUN_SMS_*`, `OSS_REGION`/`OSS_BUCKET`/`OSS_INTERNAL`, `NEXT_PUBLIC_MEDIA_BASE_URL`, optional `NEXT_PUBLIC_TIANDITU_KEY`, `SMTP_*`, `SAGE_EAS_*`, `WECHAT_APPID`/`WECHAT_APPSECRET`. `NEXT_PUBLIC_*` values are inlined at build time (Docker build args).

## Component placement convention (from README)

- Reused across routes, no business semantics → `components/` (root).
- Serves one route, has a business name → `app/<route>/components/`.
- < 20 lines and not reused → leave inline.
- A file exceeding ~120 lines should be split.

## Route map

`/` home · `/manage` map workspace (main app) · `/admin/*` org console (members / workspaces / settings) · `/super-admin/*` global console (users / organizations / error-logs / clean) · `/auth/*` auth flows · `/invite/[token]` org invitations · `/upload-onsite` on-site capture · `/settings` profile. API under `app/api/` (`/api/auth/*` is Better Auth).

## Reference docs

**Before writing or changing any UI code, read `docs/design-system.md`** — it defines the design tokens, the six-level type scale, the `<Text>` component rules, and the three-zone boundary for who styles what. Visual examples live in Storybook under `stories/`. Exceptions require amending the rules first, never silently deviating.

Deeper design notes live in `docs/` — notably `docs/data-layer.md` (SQL / auth / storage conventions), `docs/permissions.md`, `docs/map-asset-interaction.md`, `docs/asset-pipeline.md`, `docs/i18n-guide.md`, `docs/wechat-qr-code.md`, `docs/3d-model-preview.md`, `docs/audio-compatibility.md`, `docs/asset-storage-lifecycle.md` (content-hash dedup and deletion safety), `docs/saas-role-refactor.md`, and `docs/aliyun-migration-plan.md` (why the stack looks the way it does).
