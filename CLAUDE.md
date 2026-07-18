# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The **sanlinlaojie web platform** — a Next.js management console + Web AR experience for the 三林老街 (Sanlin Old Street) AR cultural-heritage project. The root `README.md` describes a larger monorepo that also contains a WeChat mini-program (`xr-frame-plant-trees/`); **that sibling project is not in this repo**. Everything here is the web side. Both sides share one Supabase backend, so DB schema changes here affect the mini-program too.

## Commands

```bash
npm run dev     # dev server on localhost:3000
npm run build   # production build (also the way to typecheck the whole app)
npm run lint    # eslint (flat config, eslint.config.mjs)
npm start       # serve production build
```

There is no test suite. `npm run build` is the closest thing to a full correctness gate (TS is `strict`). Path alias: `@/*` → repo root.

Two utility scripts run with a TS runner directly (not wired into package.json): `scripts/batch-register-users.ts` (bulk user creation) and `scripts/transcode-webm-to-m4a.ts` (audio transcode). `scripts/clean-i18n.py` prunes unused i18n keys.

## Architecture

Next.js 15 App Router + React 19 + TypeScript. UI is ShadcnUI/Radix + Tailwind (`components.json`, `components/ui/`). State via Zustand.

### Supabase: four client factories, pick by context

- `lib/supabase/client.ts` — browser (anon/publishable key), for Client Components.
- `lib/supabase/server.ts` — RSC/route handlers (cookie-based session). **Create a new client per request; never hoist to a global** (Fluid compute).
- `lib/supabase/admin.ts` — `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS. **Server-only**; use sparingly and only after an explicit permission check.
- `lib/supabase/proxy.ts` — `updateSession()` is called from `proxy.ts` at the repo root, which is the Next.js **middleware** entry point (the file is named `proxy.ts`, not `middleware.ts`). It refreshes the session and does auth gating. Public (no-login) path prefixes: `/`, `/auth`, `/login`, `/invite`, `/api/errors`. Everything else redirects to `/auth/login` when logged out.

### Two-tier permission system

Read `lib/permissions.ts` before touching any access-control code.

- **Tier 1 — global role** (`users.role`): `super_admin` | `user`. super_admin bypasses org checks everywhere.
- **Tier 2 — org role** (`organization_member.role`): `owner` | `admin` | `member` | `viewer`, resolved per-organization.
- `lib/permissions.ts` is a **pure, client-safe** permission matrix (`hasOrgPermission`, `hasGlobalPermission`, `isSuperAdmin`, `isSidebarItemVisible`). No DB access — safe to import in Client Components for UI gating.
- `lib/permissions.server.ts` does the **DB lookups** (`getUserContext`, `getWorkspaceOrgId(s)`). Server-only.
- Standard API-route pattern: `supabase.auth.getUser()` → 401 if none → `getUserContext()` → gate with `isSuperAdmin` / `hasOrgPermission`. See `app/api/assets/move/route.ts` for the canonical example (also shows batching writes into one RPC to avoid N requests).

UI gating (sidebar, buttons) uses the pure matrix; **it is not a security boundary** — every mutating API route must re-check server-side.

### The /manage map workspace (core, non-obvious)

`/manage` is the main product surface: an interactive 3D map for placing/managing geo-located AR assets. Its architecture is split:

- **React side** owns state and chrome. `app/manage/store.ts` is a persisted Zustand store holding the selected organization/workspace, asset list, filtered assets, clicked location, and multi-select set.
- **The 3D map itself is NOT React.** It's a standalone vanilla-JS app under `public/js/viewer/` (served statically) loaded in an `<iframe src="/js/viewer/index.html">` via `app/manage/components/ViewerFrame.tsx`.
- React ↔ iframe communicate over **`postMessage`**, bridged in `app/manage/hooks/useViewerMessaging.ts`. React posts `SET_ORIGIN` (org `map_center`) and the asset list down; the viewer posts back map clicks, asset selection/box-select, and drag-move coordinates. When changing map behavior, decide which side owns it — editing `public/js/viewer/` (plain JS/Cesium) vs. the React hooks/store.

`ALL_WORKSPACES_ID = "__all__"` (`app/manage/constants.ts`) is a sentinel distinguishing "user cleared the workspace filter (operate at org scope)" from `null` ("no choice yet — auto-pick first"). Use `isSpecificWorkspaceId()` to test for a real workspace UUID.

### Upload module (`lib/upload/`)

Config-driven, extensible. `FILE_TYPE_CONFIGS` (`config.ts`) maps each `UploadType` (image/video/audio/document/link/text) to accept rules, max size, and optional `process` / `extractMetadata` hooks. `FileUploadService` (`service.ts`) processes → uploads to **Cloudinary** → saves to DB. Images auto-compress to WebP and pull GPS from EXIF (`lib/exif-reader.ts`); audio compresses via `lib/audio-compression.ts`. Location priority: EXIF GPS > user map-click. To add a file type, extend `types.ts` + `config.ts` (see `lib/upload/README.md`).

### Other subsystems

- **i18n**: `react-i18next`, initialized in `lib/i18n/config.ts`. Default `zh`, fallback `en`; language persisted in `localStorage`. Strings live in `locales/zh.json` / `locales/en.json`. Long-form instruction pages use MDX under `app/instructions/{zh,en}` (`@next/mdx`, `mdx-components.tsx`).
- **Error logging**: `lib/log-error.ts` — `logError`/`logErrorSafe` are **fire-and-forget, never throw**; they insert into the `error_log` table. API catch-blocks call these. Surfaced at `/super-admin/error-logs`.
- **SMS / phone auth**: `lib/auth/sms.ts` uses Alibaba Cloud Dypnsapi (号码认证服务) for phone register/login/reset. AccessKey via Alibaba default credential chain; sign-name/template fall back to defaults if env unset.
- **WeChat QR codes**: `app/manage/actions/wechat-qr.ts` (server action) generates QR codes that deep-link the mini-program to a specific org/workspace.

### Database

Supabase Postgres + **PostGIS** (assets carry geo coordinates). Migrations in `supabase/migrations/` (timestamped SQL). Note the table names are **singular** in places (`workspace`, `organization_member`) and don't all match the README — **do not trust doc/README table names; get the live schema via the Supabase MCP tools** (`list_tables`) before writing queries. Some batch operations are Postgres RPC functions (e.g. `move_assets`) invoked from API routes rather than raw table writes.

## Environment

`.env.local` (see the file for the full list): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_*`, `WECHAT_APPID`/`WECHAT_APPSECRET`, `ALIBABA_CLOUD_*` + `ALIYUN_SMS_*`.

## Component placement convention (from README)

- Reused across routes, no business semantics → `components/` (root).
- Serves one route, has a business name → `app/<route>/components/`.
- < 20 lines and not reused → leave inline.
- A file exceeding ~120 lines should be split.

## Route map

`/` home · `/manage` map workspace (main app) · `/admin/*` org console (members / workspaces / settings / clean) · `/super-admin/*` global console (users / organizations / error-logs) · `/auth/*` auth flows · `/invite/[token]` org invitations · `/upload-onsite` on-site capture. API under `app/api/`.

## Reference docs

Deeper design notes live in `docs/` — notably `docs/permissions.md`, `docs/map-asset-interaction.md`, `docs/asset-pipeline.md`, `docs/i18n-guide.md`, `docs/wechat-qr-code.md`, `docs/3d-model-preview.md`, `docs/audio-compatibility.md`, `docs/asset-storage-lifecycle.md` (content-hash dedup and deletion safety), and `docs/saas-role-refactor.md`.
