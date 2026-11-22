# 🌐 Rydora — Communities & Membership API Specification (Milestone 3)

**Domain Lead:** Badal Khandelwal (Identity, Auth & Communities)  
**Version:** 1.0.0 (Post-M3.12 Baseline)  
**Status:** Complete & Verified  

---

## 1. Overview & Architecture

The Communities & Membership module enables university students and corporate employees to discover, create, join, and browse closed community carpooling networks based on verified institutional email domains (e.g., `@srmist.edu.in`).

### Architectural Pipeline
```text
HTTP Request
     │
     ▼
Central Router (`src/routes/index.ts` mounted at `/api/v1`)
     │
     ▼
Community Sub-Router (`src/routes/community.routes.ts`)
     │
     ▼
Authentication Middleware (`src/middleware/auth.ts`) [For Protected Routes]
     │
     ▼
Controller (`src/controllers/community.controller.ts`)
     │
     ▼
Zod Input Validation (`src/validators/communityValidator.ts`)
     │
     ▼
Service Layer (`src/services/community.service.ts`)
     │
     ▼
Prisma 7 Client Singleton (`src/config/prisma.ts`)
     │
     ▼
PostgreSQL Database (Neon Serverless Pool)
```

---

## 2. API Endpoints Summary

| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/communities` | **Yes** (Bearer Token) | Create a new community; creator atomically becomes `ADMIN`. |
| `GET` | `/api/v1/communities` | **No** (Public) | List active communities with search, domain filter & pagination. |
| `GET` | `/api/v1/communities/:communityId` | **No** (Public) | Retrieve community details, active members count & creator info. |
| `POST` | `/api/v1/communities/:communityId/join` | **Yes** (Bearer Token) | Join an eligible active community as `MEMBER`. |
| `GET` | `/api/v1/communities/:communityId/members` | **Yes** (Active Member) | Browse paginated directory of active members for a community. |

---

## 3. Detailed Endpoint Specifications

### 3.1 Create Community (`POST /api/v1/communities`)
Allows an authenticated user to establish a new carpooling community for their university or workplace.

* **Authentication:** Mandatory (`Bearer <jwt>`). User identity is extracted strictly from `req.user.userId`.
* **Request Headers:**
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "name": "SRM Institute of Science and Technology",
    "domain": "srmist.edu.in",
    "description": "Official campus carpooling community"
  }
  ```
  *Validation Rules:*
  - `name`: String, 2–150 characters, trimmed.
  - `domain`: Valid domain syntax (no protocols, IPs, paths, or email `@` signs), 3–255 characters, normalized to lowercase.
  - `description`: String, max 1000 characters, optional/nullable.
  - Strict validation (`.strict()`): Client cannot inject `communityId`, `createdById`, or `status`.
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Community created successfully",
    "data": {
      "community": {
        "communityId": "a1b2c3d4-...",
        "name": "SRM Institute of Science and Technology",
        "domain": "srmist.edu.in",
        "description": "Official campus carpooling community",
        "status": "ACTIVE",
        "createdById": "u1v2w3x4-...",
        "createdAt": "2026-11-22T04:00:00.000Z",
        "updatedAt": "2026-11-22T04:00:00.000Z",
        "membersCount": 1
      }
    },
    "meta": {
      "requestId": "uuid",
      "timestamp": "2026-11-22T04:00:00.000Z"
    }
  }
  ```
* **Error Responses:**
  - `401 Unauthorized`: Token missing or invalid.
  - `409 Conflict`: A community with this domain or name already exists (case-insensitive).
  - `422 Unprocessable Entity`: Missing required fields, invalid domain format, or injected keys.

---

### 3.2 List Communities (`GET /api/v1/communities`)
Enables riders and drivers to browse or search active communities.

* **Authentication:** Public (Open access; authenticated requests also allowed).
* **Query Parameters:**
  - `search`: Substring search on community name (case-insensitive, max 100 chars, optional).
  - `domain`: Exact domain match (case-insensitive, max 255 chars, optional).
  - `page`: Page number (integer >= 1, default: 1).
  - `limit`: Page size (integer 1–100, default: 20).
  - `.strict()`: Unrecognized query keys return `422 Unprocessable Entity`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Communities retrieved successfully",
    "data": {
      "communities": [
        {
          "communityId": "a1b2c3d4-...",
          "name": "SRM Institute of Science and Technology",
          "domain": "srmist.edu.in",
          "description": "Official campus carpooling community",
          "status": "ACTIVE",
          "createdById": "u1v2w3x4-...",
          "createdAt": "2026-11-22T04:00:00.000Z",
          "updatedAt": "2026-11-22T04:00:00.000Z",
          "membersCount": 42
        }
      ]
    },
    "meta": {
      "requestId": "uuid",
      "timestamp": "2026-11-22T04:00:00.000Z",
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1,
        "hasNext": false,
        "hasPrev": false
      }
    }
  }
  ```
* **Error Responses:**
  - `422 Unprocessable Entity`: `page <= 0`, `limit > 100`, `limit < 1`, or invalid query keys.

---

### 3.3 Community Details (`GET /api/v1/communities/:communityId`)
Returns detailed information for a single community, including active membership count and public creator info.

* **Authentication:** Public (Open access).
* **Route Parameters:**
  - `:communityId`: Valid UUID string.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Community retrieved successfully",
    "data": {
      "community": {
        "communityId": "a1b2c3d4-...",
        "name": "SRM Institute of Science and Technology",
        "domain": "srmist.edu.in",
        "description": "Official campus carpooling community",
        "status": "ACTIVE",
        "createdById": "u1v2w3x4-...",
        "createdAt": "2026-11-22T04:00:00.000Z",
        "updatedAt": "2026-11-22T04:00:00.000Z",
        "membersCount": 42,
        "createdBy": {
          "userId": "u1v2w3x4-...",
          "name": "Badal Khandelwal",
          "email": "badal@srmist.edu.in",
          "profileImage": "https://..."
        }
      }
    },
    "meta": {
      "requestId": "uuid",
      "timestamp": "2026-11-22T04:00:00.000Z"
    }
  }
  ```
* **Privacy Guardrails:** `passwordHash`, `phone`, `walletBalance`, and `licenseNumber` are strictly excluded from the `createdBy` object.
* **Error Responses:**
  - `404 Not Found`: Community does not exist.
  - `422 Unprocessable Entity`: `:communityId` is not a valid UUID.

---

### 3.4 Join Community (`POST /api/v1/communities/:communityId/join`)
Enables an authenticated user to join a community if their institutional email domain matches the community domain.

* **Authentication:** Mandatory (`Bearer <jwt>`).
* **Route Parameters:**
  - `:communityId`: Valid UUID string.
* **Request Body:** Must be empty (`{}` or omitted). Any payload containing fields (`userId`, `memberRole`, `status`) is rejected with `422 Unprocessable Entity`.
* **Eligibility Rules:**
  1. Community must exist (`404 Not Found`).
  2. Community must have `status: ACTIVE` (`400 Bad Request` if inactive).
  3. User's email domain must exactly match community domain (case-insensitive) (`403 Forbidden` if mismatch).
  4. User must not already be an `ACTIVE` member (`409 Conflict` if duplicate).
  5. If user had an `INACTIVE` membership, it is reactivated to `ACTIVE`.
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Joined community successfully",
    "data": {
      "membership": {
        "membershipId": "m1n2o3p4-...",
        "communityId": "a1b2c3d4-...",
        "userId": "u1v2w3x4-...",
        "memberRole": "MEMBER",
        "status": "ACTIVE",
        "joinedAt": "2026-11-22T04:15:00.000Z"
      }
    },
    "meta": {
      "requestId": "uuid",
      "timestamp": "2026-11-22T04:15:00.000Z"
    }
  }
  ```

---

### 3.5 Community Members Directory (`GET /api/v1/communities/:communityId/members`)
Retrieves the paginated roster of active community members.

* **Authentication & Authorization:**
  - **Mandatory Authentication** (`Bearer <jwt>`).
  - **Membership Gate:** Requester must have an `ACTIVE` membership (`MEMBER` or `ADMIN`) in that specific community. Users without active membership receive `403 Forbidden`.
* **Route Parameters:**
  - `:communityId`: Valid UUID string.
* **Query Parameters:**
  - `page`: Page number (integer >= 1, default: 1).
  - `limit`: Page size (integer 1–100, default: 20).
  - `.strict()`: Rejects extra filters (`status`, `role`, `search`).
* **Safe Projection & Privacy Guardrails:**
  - Included: `membershipId`, `memberRole`, `joinedAt`, `user.userId`, `user.name`, `user.profileImage`.
  - Excluded: `email`, `phone`, `passwordHash`, `walletBalance`, `licenseNumber`, `roles`, `averageRating`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Community members retrieved successfully",
    "data": {
      "members": [
        {
          "membershipId": "m1-...",
          "memberRole": "ADMIN",
          "joinedAt": "2026-11-22T04:00:00.000Z",
          "user": {
            "userId": "u1-...",
            "name": "Badal Khandelwal",
            "profileImage": "https://..."
          }
        },
        {
          "membershipId": "m2-...",
          "memberRole": "MEMBER",
          "joinedAt": "2026-11-22T04:15:00.000Z",
          "user": {
            "userId": "u2-...",
            "name": "Aarav Sharma",
            "profileImage": null
          }
        }
      ]
    },
    "meta": {
      "requestId": "uuid",
      "timestamp": "2026-11-22T04:15:00.000Z",
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 2,
        "totalPages": 1,
        "hasNext": false,
        "hasPrev": false
      }
    }
  }
  ```
* **Error Responses:**
  - `401 Unauthorized`: Missing or invalid token.
  - `403 Forbidden`: Requester is not an active member of this community.
  - `404 Not Found`: Community does not exist.
  - `422 Unprocessable Entity`: Invalid UUID or query parameters.
