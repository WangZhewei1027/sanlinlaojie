# Team workbench — backend contract

Status: **implemented and independently accepted by Codex** (2026-10-17). This is
the backend half of the team-workbench refactor: the organization (UI: 团队) is
the only tenant, ownership and permission boundary. Assets and scenes belong
to the organization directly; workspace rows survive only as storage for
**map collections (合集)**, which own placements. The final migration has been
applied to the local 55432 development database after isolated validation;
production has not been changed. Final integrated evidence is in §8.

## 1 Permission model (server rules, every organization state)

| Caller | Read | Write team content (assets, versions, scenes, publish, placements, collections) | Ownership / team admin |
| --- | --- | --- | --- |
| super_admin | everything (unchanged bypass) | everything | everything |
| org owner / admin | every asset, scene, collection and placement of the org | yes | yes (maintainer transfer, members, roles) |
| org member | same as owner/admin | yes | no |
| org viewer | same as owner/admin | **no** (403 `FORBIDDEN`) | no |
| not a member | content ids (asset, scene, collection, placement) answer **404**; organization-scoped routes (`/api/organizations/[id]/…`) answer **403** for an existing org | no | no |

- `workspace_assignment`, `asset_workspace_grant` and asset `visibility` are not
  permission inputs. Existing rows stay as history; new commands never create
  grants or assignments (asset create, duplicate, scene save/copy, placement,
  anonymous mini-program text, invitations, batch registration).
- `maintained_by` is responsibility metadata (creator by default). Any writer
  edits, versions, archives and restores; changing `maintainedBy` stays owner/admin.
- An archived organization is read-only. An archived collection keeps its
  placements read-only and stops their public entries; team assets and scenes
  are never changed by archiving a collection.
- Any same-team AssetVersion or SceneRevision can be placed into any open
  collection by a writer; a scene is never copied to be placed elsewhere.
  Archived assets/scenes still accept no *new* references; existing pinned
  references keep working.
- Unchanged: fixed AssetVersions, immutable SceneRevisions, `expectedLockVersion`
  (428 missing / 409 stale), idempotency keys, actor+org-bound receipts,
  retention/object locks, `assertV2Writable`, `X-Content-Model: 2` on reused
  legacy paths, the readonly cutover window, legacy public ids, anchors (an
  anchor is only usable in the collections its `workspace_id` lists) and tags
  (per collection).
- New references and archiving serialize on the asset row (`FOR SHARE` in
  `ensureAssetUse` vs `FOR UPDATE` when archiving); the grant advisory lock is gone.

`lib/permissions.ts` (client-safe) mirrors this: new key `org.collections.manage`
(owner/admin/member); `teamProjectRole(orgRole)` (owner/admin → `manager`,
member → `editor`, viewer → `viewer`); `effectiveProjectRole(orgRole, _assignment?)`
now ignores the assignment (deprecated alias). `org.workspaces.*` keys are unchanged.

## 2 Changed DTO fields (`lib/content-model/contracts.ts`)

| Type / field | Before | Now |
| --- | --- | --- |
| `SceneSummaryDto.workspace_id` (and `SceneDetailDto`) | `string` | `string \| null` — legacy origin collection only; `null` for team scenes |
| `UploadReceiptDto.workspace_id` | `string` | `string \| null` |
| `DependencyItem` `scene_draft` / `scene_revision` `.workspace_id`, `.workspace_name` | `string` | `string \| null` (scene origin); `placement` items keep `string` |
| `PlacementTargetDto` (`scene_revision`) `.scene_workspace_id` | `string` | `string \| null` |
| `DuplicateAssetRequest.targetWorkspaceId` | required | optional — absent = team-owned copy, no origin collection |
| `CopySceneRequest.targetWorkspaceId` | required | optional — absent = copy inside the same team, `workspace_id: null` |
| `AssetListQuery.view` | default `shared`; `all` owner/admin only | default **`all`**; every member may use every view; `shared` = visibility `organization`, `maintained` = maintained by me (metadata filters) |
| `ContentErrorCode` | — | adds `DEPRECATED` (HTTP 410); `GRANT_REQUIRED` stays in the union but is no longer emitted |
| `WorkspaceDto.project_role` | assignment-derived | team-derived (deprecated; prefer `capabilities`) |
| `WorkspaceCapabilities` | project roles | `can_read` = member; `can_edit` = writer and collection/org open; `can_archive` = writer and org open (also when archived, for restore); `can_manage_members`, `can_assign_manager` always `false` |
| `AssetCapabilities.can_maintain` | maintainer or owner/admin | any writer, org open; `can_transfer_maintainer` owner/admin; `can_use_in_workspace` = writer, collection open, asset active |
| `SceneCapabilities` | collection role | writer and org open (`can_edit`/`can_publish` also need the scene active) |
| `AssetDto.visibility` | access control | metadata only; new assets and duplicates default to `organization` |
| `AssetGrantDto`, `AssetDetailDto.grants`, `AssetUsageDto.grants` | live ACL | read-only history, always an array; `workspace_name`/`dependency_count` are set for members |
| `DependencyImpact.restricted_count` | hidden items | `0` for members (every same-team dependency is listed) |
| `WorkspaceMembersDto` | membership | read-only: every team member, `implicit: true`, `candidates: []` |
| `UploadResponse.data` | when `workspace_id` sent | when `organization_id` or `workspace_id` sent |

New exported types: `CreateOrganizationAssetRequest` (`CreateAssetRequest`
without `placement`), `CollectionState`, `CreateCollectionRequest { name, description? }`,
`UpdateCollectionRequest { name?, description? }` (`description` accepts `null`).

## 3 HTTP routes

New (all `{ data }` envelopes; failures `{ error, code, details? }`; no `X-Content-Model` header required):

| Route | Body / query | Response |
| --- | --- | --- |
| `POST /api/organizations/[id]/assets` | `CreateOrganizationAssetRequest` (`idempotencyKey` required; `placement` → 400) | 201 `{ data: CreateAssetResult }` (`placement: null`), replay 200 |
| `GET /api/organizations/[id]/scenes` | `?state=active\|archived\|all` (default `all`) | `{ data: SceneSummaryDto[] }` |
| `POST /api/organizations/[id]/scenes` | `CreateSceneRequest` | 201 `{ data: SceneDetailDto }` (`workspace_id: null`) |
| `GET /api/organizations/[id]/collections` | `?state=active\|archived\|all` (default **`active`**) | `{ data: WorkspaceDto[] }` (newest first) |
| `POST /api/organizations/[id]/collections` | `{ name, description? }` (unknown fields → 400) | 201 `{ data: WorkspaceDto }` |
| `GET /api/collections/[id]` | — | `{ data: WorkspaceDto }` |
| `PATCH /api/collections/[id]` | `{ name?, description? }` — open collection only (archived → 409 `ARCHIVED`) | `{ data: WorkspaceDto }` |
| `POST` / `DELETE /api/collections/[id]/archive` | — | archive / restore → `{ data: WorkspaceDto }` |

Collection mutations are refused with 423 `CONTENT_MODEL_READONLY` during a cutover
freeze and 409 `ARCHIVED` in an archived organization; they are allowed in
legacy, preparing and v2 organizations.

Changed:

| Route | Change |
| --- | --- |
| `GET /api/organizations/[id]/assets` (v2 header) | every same-team asset; `view` default `all`. Public mini-program submissions (`origin: public_submission`) are team assets — filter with `origin=team_upload` to hide them |
| `GET /api/workspaces/[id]/assets` (v2 header) | the same team catalog (no grants needed) with `capabilities.can_use_in_workspace` for that collection |
| `POST /api/workspaces/[id]/assets` (v2 header) | writer + open collection; records `origin_workspace_id`; optional placement there; no grant |
| `POST /api/upload` | multipart `organization_id` and/or `workspace_id`; see §4 |
| `GET /api/assets/by-hash` | `organization_id` and/or `workspace_id` (same resolution as upload); the probe only searches the caller's team |
| `PATCH`/`DELETE /api/assets/[id]`, `POST /api/assets/[id]/versions` | any writer, not only the maintainer |
| `POST /api/assets/[id]/duplicate`, `POST /api/scenes/[id]/copy` | `targetWorkspaceId` optional (must be an open same-team collection when given; other team → 404) |
| `GET/PATCH /api/scenes/[id]`, `/publish`, `/revisions` | organization-scoped; no collection needed; publishing with `updatePlacements` checks each placement's collection |
| `GET /api/workspaces/[id]/scenes` | lists **every team scene** (compatibility) |
| `POST /api/workspaces/[id]/scenes` | creates a team scene whose `workspace_id` records that collection as origin |
| `GET /api/workspaces` | every collection of every organization the caller belongs to (no assignment filter); super_admin unchanged |
| `POST /api/workspaces`, `PUT /api/workspaces/[id]` | any writer (was owner/admin); response `data` is now a `WorkspaceDto`; renaming an archived collection → 409 |
| `DELETE /api/workspaces/[id]` | unchanged: owner/admin, only an empty row; anything referencing it (legacy rows, historical grants, origin scenes, placements, legacy scopes) → 409 |
| `POST/DELETE /api/workspaces/[id]/archive` | any writer (alias of the collection archive) |
| `GET /api/workspaces/[id]/members` | read-only compatibility view (see §2) |
| `PUT/DELETE /api/workspaces/[id]/members` | **410 `DEPRECATED`** |
| `POST/DELETE /api/assets/[id]/workspace-grants` | **410 `DEPRECATED`** |
| `POST/DELETE /api/users/[id]/workspaces` | **410** `{ error, code: "DEPRECATED" }`; `GET` returns assignment history (owner/admin, super_admin) |
| `POST /api/invitations/[token]` | joins the organization only; `workspace_id` is still returned for navigation, no assignment is written |
| `GET /api/organizations/[id]/placements` | every placement of the organization |
| `GET /api/placements/[id]` and `/content` | readable by every team member; `?workspace_id=` is only a view context: another collection with an active legacy scope gives the read-only shared view, an unrelated/foreign context is 404 |
| `/api/tags` | every collection's tags are readable by members, writable by writers |
| `POST /api/admin/clean` (`clean-rows`) | a collection's files = legacy rows + versions its placements pin directly or through scene revisions (+ historical grants) |
| `POST /api/organizations` (super_admin) | the new team is created with `content_model_state: "v2"` and no collection |
| `DELETE /api/organizations/[id]` | only an empty team: any collection, team asset, scene or placement → **409** `{ error, code: "DEPENDENCY_CONFLICT", details: { counts } }` (was 400 for workspaces only); checked under the organization row lock, FK violations from a racing write also map to 409; malformed id → 404 |

Unchanged: placement routes (`/api/workspaces/[id]/placements`, `/api/placements/*`),
mini-program APIs and their `p_workspace_id`/`p_organization_id` parameters,
QR `organizationId`/`workspaceId`, legacy public ids, location/tag/anchor semantics.

## 4 Upload (`POST /api/upload`) and hash probe

Multipart `file`, `type?`, `purpose?`, plus:

| Sent | Behaviour |
| --- | --- |
| `organization_id` only | caller must be a writer of that organization (membership read from the database); receipt `workspace_id: null` |
| `workspace_id` only | organization taken from the collection (old callers); the collection must be open |
| both | the collection must belong to that organization, else 404 |
| neither | old receipt-less behaviour (no dedup), allowed for writers of any organization |

Receipts stay actor + organization bound (`loadCommitReceipts`): another user's
or another team's receipt is 400 `RECEIPT_INVALID`. Dedup and the hash probe
never look outside the organization. `lib/upload/service.ts#uploadToStorage`
accepts `organizationId`. Server helper: `resolveUploadScope` in
`lib/upload/receipts.server.ts`.

## 5 Database migration

File: `db/migrations/20261017120000_team_workbench.sql` (forward-only, additive;
`db/schema.sql` carries the same structures and records it in `schema_migrations`).

1. `scene.workspace_id` drops `not null` (origin metadata; composite FK kept, so
   a non-null origin is a same-organization collection and blocks hard deletion);
   index `scene_organization_idx (organization_id, updated_at desc)`.
2. `upload_receipt.workspace_id` drops `not null`; new `upload_receipt_organization_fk`;
   `upload_receipt_workspace_fk` becomes `on delete set null (workspace_id)` so
   deleting a collection keeps in-flight leases.
3. Index `placement_organization_idx (organization_id)`.
4. `get_user_workspaces(uuid)` returns every collection of the user's organizations.
5. Direct tenant FK `scene_organization_fk (organization_id) → organization(id)` (no action):
   the composite collection FK is skipped for team scenes (`workspace_id` null), so
   without it an organization holding only scenes could be deleted.
6. `handle_new_user()`: a new sign-up's personal team is created with
   `content_model_state = 'v2'` (and `content_model_changed_at`) and **no default
   workspace**. Existing organizations keep their state; the column default stays
   `'legacy'`; no organization is bulk-changed. Teams created through
   `POST /api/organizations` are v2 with no collection as well.

No row is rewritten; assignments, grants, visibility and `maintained_by` values are
untouched. `lib/db/types.ts`: only `Scene.workspace_id` and `UploadReceipt.workspace_id`
become `string | null` (generated with kysely-codegen against the isolated DB;
the generator's PostGIS view entries were not added).

**Order:** apply the migration before deploying this code (the new code writes
`null` into both columns). The previous code keeps working on the migrated schema.

## 6 Claude implementation validation (isolated container `127.0.0.1:55439`)

Databases owned by this work (recreated for the final run; existing `content_*`
databases and the 55432 development database were not touched during this phase):
`team_wb_services` and `team_wb_migration` (fresh baseline), `team_wb_upgrade_clone`
(`create database … template content_local_cutover_1017`). `DATABASE_URL` is always
passed explicitly (`postgres://postgres:<container password>@127.0.0.1:55439/<db>`);
no script loads `.env`.

Reproduction (password read from the container env without printing it):

```bash
PGPASS=$(docker exec sanlin-content-model-verify-1015 printenv POSTGRES_PASSWORD)
U="postgres://postgres:${PGPASS}@127.0.0.1:55439"
DATABASE_URL=$U/team_wb_services npx tsx scripts/db/migrate.ts           # fresh baseline
DATABASE_URL=$U/team_wb_upgrade_clone npx tsx scripts/db/migrate.ts      # upgrade: applies only 20261017120000
DATABASE_URL=$U/team_wb_services npx tsx --conditions react-server scripts/test-content-model-services.ts
DATABASE_URL=$U/team_wb_services npx tsx --conditions react-server scripts/test-team-workbench-routes.ts
DATABASE_URL=$U/team_wb_services npx tsx --conditions react-server scripts/test-upload-dedup.ts
DATABASE_URL=$U/team_wb_migration npx tsx scripts/db/migrate.ts && \
  DATABASE_URL=$U/team_wb_migration npx tsx --conditions react-server scripts/test-content-model-migration.ts
```

| Check | Command | Result |
| --- | --- | --- |
| Fresh baseline | `npx tsx scripts/db/migrate.ts` on `team_wb_services` / `team_wb_migration` | applied; `schema_migrations` lists the new file |
| Upgrade on real cut-over data | same on `team_wb_upgrade_clone` | only the new file applied; counts (56 orgs / 56 v2 / 81 workspaces / 2,038 assets / 2,033 versions / 3 scenes / 4 revisions / 1,951 placements / 1,949 bindings) and md5 of every `organization`, `workspace`, `asset`, `asset_version`, `asset_version_resource`, `scene`, `scene_revision`, `placement` row identical before/after; `handle_new_user` and the touched constraints/indexes match the fresh baseline |
| Service integration (43 groups) | `test-content-model-services.ts` (`team_wb_services`) | 43/43 pass (T21: a real `auth.users` insert yields a v2 personal team with zero collections, team content works there, a scene with an unknown org and deleting an org that holds only a scene both fail with 23503); fixtures removed afterwards; lock-wait barriers use `pg_blocking_pids` (T14, T08 archive race) |
| In-process route contract (11 groups) | `test-team-workbench-routes.ts` (`team_wb_services`) | 11/11 pass (R10 clean-rows from placements/scene revisions without grants; R11 super-admin team creation → v2 + zero collections, delete 409 for content / scene-only team, 200 for an empty team); real route handlers, only session and OSS replaced by doubles installed by `scripts/test-support/install-route-stubs.ts`; no Next server or `.next` |
| Upload dedup (isolated) | `test-upload-dedup.ts` (`team_wb_services`) | pass: same-team reuse across collections and organization-only uploads writes no new object, no cross-team reuse, outsider/viewer/anonymous denied, hash probe team-scoped. Fails closed without an explicit 55439 URL (verified exit 1) and asserts the OSS double before any request |
| Legacy→v2 migration tooling | `npx tsx --conditions react-server scripts/test-content-model-migration.ts` and `--snapshot-guard-only` (`team_wb_migration`) | pass |
| Real-data read smoke | ad-hoc read-only script on `team_wb_upgrade_clone` | 160 memberships / 56 teams: catalog, scenes, collections, placements, details and usage read; capability flags match §1 |
| Pure suites | `test-content-model-contracts`, `-url-resources`, `-altitude`, `-legacy-anchor`, `-legacy-animations`, `test-scene-add-model`, `-authoring`, `-interactions`, `test-scene-asset` | pass |
| Typecheck / lint | `npx tsc --noEmit`; `npx eslint lib app/api scripts` | 0 errors (one pre-existing warning in `lib/upload/config.ts`) |

Coverage includes: zero-collection team authoring (receipt → asset → scene →
publish → version → copy/duplicate, no workspace created), an assignment-free
member reading/editing/versioning/reusing formerly restricted content, viewer
read-only on every write, cross-org denial, collection create/rename/archive/
restore (team content fingerprint unchanged, runtime entries stop and return),
one SceneRevision in two collections with independent placements, pinned
versions unchanged after updates, receipt actor/org validation, lock conflicts
(428/409), archive-vs-new-reference serialization, retired 410 endpoints,
invitations without assignments, and mini-program nearby/scene/shop/anchor/text
compatibility with legacy public ids.

Not run during the Claude backend phase: `scripts/test-content-model-http.ts` (needs a Next server on :13000;
expectations updated to the team model, asserts the zero-collection v2 personal
teams before creating its own collections; guard also accepts `team_wb_http`),
`test-scene-editor-api.ts` (stale legacy smoke that loads `.env.local` and targets
localhost:3000 / the 55432 dev DB — do not run it), `test-content-model-audit.ts`
(pre-v2 schema fixture). The former `test-upload-dedup.ts` (localhost:3000 sign-up,
unmanaged example.test URLs, could reach real OSS) is replaced by the isolated
version above; never invoke the old form. The services guard also accepts `content_services`,
which needs this migration first. `npm run build`, Storybook and the HTTP smoke
were subsequently run by Codex; see §8.

## 7 Frontend integration notes

- `SceneDetailDto.workspace_id` is `null` for team scenes; the scene editor must
  not hide the asset library or the publish dialog on `null` (at b85d914 it did).
- Version uploads should send `organization_id` (no collection needed) instead
  of deriving a workspace from `origin_workspace_id`/grants.
- Asset lists: `view: "shared"` now only filters by visibility metadata; use the
  default (`all`). Use `origin=team_upload` to exclude mini-program submissions.
- Remove calls to the retired endpoints (410): project members PUT/DELETE,
  workspace-grants, `/api/users/[id]/workspaces` POST/DELETE.
- Error messages say “合集”. `GRANT_REQUIRED` is no longer produced; handle `DEPRECATED`.
- `scripts/test-content-model-resource-presentation.ts` imports
  `app/manage/lib/content-mappers.ts`, which now pulls client navigation; run it
  without `--conditions react-server`.
- Current architecture, product, API and permissions docs use the team model.
  Historical role/refactor plans are superseded by this contract and `docs/team-workbench.md`.
- New sign-ups and super-admin-created teams are v2 with **zero collections**; the
  UI must handle an empty collection list on first login (no default workspace).
- `DELETE /api/organizations/[id]` now answers 409 `DEPENDENCY_CONFLICT` (with
  counts) instead of 400 when a team still holds content or collections.

## 8 Codex integrated acceptance

On 2026-10-17, Codex independently reran the service suite (43/43), route suite
(11/11), safe upload dedup test, typecheck, full lint (0 errors / 21 warnings),
production build (including syntax checks for 212 client bundles) and Storybook
build (298 stories). All passed.

A fresh `team_wb_http` database was created on :55439. The built application ran
on 127.0.0.1:13001 because :13000 belonged to an existing validation server.
`CONTENT_HTTP_ORIGIN=http://127.0.0.1:13001` selects this allowlisted loopback
origin in `scripts/test-content-model-http.ts`; `DATABASE_URL` remains explicit.
The real HTTP smoke passed with authentication, team permissions, cross-team
denial, fixed revisions, locks, collection routes and mini-program manifests.
Rapid fixture sign-ins respect Better Auth's Retry-After window rather than
disabling its rate limit.

Browser acceptance covered zero-collection asset/scene creation, model editing,
saving and publishing, two-team switching and resource-owned URL correction,
collection creation and placement, archive/read-only behavior and immediate
restoration of editing. The model was served from a temporary local GLB fixture;
no object-storage upload was needed for these browser checks.

Only `20261017120000_team_workbench.sql` was applied to the local :55432
database. The 56 existing teams retained their state, there are no orphan scenes,
and the new tenant FK is present. Before/after snapshots retained all 2,038 asset
IDs, 2,033 immutable versions, 5 scenes / 5 immutable revisions, 1,952 placements
and 81 collections. Version hashes and placement source/spatial/render fields
were unchanged. No production migration or deployment was performed.

After acceptance, the owned :13001 server, temporary public GLB, disposable
credentials and four newly created `team_wb_*` validation databases were removed.
Existing :3000/:13000 servers and `content_*` databases were left intact.
Recreate the named validation database and apply the baseline before rerunning
the commands above.
