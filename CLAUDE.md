# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The **sanlinlaojie web platform** — a Next.js management console + Web AR experience for the 三林老街 (Sanlin Old Street) AR cultural-heritage project. The root `README.md` describes a larger monorepo that also contains a WeChat mini-program (`xr-frame-plant-trees/`); **that sibling project is not in this repo**. Everything here is the web side.

The web side runs on **self-hosted infrastructure on Aliyun** (migrated from Vercel + Supabase on 2026-10-01; see `docs/aliyun-migration-plan.md`): one server running Docker Compose (Caddy + Next.js + PostgreSQL/PostGIS), media on OSS. The mini-program talks to the anonymous `/api/miniapp/*` routes (`docs/miniapp-api.md`); `supabase/` is kept only until the last Supabase-era mini-program build has drained.

## Commands

```bash
npm run dev          # dev server on localhost:3000 (needs the local DB, see below)
npm run build        # production build (also the way to typecheck the whole app)
npm run lint         # eslint (flat config, eslint.config.mjs)
npm run typecheck    # next typegen + tsc --noEmit (also works on a fresh checkout)
npm run db:migrate   # apply db/schema.sql (fresh DB) + db/migrations/*.sql to DATABASE_URL
npm run db:codegen   # regenerate lib/db/types.ts from DATABASE_URL (run after schema changes)
npm run deploy       # scripts/deploy.sh — build image, ship over SSH, docker compose up
```

Validation uses `npm run check` (typecheck, lint, build and Storybook), plus focused scripts under `scripts/test-*.ts`. Content-model scripts cover contracts, services, HTTP and migration behavior; read their fixture/environment requirements before running database tests. Passing a build does not establish migration or runtime correctness. Path alias: `@/*` → repo root.

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
| Email | `lib/email.ts` (SMTP; optional — without it email confirmation is disabled; password recovery is SMS-only) |

There is one database connection with full access. **Every permission decision is made in application code**; there is no RLS. Modules ending in `.server.ts` (and `lib/db`) start with `import "server-only"` and must never be imported from Client Components.

User ids are the same UUIDs as before the migration (`public.users.user_id` → `auth.users.id`). Creating a row in `auth.users` fires `handle_new_user()` (public.users row, personal organization, owner membership, zero collections), so every sign-up path gets the same bootstrap. New teams created through the admin API also start with no collections.

### Team (organization), collection and asset permissions

Read `lib/permissions.ts` and `docs/team-workbench-backend-contract.md` before touching any access-control code.

- The UI calls an organization a **团队 (team)**. The team is the only ownership and permission boundary: every member reads every asset, scene, collection and placement of the team. Workspace rows survive only as **map collections** that own placements (same UUIDs and QR parameters).
- **Tier 1 — global role** (`users.role`): `super_admin` | `user`. super_admin bypasses org checks everywhere.
- **Tier 2 — team role** (`organization_member.role`): `owner` | `admin` | `member` | `viewer`. owner/admin/member write team content; viewer is read-only; owner/admin keep team administration (members, roles, maintainer transfer).
- `lib/permissions.ts` is a **pure, client-safe** permission matrix (`hasOrgPermission`, `hasGlobalPermission`, `isSuperAdmin`, `isSidebarItemVisible`, `orgRoleCanWrite`). No DB access — safe to import in Client Components for UI gating.
- `lib/permissions.server.ts` does the **DB lookups** (`getUserContext(userId, orgId?)`, `getWorkspaceOrgId(s)`). Server-only.
- Collection assignments and asset grants have been removed, together with their endpoints. Asset `visibility` is metadata, not a permission input. `maintained_by` is informational. Never infer ownership from upload paths, `created_by`, or `origin_workspace_id`.
- Content authorization lives in `lib/content-model/access.server.ts`; capability flags in DTOs come from the same server rules and are what the UI renders. The frontend's team-level "can write" helper is `teamCanWrite()` in `app/manage/lib/content-context.ts` (team role / declared capability, never an assignment).

UI gating (sidebar, buttons) uses the pure matrix and DTO capabilities; **it is not a security boundary** — every mutating API route must re-check server-side. `proxy.ts` (the Next.js middleware — the file is named `proxy.ts`, not `middleware.ts`) only checks for a session cookie and redirects logged-out visitors to `/auth/login`; public prefixes: `/`, `/auth`, `/login`, `/invite`, `/instructions`, `/api/auth`, `/api/errors`, `/api/miniapp`, plus the public `/api/assets/[id]/matching` endpoint.

### Team workbench and map collections

Front-end model: `docs/team-workbench.md`. Sidebar navigation is 地图合集 / 场景 / 基础素材, with 团队设置 as a secondary entry (`app/manage/components/ContentNav.tsx`); there is no global workspace selector .

- `/manage` opens `/manage/assets`. **Assets** and **scenes** use separate thumbnail libraries at `/manage/assets` and `/manage/scenes`; only assets have a type filter. Upload, create/import/copy scene never ask for a collection.
- Presentational components live in `app/manage/content/` (props + `ContentAction` callbacks, stories in `stories/content/`); data and permissions live in the route components (`app/manage/workbench/`, `app/manage/collections/components/`, `app/manage/assets/components/`).

### The collection map

`/manage/assets` and `/manage/scenes` are the team content libraries. `/manage/collections/[id]` opens a collection map.
`useTeamContext` provides the selected team; collections are explicit URL/page context.
`app/manage/store.ts` persists only the selected team. Map selection, placements and
resolved playable content live in `placement-store.ts`.

The map is a standalone Cesium iframe under `public/js/viewer/`. React communicates
through `usePlacementViewer.ts` and `placement-to-viewer.ts`. Map IDs are Placement
IDs; drag updates use placement optimistic locks. Asset edits update referenced content; placement settings stay independent.

### Upload module (`lib/upload/`)

`FILE_TYPE_CONFIGS` and `FileUploadService.processFile` handle browser preprocessing.
`/api/upload` requires explicit team/collection context and returns an actor/team-bound
receipt. Team asset creation uses `/api/organizations/[id]/assets`; upload-and-place
uses `/api/collections/[id]/placements`. Anchors are mutable assets with reference resources. Features belong to the current image and are invalidated when it changes.

All cleanup uses `lib/storage/retention.server.ts`. Physical deletion remains disabled
unless `app_config.managed_object_deletion.enabled` is explicitly true.

### Other subsystems

- **i18n**: `react-i18next`, initialized in `lib/i18n/config.ts`. Default `zh`, fallback `en`; language persisted in `localStorage`. Strings live in `locales/zh.json` / `locales/en.json`. Long-form instruction pages use MDX under `app/instructions/{zh,en}` (`@next/mdx`, `mdx-components.tsx`).
- **Error logging**: `lib/log-error.ts` — `logError`/`logErrorSafe` are **fire-and-forget, never throw**; they insert into the `error_log` table. API catch-blocks call these. Surfaced at `/super-admin/error-logs`.
- **SMS / phone auth**: `lib/auth/sms.ts` uses Alibaba Cloud Dypnsapi (号码认证服务) for phone register/login/reset. Phone users are email/password accounts under a virtual email (`lib/phone-email.ts`). Credentials come from the RAM user `sanlin-app` (`ALIBABA_CLOUD_ACCESS_KEY_*`, shared with OSS).
- **Scenes**: team-owned schema-4 documents reference asset IDs. Saving immediately updates map references and QR preview; playback resolves current assets. There is no publication or revision model. Old asset-backed scenes are converted by the database migration.
- **Activity extension**: static placement content resolves a current Asset or current Scene layout. Activity/topic/reply/reward storage and a generic rule engine are not implemented; keep future business content outside Asset and Scene documents.
- **Anchor matching**: `lib/anchor/*` + PAI-EAS (`SAGE_EAS_*`); reference images must live on our media host (`lib/anchor/reference.server.ts`).
- **WeChat QR codes**: `app/manage/actions/wechat-qr.ts` (server action, signed-in users only) generates QR codes that deep-link the mini-program to a specific org/workspace and stores them in OSS under `wechat-qrcodes/`. Collection QR codes appear only inside `/manage/collections/[id]`; the collection library has no QR entry. Collection cards open the full-window map editor in a new tab, without the global navbar.

### Database

PostgreSQL 17 + **PostGIS** in a Docker container next to the app. Geo coordinates belong to Placement. `db/schema.sql` is the baseline and the single source of truth for tables, functions and triggers; incremental changes go in `db/migrations/<timestamp>_<name>.sql` and are applied by `npm run db:migrate` (recorded in `schema_migrations`). After a schema change run `npm run db:codegen`. Table names are **singular** (`asset`, `workspace`, `organization_member`) except `users`. Commands use Kysely transactions in domain services and validate references and retention.

### Deployment

Current production topology, service responsibilities, independent SAGE/mini-program deployment, ports and backup operations are documented in `docs/production-deployment.md`. Keep it in sync when changing production infrastructure; `docs/aliyun-migration-plan.md` is a historical plan, not the current deployment inventory.

`Dockerfile` (Next standalone, built for linux/amd64), `deploy/docker-compose.yml` (caddy + app + db + pgadmin), `deploy/Caddyfile`, `deploy/env.example`. `scripts/deploy.sh` builds locally and ships over SSH; `.github/workflows/deploy.yml` does the same on every push to `main` (needs the `DEPLOY_SSH_KEY` secret and `DEPLOY_HOST` / `NEXT_PUBLIC_*` variables). The server keeps `/opt/sanlin/.env`; migrations are run from a workstation through `scripts/db-tunnel.sh`. Deployment waits for the reusable quality workflow (including migration regression tests), then runs `scripts/db/deployment-check.mjs` against the target database read-only. Missing migrations or obsolete runtime structures block shipping; deployment never migrates automatically. Browser database access, dedicated roles and first-time pgAdmin secret provisioning are documented in `docs/pgadmin.md`. For this breaking release, follow `docs/release-readiness-20261019.md` and `docs/content-model-migration-runbook.md`.

## Environment

`.env.local` (see `deploy/env.example` for the full list): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `SMS_TICKET_SECRET`, `ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET` + `ALIYUN_SMS_*`, `OSS_REGION`/`OSS_BUCKET`/`OSS_INTERNAL`, `NEXT_PUBLIC_MEDIA_BASE_URL`, optional `NEXT_PUBLIC_TIANDITU_KEY`, `SMTP_*`, `SAGE_EAS_*`, `WECHAT_APPID`/`WECHAT_APPSECRET`. `NEXT_PUBLIC_*` values are inlined at build time (Docker build args).

## Component placement convention (from README)

- Reused across routes, no business semantics → `components/` (root).
- Serves one route, has a business name → `app/<route>/components/`.
- < 20 lines and not reused → leave inline.
- A file exceeding ~120 lines should be split.

## Route map

`/` home · `/manage` default entry · `/manage/assets` basic assets · `/manage/scenes` scenes · `/manage/assets/[id]` asset detail · `/manage/scenes/[id]` editor · `/manage/collections` map collections · `/manage/collections/[id]` collection map · `/admin/*` team settings (members / settings) · `/super-admin/*` global console (users / organizations / error-logs / clean / settings) · `/auth/*` auth flows · `/invite/[token]` org invitations · `/upload-onsite` on-site capture · `/settings` profile · `/instructions/{zh,en}` MDX guides · `/403`. API under `app/api/` (`/api/auth/*` is Better Auth).

## Reference docs

**Before writing or changing any UI code, read `docs/design-system.md`** — it defines the design tokens, the six-level type scale, the `<Text>` component rules, and the three-zone boundary for who styles what. Visual examples live in Storybook under `stories/`. Exceptions require amending the rules first, never silently deviating.

Deeper design notes live in `docs/` — notably `docs/team-workbench.md` (team workbench, collections, compatibility URLs), `docs/team-workbench-backend-contract.md` (team permission model and routes), `docs/data-layer.md` (SQL / auth / storage conventions), `docs/permissions.md`, `docs/map-asset-interaction.md`, `docs/asset-pipeline.md`, `docs/i18n-guide.md`, `docs/wechat-qr-code.md`, `docs/3d-model-preview.md`, `docs/audio-compatibility.md`, `docs/asset-storage-lifecycle.md` (content-hash dedup and deletion safety), `docs/saas-role-refactor.md`, and `docs/aliyun-migration-plan.md` (why the stack looks the way it does).


The content model is single-path: no state switch, compatibility header, legacy routes or project grants. See `docs/team-workbench-backend-contract.md` and `docs/content-model-migration-runbook.md`.
