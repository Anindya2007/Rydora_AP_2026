# 🚗 Rydora RideShare Ecosystem — Backend API & Services

Production-grade, modular monolith backend powering the **Rydora** university and corporate carpooling platform. Built with **Node.js 22, Express 5, TypeScript, Prisma ORM 7, and PostgreSQL (Neon Serverless)**.

---

## 👥 Engineering Team & Domain Ownership

| Developer | Domain | Functional Scope & Modules |
| :--- | :--- | :--- |
| **Anindya Sarkar** *(Lead Architect)* | **Foundation & Fleet Architecture** | Express 5 baseline, centralized error handler, Prisma 7 singleton & migrations, master router (`/api/v1`), Vehicles, Drivers, and Core Rides. |
| **Badal Khandelwal** *(Identity & Communities Lead)* | **Identity, Auth & Communities** | User signup, login, JWT & password hashing, user profile management, community creation, discovery, membership lifecycle, and member directory. |
| **Athar Upadhyay** *(Feature Dev)* | **Bookings & Financial Ledger** | Fare calculation, atomic seat booking & cancellation, transaction ledger, refunds, and dispute management. |
| **Anshika Srivastava** *(Feature Dev)* | **Safety & Driver Earnings** | Emergency contacts, SOS alerts with live coordinates, driver net earnings, and aggregate user ratings. |

---

## 🏗️ Architecture & Request Lifecycle

```text
HTTP Request (Client / Mobile App)
     │
     ▼
Central Router (`src/routes/index.ts` mounted at `/api/v1`)
     │
     ▼
Domain Sub-Router (`src/routes/<domain>.routes.ts`)
     │
     ▼
Authentication Middleware (`src/middleware/auth.ts`)
     │
     ▼
Controller Layer (`src/controllers/<domain>.controller.ts`)
     │
     ▼
Input Validation Layer (`src/validators/<domain>Validator.ts`)
     │
     ▼
Service Layer (`src/services/<domain>.service.ts`)
     │
     ▼
Database Layer (Prisma 7 Client Singleton `src/config/prisma.ts`)
     │
     ▼
PostgreSQL Engine (Neon Serverless Connection Pooled)
```

---

## 🌐 Community API Endpoints (Milestone 3)

Detailed specification available in [COMMUNITIES_API.md](docs/COMMUNITIES_API.md).

| Method | Endpoint | Access | Summary |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/communities` | Authenticated | Create a new community (creator receives `ADMIN` role). |
| `GET` | `/api/v1/communities` | Public | List and search active communities with pagination. |
| `GET` | `/api/v1/communities/:communityId` | Public | Retrieve community details, active members count, and creator info. |
| `POST` | `/api/v1/communities/:communityId/join` | Authenticated | Join an eligible community as `MEMBER` via institutional domain matching. |
| `GET` | `/api/v1/communities/:communityId/members` | Active Member | Browse paginated directory of active members for a community. |

---

## ⚡ Quick Start & Development

### 1. Prerequisites
- **Node.js:** `v22.x` (ESM native)
- **npm:** `10.x` or later
- **Database:** PostgreSQL (Neon Serverless or standard PostgreSQL 15+)

### 2. Installation & Environment Configuration
```bash
# Clone the repository and navigate to backend
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Neon PostgreSQL DATABASE_URL and secure JWT_SECRET
```

### 3. Database & Code Generation
```bash
# Generate Prisma Client
npm run prisma:generate

# Verify database schema integrity
npm run prisma:validate
```

### 4. Running the Development Server
```bash
# Start backend in watch mode (defaults to http://localhost:3000)
npm run dev
```

---

## 🧪 Testing & Verification

Rydora maintains a two-tier test suite ensuring complete test isolation and production stability:

### 1. Vitest Unit & Regression Tests (Mocked Prisma)
Runs 190+ automated tests across foundation, authentication, user profiles, and community modules in seconds:
```bash
# Run unit test suite
npm test

# Run in watch mode
npm run test:watch

# Run only community tests
npx vitest run tests/communities/
```

### 2. Live API Integration Test Runner (Actual HTTP Server & Neon DB)
Executes end-to-end HTTP integration tests against live endpoints:
```bash
# Run live integration test suite
npm run test:api
```

### 3. TypeScript Compilation Build
Validates strict type-safety across all controllers, services, routes, and models:
```bash
npm run build
```

---

## 🔒 Security & Privacy Standards

- **Strict User Identity Derivation:** Endpoints derive user identity exclusively from the authenticated JWT (`req.user.userId`). Client-side injection of `userId`, `roles`, or `status` in request bodies or query parameters is strictly rejected with `422 Unprocessable Entity`.
- **Domain Siloing:** Community joining strictly validates email domains (case-insensitive) against the community's authorized domain, protecting academic/corporate closed networks.
- **Privacy-Preserving Projections:** Sensitive user data (`passwordHash`, `phone`, `walletBalance`, `licenseNumber`) is never returned in public community detail or member directory payloads.
