# Team workbench backend contract

The application has one content model. Organizations are teams; existing workspace rows are map collections. All runtime queries and writes use Asset, Scene and Placement. Migration-only source formats live under `scripts/migrate/content-model/` and `migration_archive`, outside runtime services.

## Ownership and permissions

Every team member reads the team's assets, scenes and collections. Owners, admins and members can create and edit content; viewers only read. Ownership transfer and team administration remain owner/admin operations. A new team starts with zero collections. Assets and scenes can be created before any map exists.

A collection owns placements and tags, not assets, scenes or members. Archiving it stops its public discovery and placement edits without changing team content. The organization archive blocks all content writes. Collection IDs remain the former workspace UUIDs so QR codes continue to identify the same collection.

Asset visibility, maintainer and origin collection are metadata, not permission boundaries. Workspace assignments, asset grants, shared scopes, model-state gates and model-version request headers are removed.

## Routes

| Route | Behavior |
| --- | --- |
| `GET/POST /api/organizations/[id]/assets` | List/create team assets, no collection required |
| `GET /api/collections/[id]/assets` | Team catalog with usability capabilities for this collection |
| `GET/PATCH/DELETE /api/assets/[id]` | Read, edit identity/content, archive; anchors use the same model |
| `GET /api/assets/[id]/usage` | Team-visible scene and placement dependencies |
| `POST /api/assets/[id]/duplicate` | Create a team-owned copy |
| `GET/POST /api/organizations/[id]/scenes` | List/create independent team scenes |
| `GET/PATCH /api/scenes/[id]` | Read/save schema-4 scene with direct asset references |
| `GET/POST /api/organizations/[id]/collections` | List/create collections |
| `GET/PATCH /api/collections/[id]` | Read/rename collection |
| `POST/DELETE /api/collections/[id]/archive` | Archive/restore collection |
| `GET/POST /api/collections/[id]/placements` | List/create independently editable placements; upload-and-place is atomic |
| `GET/PATCH/DELETE /api/placements/[id]` | Read/edit/archive a placement |
| `GET /api/placements/[id]/content` | Current asset content or current scene with current asset files |
| `POST /api/upload` | Upload with explicit team/collection and an actor-bound receipt |
| `GET/POST /api/assets/[id]/matching` | Read/build reference features for the current anchor image |

Old `/api/workspaces/*`, workspace grants/members, asset move/copy adapters and content-model activation endpoints do not exist. Responses are `{ data }` (paged lists add `page`); errors are `{ error, code, details? }`. `lib/content-model/contracts.ts` is the typed contract.

## Consistency

Asset/scene/placement writes require `expectedLockVersion` (428 if missing, 409 if stale). It is a concurrency counter, not an asset content version. Asset PATCH accepts `payload` and `resources` together, replacing both atomically. Creation supports idempotency keys. Scene saves take effect immediately.

Placements target `{kind:"asset", assetId}` or `{kind:"scene", sceneId}`. Scene aliases use `{assetId}` in schema 4. All asset references resolve current content, including every saved scene; asset edits require no placement upgrade or scene publication. Public discovery reads active placements in open teams and collections, with stable placement IDs.

Managed resources come from receipts or authorized `fromAssetId` sources. Receipt purpose is `asset`. Retention checks current resources, live receipts, reference features, derived audio and migration holds. Anchor features use the asset ID; changing its reference image invalidates existing and in-flight descriptors.

The management client refreshes resources after successful mutations, across same-origin tabs and on focus. Scene resource refresh preserves unsaved composition changes and undo history. External clients see edits on their next content fetch.

## Migration and validation

See [content-model-migration-runbook.md](content-model-migration-runbook.md). The SQL baseline describes the final schema; upgrades convert data and remove old tables/columns in one transaction. `migration_archive` retains evidence without serving application reads.

Focused checks: `test-single-content-model-migration.ts`, `test-mutable-assets-migration.ts`, `test-content-model-services.ts`, `test-team-workbench-routes.ts`, `test-content-model-contracts.ts`, `test-scene-add-model.ts`. UI checks are typecheck, lint, production build and Storybook build.
