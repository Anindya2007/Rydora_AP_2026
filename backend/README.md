#  RideShare Ecosystem — Full-Stack Capstone Project

A community-driven taxi and carpooling backend and database system built with **Node.js, Express, Prisma ORM, PostgreSQL (NeonDB), and React**.

---

## 👥 4 Member Team Ownership & Domains

| Member | Feature Domain | Database Tables Owned | Core Endpoints Handled |
| :--- | :--- | :--- | :--- |
| **Member 1** | **Users, Auth & Communities** | `users`, `user_roles`, `communities`, `user_communities` | `POST /api/auth/signup`<br>`POST /api/auth/login`<br>`GET /api/auth/me`<br>`GET /api/communities`<br>`POST /api/communities` |
| **Member 2** | **Vehicles & Rides (Search)** | `vehicles`, `rides` | `POST /api/vehicles`<br>`GET /api/vehicles`<br>`POST /api/rides`<br>`GET /api/rides/search` |
| **Member 3** | **Bookings & Cancellations** | `bookings`, `cancellations` | `POST /api/rides/:id/book`<br>`GET /api/bookings/:id`<br>`POST /api/bookings/:id/cancel` |
| **Member 4** | **Ratings, Trust & Stats** | `ratings` | `POST /api/ratings`<br>`GET /api/ratings/user/:id` |

---

## 📁 Project Directory Structure

```text
sang/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Single source of truth: 9-table Prisma schema
│   ├── src/
│   │   ├── config/
│   │   │   └── prisma.js         # Prisma client connection
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT verification & role authorization
│   │   │   └── errorHandler.js   # Centralized error handler
│   │   ├── modules/
│   │   │   ├── auth/             # Member 1: Signup, Login, Profile
│   │   │   ├── users/            # Member 1: User profiles & role assignment
│   │   │   ├── communities/      # Member 1: University/Office matching
│   │   │   ├── vehicles/         # Member 2: Vehicle CRUD
│   │   │   ├── rides/            # Member 2: Ride creation & search engine
│   │   │   ├── bookings/         # Member 3: Atomic booking transaction
│   │   │   ├── cancellations/    # Member 3: Atomic cancellation transaction
│   │   │   └── ratings/          # Member 4: 2-way rating & user reviews
│   │   ├── routes/
│   │   │   └── index.js          # Master route aggregator
│   │   ├── app.js                # Express app configuration
│   │   └── server.js             # HTTP server entrypoint
│   ├── .env.example              # Environment variables template
│   └── package.json
├── frontend/                     # React (Vite) UI Application
└── README.md
```

---

## ⚡ Quick Start

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Supabase database credentials
npm run prisma:generate
npm run prisma:push     # Synchronizes schema with Supabase
npm run dev             # Starts Express server on http://localhost:3000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev             # Starts React UI on http://localhost:5173
```
