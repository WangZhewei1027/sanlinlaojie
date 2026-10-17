# API Documentation

## 匹配点识别 API

新增 `POST /api/miniapp/anchors/recognize?workspace_id=<uuid>`，上传现场图片和 WGS84 GPS，匹配成功后返回匹配点挂载素材。另有管理端 `GET/POST /api/assets/<id>/matching` 特征状态与重建接口。鉴权、字段、配置、响应及小程序接入要求见 [匹配点与小程序混合识别](./anchor-matching.md)。

## Overview

This document covers the content-model APIs and the existing user/workspace routes.
Anonymous playback is documented in [miniapp-api.md](miniapp-api.md); data and
cutover boundaries are in [data-layer.md](data-layer.md). TypeScript request and
response definitions live in `lib/content-model/contracts.ts`; the corresponding
Route Handlers call the shared domain services rather than duplicating writes.

## Content-model V2 APIs

These routes require a session and server-side organization/project/asset
authorization. V2 content writes require an open organization in state `v2`;
`legacy/preparing` retain the old write source, and `readonly` rejects writes.
Applying the schema does not automatically switch an organization. See
[permissions.md](permissions.md) for use versus maintenance rights.

- Requests use camelCase fields; response DTOs use snake_case and server-computed `capabilities`.
- Success is `{ data }`, catalog pages also include `page`; errors are `{ error, code, details? }`.
- Identity/draft/placement changes require `expectedLockVersion`: missing returns 428, stale returns 409. Version append is serialized and accepts an optional expected identity lock.
- Creation commands that accept `idempotencyKey` reuse the first result for the same input; key reuse with different input returns 409. Whether the key is required is declared on the request type.
- AssetVersion and SceneRevision are immutable. `DELETE` on v2 Asset/Placement means archive; it does not delete retained versions or shared files.

| Method and path | Behavior / request type |
| --- | --- |
| `GET /api/organizations/[id]/assets` with `X-Content-Model: 2` | Team catalog: every same-team asset; view=all (default), shared/maintained are metadata filters; supports q/file_type/origin/state/usable_in/limit/offset |
| `POST /api/organizations/[id]/assets` with `X-Content-Model: 2` | `CreateOrganizationAssetRequest`: team asset + v1, no collection, no placement (workbench upload) |
| `GET/POST /api/workspaces/[id]/assets` with `X-Content-Model: 2` | Same team catalog with `usable_in` fixed to that collection / CreateAssetRequest whose origin is the collection, optional Placement; no grant |
| `GET/PATCH /api/assets/[id]` with `X-Content-Model: 2` | Detail with retained versions (grants are read-only history) / identity maintenance by any team writer using expectedLockVersion |
| `DELETE /api/assets/[id]?expectedLockVersion=N` with `X-Content-Model: 2` | Archive Asset and return dependency impact; Anchor uses its dedicated compatibility service |
| `GET /api/assets/[id]/versions` | Versions, newest first; requires Asset read access |
| `POST /api/upload` | Multipart file, `organization_id` and/or `workspace_id` (collection), optional type/purpose; team writer; returns legacy url/contentHash/storagePath plus data: UploadReceiptDto (`workspace_id` null for team uploads) |
| `DELETE /api/upload?key=…` | End this uploader's unused lease and request protected cleanup; may return removed=false, reason=deferred |
| `POST /api/assets/[id]/versions` | `CreateAssetVersionRequest`: payload, resources, idempotencyKey, optional expectedLockVersion; any team writer |
| `GET /api/assets/[id]/usage` | Every same-team dependency (`restricted_count` is 0) |
| `POST /api/assets/[id]/duplicate` | `DuplicateAssetRequest`: optional targetWorkspaceId (omit for a team copy), optional sourceVersionId/name, idempotencyKey; new Asset identity |
| `POST/DELETE /api/assets/[id]/workspace-grants` | Retired: 410 `DEPRECATED` |
| `GET/POST /api/organizations/[id]/scenes` | Team scenes (`state=active|archived|all`, default all) / create a team Scene; import document must be schema 3 |
| `GET/POST /api/workspaces/[id]/scenes` | Compatibility adapter: the same team list / team Scene whose `workspace_id` records the origin |
| `GET/PATCH /api/scenes/[id]` | Draft and pinned resources / `SaveSceneRequest` with mandatory expectedLockVersion |
| `POST /api/scenes/[id]/publish` | `{ expectedLockVersion, updatePlacements?: [{ placementId, expectedLockVersion }] }`; freezes the requested draft and optionally updates selected existing placements |
| `GET /api/scenes/[id]/revisions` | Retained published versions, newest first |
| `POST /api/scenes/[id]/copy` | New editable team Scene; optional targetWorkspaceId (origin metadata) |
| `GET/POST /api/workspaces/[id]/placements` | List or create fixed target; `include_shared=false` hides legacy shared scopes; optional status filter |
| `GET /api/organizations/[id]/placements` | Every collection of the team, de-duplicated |
| `GET/POST /api/organizations/[id]/collections` | Map collections (`state`, default active) / `{ name, description? }` → WorkspaceDto |
| `GET/PATCH /api/collections/[id]` | One collection / `{ name?, description? }` |
| `POST/DELETE /api/collections/[id]/archive` | Archive / restore a collection; its placements become read-only, team content is untouched |
| `GET/PATCH /api/placements/[id]` | Read or edit Placement; optional GET workspace_id supplies shared viewer context |
| `GET /api/placements/[id]/content?workspace_id=…` | PlacementContentDto: only the pinned playable AssetVersion or SceneRevision; authorized through the placement, without source catalog/history access |
| `DELETE /api/placements/[id]?expectedLockVersion=N` | Archive this placement |
| `POST /api/placements/move` | Atomic batch of `{ placementId, expectedLockVersion, longitude, latitude, altitude? }` |
| `POST /api/placements/[id]/copy` | New independent placement; optional targetWorkspaceId, location/offset and idempotencyKey |
| `GET /api/workspaces/[id]/members` | Read-only compatibility view (every team member, implicit); PUT/DELETE answer 410 `DEPRECATED` |
| `POST/DELETE /api/workspaces/[id]/archive` | Alias of the collection archive; any team writer |
| `GET /api/organizations/[id]/content-model` | State, legacy count and capabilities |
| `PUT /api/organizations/[id]/content-model` | Super-admin initialization with `{ state, expectedState, note? }`; only legacy → v2 for an organization with no legacy Asset rows |

Publishing with placement updates requires a lock version for the Scene and
each selected Placement; all changes commit together. The former
`updatePlacementIds` field is rejected with 428 `LOCK_VERSION_REQUIRED`, even
when the Scene lock is present. At most 100 distinct placements may be updated.

The content-model PUT checks `expectedState` and permits a same-state no-op.
It cannot switch an organization with legacy data, enter preparing/readonly,
or roll back a v2 organization. Those operations use the audited migration
scripts under `scripts/migrate/content-model/`.

An explicit placement viewer project must be its owning project or a readable,
active legacy scope in the same organization. Source-project access does not
make an unrelated viewer context valid. The fixed-content endpoint exposes no
current-version hints, grants, source drafts or version history.

`GET /api/assets/by-hash?workspace_id=…&hash=…` requires target-project edit
permission. Its hash-only probe resolves only usable active asset versions,
readable legacy sources or the caller's own unexpired receipts. Actual-byte
upload dedup remains organization-scoped; knowing a hash alone does not grant
access to someone else's restricted file or pending upload.

Placement target is a discriminated union:

```json
{ "kind": "asset_version", "assetVersionId": "<uuid>" }
```

or `{ "kind": "scene_revision", "sceneRevisionId": "<uuid>" }`. A placement
never targets a draft or a mutable current pointer. Active non-Shop placements
need a supported GPS/Anchor discovery path; an empty Scene cannot become an
active placement. Requests that create an Asset and its Placement are committed
as one command.

Version resource inputs use `receiptId`, authorized `fromVersionId/fromRole`,
or a validated external URL. Arbitrary managed file URLs are rejected. Receipts
bind the uploader, organization, key and purpose, and protect in-flight files.
See [asset-storage-lifecycle.md](asset-storage-lifecycle.md).

The upload response is intentionally compatible with the old top-level fields.
V2 callers must supply a project and keep `data.id` as the receipt reference.
The legacy no-workspace upload fallback does not issue a receipt and cannot
feed a v2 version; it requires edit access to an available project. Upload
defaults to purpose `asset_version` for v2, `legacy_asset` for legacy, and
`anchor_reference` for Anchor files. The server retains its 5 MiB hard cap.

The shared legacy-path contract uses `X-Content-Model: 2` for v2 administrative
calls to reused paths such as Asset CRUD and project catalogs. New paths above
are v2 by definition. Catalog GETs without the header retain a permission-filtered
legacy projection; after cutover it is compatibility data, not an editable v2
catalog. The header never grants permission or switches an organization; stale
legacy writers receive an upgrade error after cutover. Anchor retains its
dedicated field shape and service instead of becoming a generic media version.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `LOCK_VERSION_REQUIRED` / `LOCK_VERSION_CONFLICT` | 428 / 409 | Missing or stale edit version |
| `CONTENT_MODEL_NOT_ENABLED` / `CONTENT_MODEL_UPGRADE_REQUIRED` | 409 | Organization not switched / caller uses old administrative contract |
| `CONTENT_MODEL_READONLY` | 423 | Cutover write freeze |
| `DEPENDENCY_CONFLICT` / `ARCHIVED` | 409 | Referenced or archived content prevents the requested operation |
| `GRANT_REQUIRED` | 403 | Target project lacks Asset use authorization |
| `RECEIPT_INVALID` / `UNMANAGED_URL` | 400 | Invalid upload proof or managed URL submitted without authorization |

Legacy user/workspace route details below remain useful for the old request
shape. The legacy Asset array and direct-location fields do not describe v2
ownership or placement.

---

## User Management APIs

### List Users
- **Route**: `/api/users`
- **Method**: `GET`
- **Description**: Get a list of all users with their workspace assignments (super_admin only). `POST /api/users` (super_admin only) creates a user with a password
- **Authentication**: Required
- **Authorization**: super_admin only
- **Response Format**:
  ```json
  {
    "data": [
      {
        "user_id": "uuid",
        "name": "string",
        "email": "string",
        "role": "super_admin|user",
        "created_at": "timestamp",
        "workspace_assignment": [
          {
            "id": "uuid",
            "workspace_id": "uuid",
            "role": "string",
            "created_at": "timestamp",
            "workspace": {
              "id": "uuid",
              "name": "string"
            }
          }
        ]
      }
    ]
  }
  ```
- **Error Handling**:
  - `401`: Unauthorized (no user session)
  - `403`: Forbidden (insufficient permission)
  - `500`: Server error

### Update User Role
- **Route**: `/api/users/[id]`
- **Method**: `PUT`
- **Description**: Update a user's global role (super_admin only). `DELETE /api/users/[id]` (super_admin only) deletes a user; `GET /api/users/[id]/deletion-preview` previews the cascade
- **Authentication**: Required
- **Authorization**: super_admin only
- **Request Parameters**:
  - `id` (path): User ID (UUID)
  - Body:
    ```json
    {
      "role": "super_admin|user"
    }
    ```
- **Response Format**:
  ```json
  {
    "data": {
      "user_id": "uuid",
      "name": "string",
      "email": "string",
      "role": "super_admin|user",
      "created_at": "timestamp"
    }
  }
  ```
- **Error Handling**:
  - `400`: Invalid role or trying to modify own role
  - `401`: Unauthorized
  - `403`: Forbidden (insufficient permission)
  - `500`: Server error

### Get User Workspace Assignments
- **Route**: `/api/users/[id]/workspaces`
- **Method**: `GET`
- **Description**: Get workspace assignments for a user. super_admin sees all; an org owner/admin only sees assignments inside organizations they manage
- **Authentication**: Required
- **Authorization**: super_admin, or owner/admin of at least one organization
- **Request Parameters**:
  - `id` (path): User ID (UUID)
- **Response Format**:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "workspace_id": "uuid",
        "role": "string",
        "created_at": "timestamp",
        "workspace": {
          "id": "uuid",
          "name": "string",
          "description": "string"
        }
      }
    ]
  }
  ```
- **Error Handling**:
  - `401`: Unauthorized
  - `403`: Forbidden (insufficient permission)
  - `500`: Server error

### Add Workspace Assignment
- **Route**: `/api/users/[id]/workspaces`
- **Method**: `POST`
- **Description**: Assign a user to a workspace (idempotent; returns `201`, with `data: null` when the assignment already existed)
- **Authentication**: Required
- **Authorization**: super_admin, or `org.workspaces.edit` (owner/admin) in the workspace's organization
- **Request Parameters**:
  - `id` (path): User ID (UUID)
  - Body:
    ```json
    {
      "workspace_id": "uuid",
      "role": "editor"
    }
    ```
- `role` is optional and defaults to `editor`; accepted project roles are `manager/editor/viewer`. The target must already belong to the organization. An organization viewer always receives project viewer access, even if a higher project role was requested.
- **Response Format**:
  ```json
  {
    "data": {
      "id": "uuid",
      "user_id": "uuid",
      "workspace_id": "uuid",
      "role": "string",
      "created_at": "timestamp"
    }
  }
  ```
- **Error Handling**:
  - `400`: Missing workspace_id
  - `404`: Workspace not found
  - `401`: Unauthorized
  - `403`: Forbidden (insufficient permission)
  - `500`: Server error

### Remove Workspace Assignment
- **Route**: `/api/users/[id]/workspaces`
- **Method**: `DELETE`
- **Description**: Remove a user's workspace assignment
- **Authentication**: Required
- **Authorization**: super_admin, or `org.workspaces.edit` (owner/admin) in the workspace's organization
- **Request Parameters**:
  - `id` (path): User ID (UUID)
  - Query: `?assignment_id=uuid`
- **Response Format**:
  ```json
  {
    "success": true
  }
  ```
- **Error Handling**:
  - `400`: Missing assignment_id
  - `404`: Assignment not found
  - `401`: Unauthorized
  - `403`: Forbidden (insufficient permission)
  - `500`: Server error

---

## Workspace Management APIs

### List Workspaces
- **Route**: `/api/workspaces`
- **Method**: `GET`
- **Description**: Get the workspaces visible to the caller (super_admin: all; others: `get_user_workspaces` — owner/admin see every workspace of their organizations, member/viewer only assigned ones). Optional `?organization_id=uuid` filter
- **Authentication**: Required
- **Response Format**:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "create_date": "timestamp"
      }
    ]
  }
  ```
- **Error Handling**:
  - `500`: Server error

### Create Workspace
- **Route**: `/api/workspaces`
- **Method**: `POST`
- **Description**: Create a new workspace in an organization
- **Authentication**: Required
- **Authorization**: super_admin, or `org.workspaces.create` (owner/admin) in `organization_id`
- **Request Body**:
  ```json
  {
    "organization_id": "uuid",
    "name": "string",
    "description": "string" // optional
  }
  ```
- **Response Format**:
  ```json
  {
    "data": {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "create_date": "timestamp"
    }
  }
  ```
- **Error Handling**:
  - `400`: Name cannot be empty
  - `401`: Unauthorized
  - `403`: Forbidden (insufficient permission)
  - `500`: Server error

### Get Workspace by ID
- **Route**: `/api/workspaces/[id]`
- **Method**: `GET`
- **Description**: Get details of a specific workspace
- **Authentication**: Required
- **Request Parameters**:
  - `id` (path): Workspace ID (UUID)
- **Response Format**:
  ```json
  {
    "data": {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "create_date": "timestamp"
    }
  }
  ```
- **Error Handling**:
  - `500`: Server error

### Update Workspace
- **Route**: `/api/workspaces/[id]`
- **Method**: `PUT`
- **Description**: Update workspace information
- **Authentication**: Required
- **Authorization**: super_admin, or `org.workspaces.edit` (owner/admin) in the workspace's organization
- **Request Parameters**:
  - `id` (path): Workspace ID (UUID)
  - Body:
    ```json
    {
      "name": "string",
      "description": "string" // optional
    }
    ```
- **Response Format**:
  ```json
  {
    "data": {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "create_date": "timestamp"
    }
  }
  ```
- **Error Handling**:
  - `400`: Name cannot be empty
  - `401`: Unauthorized
  - `403`: Forbidden (insufficient permission)
  - `500`: Server error

### Delete Workspace
- **Route**: `/api/workspaces/[id]`
- **Method**: `DELETE`
- **Description**: Delete a workspace. Cannot delete if workspace contains assets.
- **Authentication**: Required
- **Authorization**: super_admin, or `org.workspaces.delete` (owner/admin) in the workspace's organization
- **Request Parameters**:
  - `id` (path): Workspace ID (UUID)
- **Response Format**:
  ```json
  {
    "success": true
  }
  ```
- **Error Handling**:
  - `400`: Workspace contains assets
  - `401`: Unauthorized
  - `403`: Forbidden (insufficient permission)
  - `500`: Server error

### Get Workspace Assets (legacy shape)
- **Route**: `/api/workspaces/[id]/assets`
- **Method**: `GET`
- **Description**: Legacy project assets used by the old map/upload adapter. Server-side project permission and the organization's content-model gate apply; v2 catalog and creation semantics use versioned contracts.
- **Authentication**: Required
- **Request Parameters**:
  - `id` (path): Workspace ID (UUID)
  - Query (optional): `type=<file_type>` filters by type; `requireLocation=true` returns only assets with a location
- **Response Format**:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "file_type": "string",
        "file_url": "string",
        "metadata": {},
        "workspace_id": ["uuid", "uuid"]
      }
    ]
  }
  ```
- **Note**: Legacy Asset rows may contain multiple workspace IDs. This is compatibility data; v2 content belongs to one team, all team members can read it, and location belongs to Placement in a map collection.
- **Error Handling**:
  - `401`: Unauthorized
  - `500`: Server error

---

## Notes

- All authenticated endpoints require a valid Better Auth session (`getSessionUser()` in `lib/auth/server.ts`; `proxy.ts` only checks for the cookie)
- super_admin endpoints require `users.role = 'super_admin'`; content endpoints enforce team roles, resource lifecycle rules and organization write gates (see `docs/permissions.md`). Historical assignments and grants no longer determine access.
- All timestamps are in UTC with timezone (timestamptz)
- UUIDs follow RFC 4122 standard
- In the legacy response, Assets with `location IS NULL` are included unless `requireLocation=true` is passed. V2 geographic filtering belongs to Placement queries.
- Never send `workspace_id: [uuid]` to establish v2 ownership. Team content commands validate membership in the specified organization; collection commands additionally validate that the collection belongs to that team. New commands never create grants.
