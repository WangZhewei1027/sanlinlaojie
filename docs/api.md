# API Documentation

## Overview

This document describes all API routes available in the application.

---

## User Management APIs

### List Users
- **Route**: `/api/users`
- **Method**: `GET`
- **Description**: Get a list of all users with their workspace assignments (Admin only)
- **Authentication**: Required
- **Authorization**: Admin only
- **Response Format**:
  ```json
  {
    "data": [
      {
        "user_id": "uuid",
        "name": "string",
        "email": "string",
        "role": "admin|student",
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
  - `403`: Forbidden (not admin)
  - `500`: Server error

### Update User Role
- **Route**: `/api/users/[id]`
- **Method**: `PUT`
- **Description**: Update a user's role (Admin only)
- **Authentication**: Required
- **Authorization**: Admin only
- **Request Parameters**:
  - `id` (path): User ID (UUID)
  - Body:
    ```json
    {
      "role": "admin|student"
    }
    ```
- **Response Format**:
  ```json
  {
    "data": {
      "user_id": "uuid",
      "name": "string",
      "email": "string",
      "role": "admin|student",
      "created_at": "timestamp"
    }
  }
  ```
- **Error Handling**:
  - `400`: Invalid role or trying to modify own role
  - `401`: Unauthorized
  - `403`: Forbidden (not admin)
  - `500`: Server error

### Get User Workspace Assignments
- **Route**: `/api/users/[id]/workspaces`
- **Method**: `GET`
- **Description**: Get all workspace assignments for a user (Admin only)
- **Authentication**: Required
- **Authorization**: Admin only
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
  - `403`: Forbidden (not admin)
  - `500`: Server error

### Add Workspace Assignment
- **Route**: `/api/users/[id]/workspaces`
- **Method**: `POST`
- **Description**: Assign a user to a workspace (Admin only)
- **Authentication**: Required
- **Authorization**: Admin only
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
  - `400`: Missing workspace_id or user already assigned
  - `401`: Unauthorized
  - `403`: Forbidden (not admin)
  - `500`: Server error

### Remove Workspace Assignment
- **Route**: `/api/users/[id]/workspaces`
- **Method**: `DELETE`
- **Description**: Remove a user's workspace assignment (Admin only)
- **Authentication**: Required
- **Authorization**: Admin only
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
  - `401`: Unauthorized
  - `403`: Forbidden (not admin)
  - `500`: Server error

---

## Workspace Management APIs

### List Workspaces
- **Route**: `/api/workspaces`
- **Method**: `GET`
- **Description**: Get a list of all workspaces
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
- **Description**: Create a new workspace (Admin only)
- **Authentication**: Required
- **Authorization**: Admin only
- **Request Body**:
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
  - `403`: Forbidden (not admin)
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
- **Description**: Update workspace information (Admin only)
- **Authentication**: Required
- **Authorization**: Admin only
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
  - `403`: Forbidden (not admin)
  - `500`: Server error

### Delete Workspace
- **Route**: `/api/workspaces/[id]`
- **Method**: `DELETE`
- **Description**: Delete a workspace (Admin only). Cannot delete if workspace contains assets.
- **Authentication**: Required
- **Authorization**: Admin only
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
  - `403`: Forbidden (not admin)
  - `500`: Server error

### Get Workspace Assets
- **Route**: `/api/workspaces/[id]/assets`
- **Method**: `GET`
- **Description**: Get all assets with location data in a workspace
- **Authentication**: Required
- **Request Parameters**:
  - `id` (path): Workspace ID (UUID)
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

- All authenticated endpoints require a valid Supabase session
- Admin endpoints require `role = 'admin'` in users table
- All timestamps are in UTC with timezone (timestamptz)
- UUIDs follow RFC 4122 standard
- Assets with `location IS NULL` are excluded from workspace assets endpoint
- **Asset Multi-Workspace Support**: The `workspace_id` field in the `asset` table is an array of UUIDs, allowing a single asset to belong to multiple workspaces. When creating assets, pass `workspace_id` as `[uuid]`.
