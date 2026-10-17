# Team workbench backend contract

The application has one content model. Organizations are teams; existing workspace rows are map collections. All runtime queries and writes use Asset, AssetVersion, Scene, SceneRevision and Placement. Migration-only source formats live under `scripts/migrate/content-model/` and `migration_archive`, outside runtime services.

## Ownership and permissions

Every team member reads the team's assets, scenes and collections. Owners, admins and members can create and edit content; viewers only read. Ownership transfer and team administration remain owner/admin operations. A new team starts with zero collections. Assets and scenes can be created before any map exists.

A collection owns placements and tags, not assets, scenes or members. Archiving it stops its public discovery and placement edits without changing team content. The organization archive blocks all content writes. Collection IDs remain the former workspace UUIDs so QR codes continue to identify the same collection.

Asset visibility, maintainer and origin collection are metadata, not permission boundaries. Workspace assignments, asset grants, shared scopes, model-state gates and model-version request headers are removed.

## Routes

| Route | Behavior |
| --- | --- |
| `GET/POST /api/organizations/[id]/assets` | List/create team assets, no collection required |
| `GET /api/collections/[id]/assets` | Team catalog with usability capabilities for this collection |
| `GET/PATCH/DELETE /api/assets/[id]` | Read, edit identity, archive; anchors use the same model |
| `POST /api/assets/[id]/versions` | Append an immutable version |
| `GET /api/assets/[id]/usage` | Team-visible draft, revision and placement dependencies |
| `POST /api/assets/[id]/duplicate` | Create a team-owned copy |
| `GET/POST /api/organizations/[id]/scenes` | List/create independent team scenes |
| `GET/PATCH /api/scenes/[id]` | Read/save schema-3 draft with pinned version references |
| `POST /api/scenes/[id]/publish` | Freeze a revision; optionally update explicitly named placements with their lock versions |
| `GET/POST /api/organizations/[id]/collections` | List/create collections |
| `GET/PATCH /api/collections/[id]` | Read/rename collection |
| `POST/DELETE /api/collections/[id]/archive` | Archive/restore collection |
| `GET/POST /api/collections/[id]/placements` | List/create independently editable placements; upload-and-place is atomic |
| `GET/PATCH/DELETE /api/placements/[id]` | Read/edit/archive a placement |
| `GET /api/placements/[id]/content` | Only the pinned version/revision and its files |
| `POST /api/upload` | Upload with explicit team/collection and an actor-bound receipt |
| `GET/POST /api/assets/[id]/matching?version_id=…` | Read/build reference features for the specified anchor version |

Old `/api/workspaces/*`, workspace grants/members, asset move/copy adapters and content-model activation endpoints do not exist. Responses are `{ data }` (paged lists add `page`); errors are `{ error, code, details? }`. `lib/content-model/contracts.ts` is the typed contract.

## Consistency

Identity/draft/placement writes require `expectedLockVersion` (428 if missing, 409 if stale). Creation supports idempotency keys; reusing a key with changed input returns 409. Publishing the same draft lock reuses its frozen revision. Every placement pins one AssetVersion or SceneRevision; editing a source creates a new version without upgrading existing placements.

Scene drafts and imports require schema 3. Public playback compiles the pinned document to the mini-program protocol. Public discovery reads only active placements in open teams and collections, using placement IDs. `workspace_id` on a placement read is an optional assertion of its owning collection, not a shared scope.

Managed files are committed through upload receipts or authorized source-version resources. Retention checks immutable resources, live receipts, reference features, derived audio and explicit migration holds. Matching features are keyed by immutable reference version, so two collections may keep different versions of one anchor.

## Migration and validation

See [content-model-migration-runbook.md](content-model-migration-runbook.md). The SQL baseline describes the final schema; upgrades convert data and remove old tables/columns in one transaction. `migration_archive` retains evidence without serving application reads.

Focused checks: `test-single-content-model-migration.ts`, `test-content-model-services.ts`, `test-team-workbench-routes.ts`, `test-content-model-contracts.ts`, `test-scene-add-model.ts`. UI checks are typecheck, lint, production build and Storybook build.
