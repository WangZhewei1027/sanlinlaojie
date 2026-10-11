## Copilot Instructions

Read `CLAUDE.md` (architecture, commands, conventions) and `AGENTS.md` first; topic-specific rules live in `.github/instructions/*.md`.

## Tech Stack

Next.js 16 (App Router) + React 19 + TypeScript · ShadcnUI/Radix + TailwindCSS · PostgreSQL 17 + PostGIS queried with Kysely (`lib/db`, schema in `db/schema.sql` + `db/migrations/`, types in `lib/db/types.ts`) · Better Auth (`lib/auth`) · Aliyun OSS for media (`lib/storage`, uploads via `POST /api/upload`) · OpenStreetMap / CesiumJS map viewer · self-hosted on Aliyun with Docker Compose.

There is no Supabase and no Supabase MCP: read the schema from `db/schema.sql` / `lib/db/types.ts`. There is no RLS — every permission check is application code (`lib/permissions.ts`, `lib/permissions.server.ts`); see `docs/data-layer.md` and `docs/permissions.md`.
