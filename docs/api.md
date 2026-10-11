# API Documentation

## 匹配点识别 API

新增 `POST /api/miniapp/anchors/recognize?workspace_id=<uuid>`，上传现场图片和 WGS84 GPS，匹配成功后返回匹配点挂载素材。另有管理端 `GET/POST /api/assets/<id>/matching` 特征状态与重建接口。鉴权、字段、配置、响应及小程序接入要求见 [匹配点与小程序混合识别](./anchor-matching.md)。

## Overview

This document describes the user and workspace routes in detail. Other route groups under `app/api/` are not documented here: `admin/{app-config,clean,organizations}`, `assets/{[id],[id]/matching,by-hash,copy,move}`, `auth/[...all]` (Better Auth) and `auth/role`, `errors` and `errors/logs`, `invitations/[token]`, `miniapp/*` (see `docs/miniapp-api.md`), `organizations`, `organizations/[id]` and `organizations/[id]/{assets,invitations,members}`, `organizations/pin`, `tags` and `tags/[id]`, `upload`, `users/{[id]/deletion-preview,by-ids,me,search}`.

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
      "role": "member" // optional, defaults to "member"
    }
    ```
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

### Get Workspace Assets
- **Route**: `/api/workspaces/[id]/assets`
- **Method**: `GET`
- **Description**: Get all assets in a workspace. `POST` on the same route creates an asset (requires `org.assets.write`; this is how `lib/upload/service.ts` writes rows)
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
- **Note**: Assets can belong to multiple workspaces. The `workspace_id` field is an array of UUIDs.
- **Error Handling**:
  - `401`: Unauthorized
  - `500`: Server error

---

## Notes

- All authenticated endpoints require a valid Better Auth session (`getSessionUser()` in `lib/auth/server.ts`; `proxy.ts` only checks for the cookie)
- super_admin endpoints require `users.role = 'super_admin'`; organization-scoped endpoints check `organization_member.role` (`owner | admin | member | viewer`) against the matrix in `lib/permissions.ts` (see `docs/permissions.md`)
- All timestamps are in UTC with timezone (timestamptz)
- UUIDs follow RFC 4122 standard
- Assets with `location IS NULL` are included by the workspace assets endpoint unless `requireLocation=true` is passed
- **Asset Multi-Workspace Support**: The `workspace_id` field in the `asset` table is an array of UUIDs, allowing a single asset to belong to multiple workspaces. When creating assets, pass `workspace_id` as `[uuid]`.
