# 🤝 RYDORA — FOUR-DEVELOPER INTEGRATION CONTRACT

**Version:** 1.0.0 — Milestone 1 Baseline  
**Lead Architect:** Anindya Sarkar  
**Backend Coordinators:** Anindya Sarkar & Badal Khandelwal  
**Feature Developers:** Atharv Upadhyay & Anshika Srivastava  

---

## 1. Primary Rule of Separation

To prevent Git merge conflicts, regression bugs, and duplicate database connections across the four developers, the Rydora backend enforces strict modular isolation:

```text
Routes  ──▶  Middleware (Auth / Validate)  ──▶  Controller  ──▶  Service  ──▶  Prisma Singleton  ──▶  PostgreSQL
```

---

## 2. Developer Domain Ownership Matrix

| Developer | Primary Domain | Feature Scope & Responsibilities | Exclusive Folder / File Ownership |
| :--- | :--- | :--- | :--- |
| **Anindya** *(Lead Architect)* | **Shared Foundation & Fleet Architecture** | • Express 5 & TypeScript setup<br>• Centralized error handling & Zod middleware<br>• Prisma 7 singleton & database migrations<br>• Central router registry (`src/routes/index.ts`)<br>• Vehicles, Drivers, and Core Ride publishing/search | `src/config/*`<br>`src/middleware/errorHandler.ts`<br>`src/middleware/requestId.ts`<br>`src/utils/*`<br>`src/routes/index.ts`<br>`src/controllers/vehicle.*`<br>`src/controllers/driver.*`<br>`src/controllers/ride.*`<br>`src/services/vehicle.*`<br>`src/services/driver.*`<br>`src/services/ride.*`<br>`backend/prisma/schema.prisma`<br>`backend/prisma/migrations/*` |
| **Badal** *(Identity Lead)* | **Identity, Auth & Communities** | • User signup, login, JWT & password hashing<br>• Concurrency-safe refresh token rotation & logout<br>• User profile & preference management<br>• Community creation, discovery, and domain verification<br>• Community membership lifecycle & invites | `src/controllers/auth.*`<br>`src/controllers/user.*`<br>`src/controllers/community.*`<br>`src/services/auth.*`<br>`src/services/user.*`<br>`src/services/community.*`<br>`src/validators/auth.*`<br>`src/validators/user.*`<br>`src/validators/community.*`<br>`src/routes/auth.routes.ts`<br>`src/routes/user.routes.ts`<br>`src/routes/community.routes.ts`<br>`src/middleware/auth.ts`<br>`src/middleware/rbac.ts` |
| **Athar** *(Feature Dev)* | **Bookings, Cancellations & Financial Ledger** | • Pre-booking fare quotation<br>• Atomic transactional booking creation (seat decrements)<br>• Conditional booking cancellation (seat restoration)<br>• Transaction ledger tracking (payments, refunds)<br>• No-show verification & disputes | `src/controllers/booking.*`<br>`src/controllers/cancellation.*`<br>`src/controllers/transaction.*`<br>`src/services/booking.*`<br>`src/services/cancellation.*`<br>`src/services/transaction.*`<br>`src/validators/booking.*`<br>`src/validators/cancellation.*`<br>`src/validators/transaction.*`<br>`src/routes/booking.routes.ts`<br>`src/routes/cancellation.routes.ts`<br>`src/routes/transaction.routes.ts` |
| **Anshika** *(Feature Dev)* | **Emergency, Safety & Driver Earnings** | • User emergency contacts (max 5, phone unique)<br>• SOS alert ingestion & live dispatch logging<br>• Driver earning calculation (gross, platform fee, net)<br>• Driver payout status tracking<br>• Aggregate user ratings | `src/controllers/emergency-contact.*`<br>`src/controllers/sos.*`<br>`src/controllers/driver-earning.*`<br>`src/services/emergency-contact.*`<br>`src/services/sos.*`<br>`src/services/driver-earning.*`<br>`src/validators/emergency-contact.*`<br>`src/validators/sos.*`<br>`src/validators/driver-earning.*`<br>`src/routes/emergency-contact.routes.ts`<br>`src/routes/sos.routes.ts`<br>`src/routes/driver-earning.routes.ts` |

---

## 3. Ten Non-Negotiable Architectural Rules

1. **Self-Contained Modules:** Each developer owns and edits only their assigned controllers, services, validators, routes, and tests.
2. **Shared Prisma Singleton:** All database access MUST use `import { prisma } from '../config/prisma.js'`.
3. **No Duplicate Prisma Clients:** No developer may instantiate `new PrismaClient()` in any service or script.
4. **Schema & Migration Gatekeeper:** Only Anindya is authorized to edit `backend/prisma/schema.prisma` or execute `prisma migrate` commands. If a schema change is needed, file a request with Anindya.
5. **Central Router Registry:** Developers export their sub-routers from `src/routes/<domain>.routes.ts`. Only Anindya mounts them onto `src/routes/index.ts`.
6. **No Direct Edits to Shared Core:** Developers must never independently edit `app.ts`, `server.ts`, `src/config/*`, or `src/middleware/errorHandler.ts`.
7. **Unified API Prefix:** All endpoints must be registered under `/api/v1` (e.g. `/api/v1/auth/login`, `/api/v1/rides/search`).
8. **Standard Response & Error Envelopes:**
   - Success: Always use `sendSuccess(res, data, message, statusCode, pagination)` from `src/utils/response.js`.
   - Errors: Always throw an instance of `AppError` (e.g. `BadRequestError`, `NotFoundError`, `ConflictError`) or let Zod/Prisma errors propagate to `errorHandler.ts`.
9. **Authentication Middleware:** All protected endpoints must use the shared `authenticate` middleware from `src/middleware/auth.js`.
10. **Pre-Integration Test Guarantee:** Each developer must write and pass automated unit/integration tests in their dedicated `tests/<domain>/` folder before their router is integrated into `master`.

---

## 4. Standard Response Formats

### 4.1 Success Response (`sendSuccess`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ride booked successfully",
  "data": {
    "bookingId": "a1b2c3d4-...",
    "rideId": "f5e6d7c8-...",
    "seatsBooked": 2,
    "status": "CONFIRMED",
    "totalAmount": "240.00"
  },
  "meta": {
    "requestId": "4c9e88d1-163f-4e4f-b6ec-7d00f68e9834",
    "timestamp": "2026-11-19T00:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 4.2 Error Response (`errorHandler`)
```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "CONFLICT",
    "message": "Unique constraint violation: record with this email already exists",
    "details": [
      {
        "field": "email",
        "message": "Already in use"
      }
    ]
  },
  "meta": {
    "requestId": "4c9e88d1-163f-4e4f-b6ec-7d00f68e9834",
    "timestamp": "2026-11-19T00:30:00.000Z"
  }
}
```

---

## 5. Domain Router Export Convention

Every developer exports their domain router as a named export from `src/routes/<domain>.routes.ts`:

```typescript
// Example: src/routes/auth.routes.ts (Badal)
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
```

Then Anindya mounts it cleanly in `src/routes/index.ts`:

```typescript
import { authRouter } from './auth.routes.js';
apiV1Router.use('/auth', authRouter);
```
