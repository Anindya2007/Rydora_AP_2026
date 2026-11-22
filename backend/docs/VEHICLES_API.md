# 🚗 Rydora — Vehicle Fleet Management API Specification (Milestone 5)

**Domain Lead:** Anindya Sarkar (Shared Foundation & Fleet Architecture)  
**Co-Authors:** Badal Khandelwal, Athar Upadhyay, Anshika Srivastava  
**Version:** 1.0.0 (Post-M5.8 Baseline)  
**Status:** Complete & Verified  

---

## 1. Overview & Architecture

The Vehicle Management module provides lifecycle management and driver fleet operations for the Rydora carpooling ecosystem. It enables verified drivers to register vehicles, manage their personal fleet, retrieve vehicle specifications, and update vehicle status (including activation/deactivation for carpooling operations).

### Architectural Pipeline
```text
HTTP Request (Client / Mobile App)
     │
     ▼
Central Router (`src/routes/index.ts` mounted at `/api/v1`)
     │
     ▼
Vehicle Sub-Router (`src/routes/vehicle.routes.ts` mounted at `/vehicles`)
     │
     ▼
Authentication Middleware (`src/middleware/auth.ts`)
     │
     ▼
RBAC Authorization Middleware (`src/middleware/rbac.ts` enforcing `UserRole.DRIVER`)
     │
     ▼
Input / Param Validation Middleware (`src/validators/vehicleValidator.ts`)
     │
     ▼
Controller Layer (`src/controllers/vehicle.controller.ts`)
     │
     ▼
Service Layer (`src/services/vehicle.service.ts`)
     │
     ▼
Prisma 7 Client Singleton (`src/config/prisma.ts`)
     │
     ▼
PostgreSQL Engine (Neon Serverless Connection Pooled, `vehicles` table)
```

---

## 2. Core Security & Architectural Invariants

1. **Mandatory DRIVER Role Requirement:**
   - Every vehicle endpoint requires both valid JWT authentication (`authenticate`) and the global `DRIVER` platform role (`requireRoles(UserRole.DRIVER)`).
   - Non-driver callers (`UserRole.USER`) receive HTTP `403 Forbidden` (`FORBIDDEN`).
2. **Database-Level Ownership Scoping:**
   - All read and write operations strictly bind to the authenticated driver identity (`req.user.userId`).
   - Mutations use SQL-level scoping: `WHERE "vehicleId" = $1 AND "driverId" = $2`.
3. **Zero-Knowledge Privacy Policy (Anti-Enumeration):**
   - If a requested `vehicleId` does not exist OR exists but belongs to a different driver, the API returns HTTP `404 Not Found` (`NOT_FOUND`).
   - This prevents ID-probing and fleet enumeration attacks across drivers.
4. **Immutability of Core Identity:**
   - Fields defining physical legal identity (`registrationNumber`, `vehicleType`, `seatCapacity`) and database relations (`vehicleId`, `driverId`) are strictly immutable after creation.
   - Attempting to modify these fields via `PATCH` is rejected with HTTP `422 Unprocessable Entity` (`UNPROCESSABLE_ENTITY`).
5. **Passenger-Only Seat Capacity Semantics (PDR Decision 06 - Option A):**
   - `Vehicle.seatCapacity` represents passenger-only bookable seats (`1 <= seatCapacity <= 8`), excluding the driver.
6. **Registration Normalization & Concurrency Guard:**
   - Registration numbers are trimmed and normalized to uppercase.
   - Uniqueness is validated proactively and protected reactively against concurrent race conditions via Prisma `P2002` error handling (HTTP `409 Conflict`).
7. **Express Route Ordering Invariant:**
   - The route `GET /me` is declared prior to `GET /:vehicleId` to prevent Express route matching collision.

---

## 3. API Endpoints Summary

| Method | Endpoint | Auth | Role Required | Summary |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/v1/vehicles` | Bearer JWT | `DRIVER` | Register a new vehicle to the driver's fleet. |
| `GET` | `/api/v1/vehicles/me` | Bearer JWT | `DRIVER` | List driver's vehicles with pagination and status filters. |
| `GET` | `/api/v1/vehicles/:vehicleId` | Bearer JWT | `DRIVER` | Retrieve an individual vehicle owned by the driver. |
| `PATCH` | `/api/v1/vehicles/:vehicleId` | Bearer JWT | `DRIVER` | Update mutable fields (`make`, `model`, `color`, `isActive`). |

---

## 4. Detailed Endpoint Specifications

### 4.1 Register Vehicle (`POST /api/v1/vehicles`)
Registers a new vehicle belonging exclusively to the authenticated driver.

* **Authentication:** Mandatory (`Bearer <jwt>`).
* **Authorization:** Mandatory (`UserRole.DRIVER`).
* **Request Headers:**
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "vehicleType": "SEDAN",
    "make": "Honda",
    "model": "City",
    "registrationNumber": "KA-01-AB-1234",
    "seatCapacity": 4,
    "color": "Silver"
  }
  ```
* **Validation Rules (`createVehicleSchema`):**
  - `vehicleType`: Enum, one of `['CAR', 'BIKE', 'SEDAN', 'HATCHBACK', 'SUV', 'VAN', 'OTHER']`. Trimmed and uppercased.
  - `make`: String, 1–80 characters, trimmed.
  - `model`: String, 1–80 characters, trimmed.
  - `registrationNumber`: String, 1–30 characters, trimmed, converted to uppercase.
  - `seatCapacity`: Integer, 1 to 8 (passenger bookable capacity).
  - `color`: String, optional/nullable, max 40 characters, trimmed. Empty string normalized to `null`.
  - `.strict()`: Rejects client-supplied `driverId`, `vehicleId`, `isActive`, `createdAt`, `updatedAt`, or unknown keys.
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Vehicle registered successfully",
    "data": {
      "vehicle": {
        "vehicleId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "driverId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "vehicleType": "SEDAN",
        "make": "Honda",
        "model": "City",
        "registrationNumber": "KA-01-AB-1234",
        "seatCapacity": 4,
        "color": "Silver",
        "isActive": true,
        "createdAt": "2026-11-22T10:00:00.000Z",
        "updatedAt": "2026-11-22T10:00:00.000Z"
      }
    },
    "meta": {
      "requestId": "e7b0c95a-...",
      "timestamp": "2026-11-22T10:00:00.000Z"
    }
  }
  ```
* **Error Responses:**
  - `401 Unauthorized`: Missing or invalid Bearer token.
  - `403 Forbidden`: User does not possess `DRIVER` role.
  - `409 Conflict`: Registration number is already registered in the system.
  - `422 Unprocessable Entity`: Input validation failure (e.g. invalid vehicle type, seat capacity > 8, extra fields).

---

### 4.2 List Driver Vehicles (`GET /api/v1/vehicles/me`)
Retrieves a paginated list of vehicles belonging exclusively to the authenticated driver.

* **Authentication:** Mandatory (`Bearer <jwt>`).
* **Authorization:** Mandatory (`UserRole.DRIVER`).
* **Request Query Parameters (`vehicleQuerySchema`):**
  - `page`: Integer >= 1 (Default: `1`).
  - `limit`: Integer between 1 and 100 (Default: `20`).
  - `isActive`: Boolean (`true` or `false`, optional). Explicitly filter active or inactive vehicles.
  - `includeInactive`: Boolean (`true` or `false`, Default: `true`). When set to `false`, filters active-only.
* **Default Behavior:** Returns all vehicles (active and inactive) owned by the driver for garage management.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Vehicles retrieved successfully",
    "data": {
      "vehicles": [
        {
          "vehicleId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          "driverId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          "vehicleType": "SEDAN",
          "make": "Honda",
          "model": "City",
          "registrationNumber": "KA-01-AB-1234",
          "seatCapacity": 4,
          "color": "Silver",
          "isActive": true,
          "createdAt": "2026-11-22T10:00:00.000Z",
          "updatedAt": "2026-11-22T10:00:00.000Z"
        }
      ]
    },
    "meta": {
      "requestId": "a8c2d1e0-...",
      "timestamp": "2026-11-22T10:05:00.000Z",
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
  - `401 Unauthorized`: Missing or invalid Bearer token.
  - `403 Forbidden`: User does not possess `DRIVER` role.
  - `422 Unprocessable Entity`: Invalid query parameters (e.g. `page < 1`, `limit > 100`).

---

### 4.3 Retrieve Vehicle by ID (`GET /api/v1/vehicles/:vehicleId`)
Retrieves specification and status of an individual vehicle owned by the driver.

* **Authentication:** Mandatory (`Bearer <jwt>`).
* **Authorization:** Mandatory (`UserRole.DRIVER`).
* **Route Parameters (`vehicleIdParamSchema`):**
  - `vehicleId`: UUIDv4 string.
* **Zero-Knowledge Security:**
  - Evaluates `WHERE "vehicleId" = $1 AND "driverId" = $2`.
  - Nonexistent vehicles and vehicles owned by other drivers both return `404 Not Found`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Vehicle retrieved successfully",
    "data": {
      "vehicle": {
        "vehicleId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "driverId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "vehicleType": "SEDAN",
        "make": "Honda",
        "model": "City",
        "registrationNumber": "KA-01-AB-1234",
        "seatCapacity": 4,
        "color": "Silver",
        "isActive": true,
        "createdAt": "2026-11-22T10:00:00.000Z",
        "updatedAt": "2026-11-22T10:00:00.000Z"
      }
    },
    "meta": {
      "requestId": "b3e4f5a6-...",
      "timestamp": "2026-11-22T10:10:00.000Z"
    }
  }
  ```
* **Error Responses:**
  - `401 Unauthorized`: Missing or invalid Bearer token.
  - `403 Forbidden`: User does not possess `DRIVER` role.
  - `404 Not Found`: Vehicle does not exist or belongs to another driver.
  - `422 Unprocessable Entity`: `vehicleId` is not a valid UUIDv4.

---

### 4.4 Update Vehicle (`PATCH /api/v1/vehicles/:vehicleId`)
Updates mutable properties or toggles active status for a vehicle owned by the driver.

* **Authentication:** Mandatory (`Bearer <jwt>`).
* **Authorization:** Mandatory (`UserRole.DRIVER`).
* **Route Parameters (`vehicleIdParamSchema`):**
  - `vehicleId`: UUIDv4 string.
* **Request Body:**
  ```json
  {
    "make": "Honda",
    "model": "City Hybrid",
    "color": "White",
    "isActive": false
  }
  ```
* **Validation Rules (`updateVehicleSchema`):**
  - Permitted fields: `make`, `model`, `color`, `isActive`.
  - `make`: Optional string, 1–80 characters, trimmed.
  - `model`: Optional string, 1–80 characters, trimmed.
  - `color`: Optional string/null, max 40 characters, trimmed. Empty string normalized to `null`.
  - `isActive`: Optional boolean. Used to deactivate (`false`) or reactivate (`true`) a vehicle.
  - At least one field must be supplied (empty body `{}` is rejected).
  - `.strict()`: Modifying `registrationNumber`, `vehicleType`, `seatCapacity`, `driverId`, or `vehicleId` is rejected with `422`.
* **Database & Transaction Execution:**
  - Wrapped in `prisma.$transaction`.
  - `tx.vehicle.updateMany({ where: { vehicleId, driverId }, data: updateData })`.
  - Atomic zero-knowledge check: If `updateResult.count === 0`, throws `NotFoundError('Vehicle not found')` (404).
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Vehicle updated successfully",
    "data": {
      "vehicle": {
        "vehicleId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "driverId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "vehicleType": "SEDAN",
        "make": "Honda",
        "model": "City Hybrid",
        "registrationNumber": "KA-01-AB-1234",
        "seatCapacity": 4,
        "color": "White",
        "isActive": false,
        "createdAt": "2026-11-22T10:00:00.000Z",
        "updatedAt": "2026-11-22T10:15:00.000Z"
      }
    },
    "meta": {
      "requestId": "c4d5e6f7-...",
      "timestamp": "2026-11-22T10:15:00.000Z"
    }
  }
  ```
* **Error Responses:**
  - `400 Bad Request`: Empty payload with no mutable fields supplied.
  - `401 Unauthorized`: Missing or invalid Bearer token.
  - `403 Forbidden`: User does not possess `DRIVER` role.
  - `404 Not Found`: Vehicle does not exist or belongs to another driver.
  - `422 Unprocessable Entity`: Invalid UUID, attempting to modify immutable fields, or invalid field types.

---

## 5. Standard Error Response Codes

| Status Code | Error Code | Description / Scenario |
| :--- | :--- | :--- |
| `400 Bad Request` | `BAD_REQUEST` | Empty update payload or malformed request semantics. |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing, malformed, or expired JWT Bearer token. |
| `403 Forbidden` | `FORBIDDEN` | Authenticated user lacks the required `DRIVER` role. |
| `404 Not Found` | `NOT_FOUND` | Vehicle ID does not exist or belongs to a different driver. |
| `409 Conflict` | `CONFLICT` | Vehicle registration number already exists in database. |
| `422 Unprocessable Entity`| `UNPROCESSABLE_ENTITY` | Schema validation error (invalid UUID, missing fields, immutable field modification). |
| `500 Internal Server Error`| `INTERNAL_SERVER_ERROR` | Unexpected unhandled server or database error. |

---

## 6. Verification & Test Suite Summary

The Vehicle Management module is verified by **165 dedicated automated tests** spanning schemas, service business logic, controller integration, and RBAC security:

- **Validation Tests:** [backend/tests/vehicles/vehicle.validator.test.ts](file:///Users/badalkhandelwal/Downloads/rydora%20capstone/Ap-capstone/backend/tests/vehicles/vehicle.validator.test.ts) (45 tests)
- **Service Logic Tests:** [backend/tests/vehicles/vehicle.service.test.ts](file:///Users/badalkhandelwal/Downloads/rydora%20capstone/Ap-capstone/backend/tests/vehicles/vehicle.service.test.ts) (54 tests)
- **Controller & API Route Tests:** [backend/tests/vehicles/vehicle.controller.test.ts](file:///Users/badalkhandelwal/Downloads/rydora%20capstone/Ap-capstone/backend/tests/vehicles/vehicle.controller.test.ts) (66 tests)
- **Entire Backend Test Suite:** **13/13 test files passing, 382/382 tests passing.**
- **TypeScript Build:** Zero errors (`tsc --noEmit`).
