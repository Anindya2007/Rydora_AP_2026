# 🛡️ Rydora Role-Based Access Control (RBAC) Architecture & Specification

This document details the global role-based access control architecture for the Rydora backend, establishing how user identities are authenticated, how permissions are evaluated, and how role restrictions must be integrated into future route definitions.

---

## 1. Authentication vs. Authorization

Rydora strictly separates **Identity Verification** from **Permission Enforcement**:

```text
Incoming HTTP Request
       │
       ▼
1. Authentication (`authenticate`)
   • "Who are you?"
   • Validates Bearer JWT signature against JWT_SECRET.
   • Fetches fresh user record from PostgreSQL (never trusts token claims for roles).
   • Attaches sanitized identity to `req.user` (including `req.user.roles`).
   • Halts with HTTP 401 UNAUTHORIZED if token is missing, expired, or invalid.
       │
       ▼
2. Authorization (`requireRoles`)
   • "Are you permitted to perform this action?"
   • Inspects `req.user.roles` attached by `authenticate`.
   • Compares user's current roles against route's `allowedRoles`.
   • Halts with HTTP 403 FORBIDDEN if user lacks required role(s).
       │
       ▼
3. Controller / Route Handler
   • Business logic executes with guaranteed identity and permissions.
```

| Dimension | Authentication (`authenticate`) | Authorization (`requireRoles`) |
| :--- | :--- | :--- |
| **Responsibility** | Verifying caller identity | Verifying permissions and capabilities |
| **Input Source** | HTTP `Authorization: Bearer <token>` | `req.user.roles` populated from PostgreSQL |
| **Failure Status** | `401 Unauthorized` | `403 Forbidden` |
| **Failure Error Code** | `UNAUTHORIZED` | `FORBIDDEN` |
| **Placement in Pipeline** | Must run **first** | Must run **after** `authenticate` |

---

## 2. Role Architecture: Global vs. Community Scopes

Rydora operates two distinct role tiers that must **never** be conflated:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GLOBAL PLATFORM ROLES (`UserRole`)                   │
│                                                                        │
│   • Defined in Prisma: `enum UserRole { USER, DRIVER }`                │
│   • Attached to: `User.roles` (`UserRole[] @default([USER])`)          │
│   • Scope: Entire Rydora platform across all modules.                  │
│   • Governed by: `requireRoles(...allowedRoles: UserRole[])`           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       Participates in Communities
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             COMMUNITY-SCOPED ROLES (`CommunityMemberRole`)             │
│                                                                        │
│   • Defined in Prisma: `enum CommunityMemberRole { MEMBER, ADMIN }`    │
│   • Attached to: `CommunityMembership.memberRole`                      │
│   • Scope: Confined strictly within a single `Community` tenancy.      │
│   • Governed by: Community service checks / membership queries.        │
└────────────────────────────────────────────────────────────────────────┘
```

### A. Global Platform Roles (`PlatformRole`)
- **`USER`**: Base role granted to every registered account by default in PostgreSQL (`UserRole.USER`). Allows finding rides, joining communities, managing personal profiles, and requesting carpools.
- **`DRIVER`**: Elevated platform capability granted to verified drivers with valid driver licenses and vehicle registrations (`UserRole.DRIVER`). Allows publishing rides, offering seats, and receiving driver payouts.
- **`ADMIN` (Platform Administrator)**: Administrative capability governing platform verification and moderation.
  - **Resolution Mechanism (M5.10.2):** Because the current database schema preserves `UserRole { USER, DRIVER }` pending deferred migration recovery, platform `ADMIN` identity is securely derived during `authenticate` middleware execution via the environment variable allowlist:
    `ADMIN_USER_IDS="<uuid1>,<uuid2>"`
  - **Zero Trust Security:** The client cannot supply, forge, or manipulate `ADMIN` claims. The caller MUST be a real, authenticated database user whose verified database `userId` matches `ADMIN_USER_IDS`.
  - **Future Native Migration:** When database migration recovery is executed, `ADMIN` will be added to native PostgreSQL enum: `ALTER TYPE "UserRole" ADD VALUE 'ADMIN';`.
- **Multi-Role Capability**: Stored and resolved as an array (`PlatformRole[]`). A user can be both a rider, driver, and platform admin (`['USER', 'DRIVER', 'ADMIN']`).

### B. Community-Scoped Roles (`CommunityMemberRole`)
- **`MEMBER`**: Default membership role for users who join an active community matching their institutional email domain.
- **`ADMIN` (Community Moderator)**: Granted to the creator of a community or designated community moderators. Confined strictly to managing that specific community.
- **Crucial Separation Rule**: Platform `ADMIN` and Community `ADMIN` are completely distinct scopes:
  - `requireRoles('ADMIN')` enforces **Platform Admin** (e.g. driver verification, global moderation).
  - Community moderation checks evaluate `CommunityMembership.memberRole === 'ADMIN'` scoped strictly to a specific `communityId`.
  - A user who is an `ADMIN` of Community A has zero platform administrative authority and cannot approve driver verifications or access other communities.

---

## 3. Middleware Usage & Integration Guide

### TypeScript Route Definition Example

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { UserRole } from '../generated/prisma/client.js';
import { VehicleController } from '../controllers/vehicle.controller.js';

export const vehicleRouter = Router();

// Route restricted strictly to verified drivers:
vehicleRouter.post(
  '/',
  authenticate,                  // 1. Establish verified caller identity (populates req.user)
  requireRoles(UserRole.DRIVER),  // 2. Enforce global DRIVER role (403 if insufficient)
  VehicleController.createVehicle // 3. Execute controller handler
);
```

### Execution Order & Prerequisites

1. **`requestIdMiddleware`**: Always mounted globally first to stamp requests with a unique trace identifier.
2. **`authenticate`**: Must **always** precede `requireRoles`.
   - *Why?* `requireRoles` reads `req.user.roles`. If `requireRoles` were mounted before `authenticate`, `req.user` would be `undefined`, causing the middleware to defensively abort with HTTP 401.
3. **`requireRoles(...allowedRoles)`**: Evaluates whether `req.user.roles` has at least one match in `allowedRoles`.
4. **Validation Middleware & Controller**: Executes only after identity and permissions have been confirmed.

---

## 4. Error Handling & Standard Error Contract

When authorization fails, the middleware yields standard API error envelopes via the centralized `errorHandler`:

### A. Unauthenticated Request (`401 Unauthorized`)
Triggered when `req.user` is missing (authentication omitted or failed):
```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "details": null
  },
  "meta": {
    "requestId": "98eb7db4-387c-431a-9e1e-5de601708a81",
    "timestamp": "2026-11-22T14:55:00.000Z"
  }
}
```

### B. Insufficient Permissions (`403 Forbidden`)
Triggered when the authenticated user does not possess any role in `allowedRoles`, or has an empty `roles: []` array:
```json
{
  "success": false,
  "statusCode": 403,
  "error": {
    "code": "FORBIDDEN",
    "message": "Forbidden: Insufficient permissions",
    "details": null
  },
  "meta": {
    "requestId": "98eb7db4-387c-431a-9e1e-5de601708a81",
    "timestamp": "2026-11-22T14:55:00.000Z"
  }
}
```

### C. Fail-Safe Empty Allowed Roles
If a developer accidentally configures `requireRoles()` with no arguments (empty `allowedRoles`), the middleware **fails safely (fail-closed)** by throwing `ForbiddenError('Forbidden: Insufficient permissions')`, preventing accidental route exposure.

---

## 5. Current Route Status (Audit Finding)

An exhaustive audit of all currently mounted endpoints in Rydora API v1 confirmed:

> **Status**: **Zero (0) existing production endpoints currently require a global `DRIVER` restriction.**

| Endpoint | Method | Access Level | Status |
| :--- | :---: | :---: | :--- |
| `/api/v1/health` | GET | Public | Infrastructure liveness probe. No role restriction. |
| `/api/v1/ready` | GET | Public | Database readiness probe. No role restriction. |
| `/api/v1/auth/signup` | POST | Public | User self-registration. Assigns default role `['USER']`. |
| `/api/v1/auth/login` | POST | Public | Credential authentication. |
| `/api/v1/auth/me` | GET | Authenticated | Profile bootstrapping for all users (`USER`, `DRIVER`). |
| `/api/v1/users/me` | PATCH | Authenticated | Self-profile update for all users (`USER`, `DRIVER`). |
| `/api/v1/communities` | GET | Public | Public discovery for prospective carpoolers. |
| `/api/v1/communities/:communityId` | GET | Public | Public community detail view. |
| `/api/v1/communities` | POST | Authenticated | Self-service community creation (creator becomes community `ADMIN`). |
| `/api/v1/communities/:communityId/join` | POST | Authenticated | Self-service domain-matched community joining. |
| `/api/v1/communities/:communityId/members` | GET | Active Member | Directory of community members (scoped membership check). |

Applying `requireRoles(UserRole.DRIVER)` to any of the above endpoints would break core rider workflows (e.g., locking out riders from viewing communities or editing their phone numbers). Therefore, all existing production routes properly remain untouched.

---

## 6. Future Integration Guidance

As upcoming feature modules are implemented, developers must apply `requireRoles` in accordance with the following matrix:

### Fleet & Vehicles Module (Anindya Sarkar)
- `POST /api/v1/vehicles`: **Requires `requireRoles(UserRole.DRIVER)`**. Only registered drivers may attach vehicles to their fleet.
- `GET /api/v1/vehicles/me`: **Requires `requireRoles(UserRole.DRIVER)`**. Fetches driver's registered vehicles.
- `DELETE /api/v1/vehicles/:vehicleId`: **Requires `requireRoles(UserRole.DRIVER)`**. Driver vehicle management.

### Rides Module (Anindya Sarkar)
- `POST /api/v1/rides`: **Requires `requireRoles(UserRole.DRIVER)`**. Only verified drivers may publish and offer rides.
- `PATCH /api/v1/rides/:rideId/status`: **Requires `requireRoles(UserRole.DRIVER)`**. Only the driver can mark a ride `IN_PROGRESS` or `COMPLETED`.
- `GET /api/v1/rides`: **Public / Authenticated `USER`**. Riders must be able to search for available rides.

### Driver Earnings Module (Anshika Srivastava)
- `GET /api/v1/driver-earnings`: **Requires `requireRoles(UserRole.DRIVER)`**. Driver-specific revenue and payout ledger.

---

## 7. Verification & Automated Test Coverage

The RBAC middleware foundation is validated by 20 dedicated automated tests in [rbac.middleware.test.ts](file:///Users/badalkhandelwal/Downloads/rydora%20capstone/Ap-capstone/backend/tests/auth/rbac.middleware.test.ts):
- Missing `req.user` handling (HTTP 401).
- Single role mismatch (`USER` accessing `DRIVER` route -> HTTP 403).
- Authorized access (`DRIVER` -> HTTP 200).
- Dual-role access (`USER + DRIVER` -> HTTP 200).
- Multiple allowed roles (`[USER, DRIVER]` with either role -> HTTP 200).
- Empty roles array (`roles: []` -> HTTP 403).
- Empty allowed roles fail-safe (`requireRoles()` -> HTTP 403).
- Tamper/spoof resistance (ignores body, query, and headers).
- Standardized error response contract conformance.
- Full middleware pipeline integration (`authenticate` -> `requireRoles` -> controller).
