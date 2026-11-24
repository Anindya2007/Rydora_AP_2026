# Rydora — Unified Community RideShare & Mobility Ecosystem

Rydora is a modern, high-trust carpooling and campus/corporate mobility platform. It connects daily commuters—students, university staff, corporate employees, and verified public travelers—allowing drivers to share empty vehicle seats along their route, cover fuel expenses, and reduce traffic congestion with zero predatory platform commissions.

---

## 1. Architectural Philosophy & Simplicity

The Rydora backend is designed following a **clean, modular, and readable layered architecture**:

```
Client (Web / Mobile)
       │
       ▼  HTTP / REST (JSON) + Cookie / Bearer
┌────────────────────────────────────────────────────────┐
│ Express Server & Middleware                            │
│ ├─ CORS & Rate Limiting                                │
│ ├─ Authentication (JWT + HTTP-Only Cookies)            │
│ └─ RBAC (USER / DRIVER / ADMIN)                        │
└───────────────────────┬────────────────────────────────┘
                        ▼
┌────────────────────────────────────────────────────────┐
│ Controller Layer (HTTP Request / Response Envelope)   │
│ └─ Validates payloads using Zod schemas                │
└───────────────────────┬────────────────────────────────┘
                        ▼
┌────────────────────────────────────────────────────────┐
│ Service Layer (Pure Business Logic)                    │
│ ├─ AuthService (Signup, Login, Community Routing)      │
│ ├─ RideService (Corridor Search, Proportional Pricing) │
│ ├─ BookingService (Escrow, Completion, Approval)       │
│ ├─ PaymentService (Wallet Ledger & Refunds)            │
│ └─ SOSService (Emergency Alert & SMS Dispatch)         │
└───────────────────────┬────────────────────────────────┘
                        ▼
┌────────────────────────────────────────────────────────┐
│ Data Access Layer (Prisma ORM 7 + PostgreSQL)         │
└────────────────────────────────────────────────────────┘
```

### Core Tenets:
1. **Readable, Straightforward Code**: No over-engineered abstractions or multi-layered wrapper functions. Code is written directly with plain-English comments at each step.
2. **Unified User Model**: Every person has a single user account. A user can ride as a passenger, drive as a verified carpooler, or both.
3. **Double-Entry Financial Integrity**: Driver wallets are only credited upon completion and approval. Refunds are credited directly back into the user's wallet.
4. **Community Trust Silos**: Domain-based email matching automatically separates closed institutional carpooling (e.g., Rishihood University) from open public corridors.

---

## 2. Complete Database Schema & Entity Relationships

The Rydora database uses PostgreSQL managed through Prisma ORM. It consists of **11 core relational models**:

```mermaid
erDiagram
    User ||--o{ Community : "createdCommunities"
    User ||--o{ CommunityMembership : "memberships"
    User ||--o{ Vehicle : "registeredVehicles"
    User ||--o{ Ride : "publishedRides"
    User ||--o{ Booking : "riderBookings"
    User ||--o{ Booking : "cancelledBookings"
    User ||--o{ EmergencyContact : "emergencyContacts"
    User ||--o{ SOSAlert : "sosAlerts"
    User ||--o{ Transaction : "sentTransactions"
    User ||--o{ Transaction : "receivedTransactions"
    User ||--o{ DriverEarning : "driverEarnings"

    Community ||--o{ CommunityMembership : "members"
    Community ||--o{ Ride : "hostedRides"

    Vehicle ||--o{ Ride : "assignedRides"

    Ride ||--o{ Booking : "passengerBookings"
    Ride ||--o{ SOSAlert : "associatedAlerts"

    Booking ||--o{ Transaction : "transactions"
    Booking ||--o| DriverEarning : "driverEarning"

    SOSAlert ||--o{ SOSNotification : "notifications"
    EmergencyContact ||--o{ SOSNotification : "sosDispatches"

    Transaction ||--o| DriverEarning : "payoutTransaction"
    Transaction ||--o{ Transaction : "refundReferences"
```

---

### Detailed Table Specifications

#### 2.1 `users`
Represents an individual person in the system. Holds identity, security credentials, driver verification state, wallet balance, and aggregate rating.
* **`user_id`** (`UUID`, Primary Key): Unique identifier.
* **`name`** (`VARCHAR(100)`): User's legal full name.
* **`email`** (`VARCHAR(255)`, Unique): User's email address. Domain determines community affiliation.
* **`phone`** (`VARCHAR(20)`, Unique, Nullable): Mobile number for OTP, driver contact, and SOS alerts.
* **`password_hash`** (`TEXT`): Bcrypt hash (10 salt rounds). Plaintext is never persisted.
* **`profile_image`** (`TEXT`, Nullable): Avatar or profile photo URL.
* **`roles`** (`UserRole[]`, Default: `['USER']`): Platform roles (`USER`, `DRIVER`).
* **`license_number`** (`VARCHAR(60)`, Unique, Nullable): Driver's license number (for verified drivers).
* **`license_expiry`** (`DATE`, Nullable): Expiry date of the driving permit.
* **`driver_verified`** (`BOOLEAN`, Default: `false`): Verification status of driver credentials.
* **`wallet_balance`** (`DECIMAL(12,2)`, Default: `0.00`): In-app balance for ride fares and refunds.
* **`average_rating`** (`DECIMAL(3,2)`, Default: `0.00`): Aggregate 5-star rating.
* **`rating_count`** (`INT`, Default: `0`): Total number of ratings received.
* **`created_at`** / **`updated_at`** (`TIMESTAMPTZ`): Timestamps.

#### 2.2 `communities`
Groups users into trusted carpool circles based on universities, corporate campuses, or public corridors.
* **`community_id`** (`UUID`, Primary Key): Unique identifier.
* **`name`** (`VARCHAR(150)`): Display name (e.g., "Rishihood", "Open Community").
* **`domain`** (`VARCHAR(255)`, Indexed): Canonical email domain (e.g., `rishihood.edu.in`, `open`).
* **`description`** (`TEXT`, Nullable): Description and charter.
* **`status`** (`CommunityStatus`, Default: `ACTIVE`): `ACTIVE` or `INACTIVE`.
* **`created_by_id`** (`UUID`, Foreign Key $\to$ `users.user_id`): User who initiated the community.

#### 2.3 `community_memberships`
Junction table linking users to communities with role and membership status.
* **`membership_id`** (`UUID`, Primary Key): Unique identifier.
* **`community_id`** (`UUID`, Foreign Key $\to$ `communities.community_id`): Linked community.
* **`user_id`** (`UUID`, Foreign Key $\to$ `users.user_id`): Linked user.
* **`member_role`** (`CommunityMemberRole`, Default: `MEMBER`): `MEMBER` or `ADMIN`.
* **`status`** (`MembershipStatus`, Default: `ACTIVE`): `ACTIVE` or `INACTIVE`.
* **`joined_at`** (`TIMESTAMPTZ`): Timestamp of joining.
* **Unique Constraint**: `(community_id, user_id)`.

#### 2.4 `vehicles`
Stores vehicles registered by drivers for offering carpools.
* **`vehicle_id`** (`UUID`, Primary Key): Unique identifier.
* **`driver_id`** (`UUID`, Foreign Key $\to$ `users.user_id`): Owner of the vehicle.
* **`vehicle_type`** (`VARCHAR(50)`): Type (e.g., `SEDAN`, `SUV`, `HATCHBACK`, `EV`).
* **`make`** (`VARCHAR(80)`): Manufacturer (e.g., "Tata", "Hyundai", "Maruti").
* **`model`** (`VARCHAR(80)`): Model name (e.g., "Nexon EV", "Creta", "Baleno").
* **`registration_number`** (`VARCHAR(30)`, Unique): Official vehicle license plate.
* **`color`** (`VARCHAR(40)`, Nullable): Vehicle body color.
* **`seat_capacity`** (`INT`): Physical passenger seating capacity (excluding driver).
* **`is_active`** (`BOOLEAN`, Default: `true`): Whether vehicle is currently active for rides.

#### 2.5 `rides`
Represents an offered carpool trip from a source to a destination.
* **`ride_id`** (`UUID`, Primary Key): Unique identifier.
* **`driver_id`** (`UUID`, Foreign Key $\to$ `users.user_id`): Driver publishing the ride.
* **`vehicle_id`** (`UUID`, Foreign Key $\to$ `vehicles.vehicle_id`): Vehicle used.
* **`community_id`** (`UUID`, Foreign Key $\to$ `communities.community_id`): Community hosting the ride.
* **`source`** / **`destination`** (`VARCHAR(255)`): Route start and end point names.
* **`departure_time`** (`TIMESTAMPTZ`): Scheduled trip departure time.
* **`source_latitude`** / **`source_longitude`** (`DECIMAL(9,6)`, Nullable): GPS coordinates of origin.
* **`destination_latitude`** / **`destination_longitude`** (`DECIMAL(9,6)`, Nullable): GPS coordinates of destination.
* **`total_seats`** (`INT`): Total passenger seats offered (must be $\le$ vehicle seat capacity).
* **`available_seats`** (`INT`): Remaining open seats.
* **`fare_per_seat`** (`DECIMAL(10,2)`): Full corridor seat price.
* **`status`** (`RideStatus`, Default: `SCHEDULED`): `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

#### 2.6 `bookings`
Represents a passenger's reservation of one or more seats on a ride.
* **`booking_id`** (`UUID`, Primary Key): Unique identifier.
* **`ride_id`** (`UUID`, Foreign Key $\to$ `rides.ride_id`): Associated ride.
* **`riderId`** (`UUID`, Foreign Key $\to$ `users.user_id`): Passenger who booked.
* **`seats_booked`** (`INT`): Number of seats reserved.
* **`status`** (`BookingStatus`, Default: `PENDING`): `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`.
* **`total_amount`** (`DECIMAL(10,2)`): Total fare reserved for this booking.
* **`booked_at`** (`TIMESTAMPTZ`): Booking creation timestamp.
* **`cancelled_at`** / **`cancelled_by_id`** / **`cancellation_reason`**: Audit fields for cancellations.

#### 2.7 `emergency_contacts`
Safety contacts designated by a user to receive instant alerts during emergencies.
* **`contact_id`** (`UUID`, Primary Key): Unique identifier.
* **`user_id`** (`UUID`, Foreign Key $\to$ `users.user_id`): Contact owner.
* **`name`** (`VARCHAR(100)`): Contact name.
* **`phone`** (`VARCHAR(20)`): Mobile phone number with country code.
* **`relationship`** (`VARCHAR(50)`, Nullable): Relationship (e.g., "Parent", "Guardian", "Friend").
* **`is_primary`** (`BOOLEAN`, Default: `false`): Primary alert recipient flag.

#### 2.8 `sos_alerts`
Records one-touch distress activations.
* **`alert_id`** (`UUID`, Primary Key): Unique identifier.
* **`user_id`** (`UUID`, Foreign Key $\to$ `users.user_id`): User who triggered the SOS.
* **`ride_id`** (`UUID`, Foreign Key $\to$ `rides.ride_id`, Nullable): Active ride during distress.
* **`message`** (`TEXT`, Nullable): Optional message or automated distress note.
* **`latitude`** / **`longitude`** (`DECIMAL(9,6)`, Nullable): Exact GPS location at time of trigger.
* **`status`** (`SOSAlertStatus`, Default: `ACTIVE`): `ACTIVE`, `RESOLVED`, `CANCELLED`.
* **`created_at`** / **`resolved_at`** (`TIMESTAMPTZ`): Event timestamps.

#### 2.9 `sos_notifications`
Tracks individual SMS/notification delivery attempts for an SOS alert.
* **`notification_id`** (`UUID`, Primary Key): Unique identifier.
* **`alert_id`** (`UUID`, Foreign Key $\to$ `sos_alerts.alert_id`): Linked alert.
* **`contact_id`** (`UUID`, Foreign Key $\to$ `emergency_contacts.contact_id`, Nullable): Linked contact.
* **`recipient_phone`** (`VARCHAR(20)`): Recipient mobile number.
* **`recipient_name`** (`VARCHAR(100)`): Recipient full name.
* **`channel`** (`VARCHAR(20)`, Default: `SMS`): Dispatch channel.
* **`status`** (`NotificationStatus`, Default: `PENDING`): `PENDING`, `SENT`, `FAILED`.

#### 2.10 `transactions`
Append-only financial audit trail for all money movements (escrow payments, payouts, refunds).
* **`transaction_id`** (`UUID`, Primary Key): Unique identifier.
* **`booking_id`** (`UUID`, Foreign Key $\to$ `bookings.booking_id`): Linked booking.
* **`sender_id`** / **`receiver_id`** (`UUID`, Foreign Key $\to$ `users.user_id`, Nullable): Parties involved.
* **`amount`** (`DECIMAL(12,2)`): Transaction value.
* **`type`** (`TransactionType`): `BOOKING_PAYMENT`, `REFUND`, `PLATFORM_FEE`, `DRIVER_PAYOUT`.
* **`status`** (`TransactionStatus`, Default: `PENDING`): `PENDING`, `COMPLETED`, `FAILED`, `REVERSED`.
* **`provider_reference`** (`VARCHAR(150)`, Unique, Nullable): Razorpay / Gateway Payment ID.
* **`reference_transaction_id`** (`UUID`, Self-relation, Nullable): Points to the original payment for refunds.

#### 2.11 `driver_earnings`
Escrow record tracking payout eligibility for completed rides.
* **`earning_id`** (`UUID`, Primary Key): Unique identifier.
* **`booking_id`** (`UUID`, Foreign Key $\to$ `bookings.booking_id`, Unique): 1-to-1 link with booking.
* **`driver_id`** (`UUID`, Foreign Key $\to$ `users.user_id`): Driver to be paid.
* **`gross_amount`** (`DECIMAL(12,2)`): Total fare collected from passenger.
* **`platform_fee`** (`DECIMAL(12,2)`, Default: `0.00`): Platform commission (set to 0 for community fairness).
* **`net_amount`** (`DECIMAL(12,2)`): Net amount credited to driver wallet.
* **`status`** (`DriverEarningStatus`, Default: `PENDING`): `PENDING`, `AVAILABLE`, `PAID`, `REVERSED`.
* **`payout_transaction_id`** (`UUID`, Foreign Key $\to$ `transactions.transaction_id`, Unique, Nullable): Settled transaction.

---

## 3. How Core Features Work

### 3.1 Authentication & Secure HTTP-Only Cookies Architecture
1. **Zero Client-Side Token Storage**:
   - The platform strictly enforces **zero storage in `localStorage` or `sessionStorage`**.
   - Tokens and session identifiers are stored solely in **HTTP-only cookies** (`httpOnly: true`, `sameSite: 'lax'`, `path: '/'`), making them completely impenetrable to client-side JavaScript and impervious to cross-site scripting (XSS) token exfiltration.

2. **User Sign Up (`POST /api/v1/auth/signup`)**:
   - The user inputs `name`, `email`, `password`, and optional `phone`.
   - The password is encrypted with `bcrypt` (10 rounds).
   - The email domain is inspected after the `@` symbol:
     - **`gmail.com` or `yahoo.com`**: Kept in the **Open Category** and affiliated with the public **Open Community** (`domain: "open"`).
     - **Non-Generic Domains (e.g. `anindya@rishihood.edu.in`)**: The system looks up or automatically creates a dedicated community (e.g., `Rishihood` with domain `rishihood.edu.in`) and enrolls the user as an active member.
   - An HTTP-only 24-hour JWT token cookie is automatically set on the response.

3. **User Log In (`POST /api/v1/auth/login`)**:
   - Compares the hashed password and issues fresh secure HTTP-only cookies.
   - Idempotently guarantees the user's community affiliation exists.

4. **Current User Profile Retrieval (`GET /api/v1/me` or `/api/v1/auth/me`)**:
   - When the frontend loads or needs the current user's profile, it makes an authenticated request to `/api/v1/me` (or `/api/v1/auth/me`).
   - The browser automatically attaches the HTTP-only cookie credentials (`withCredentials: true`).
   - The `authenticate` middleware verifies the cookie and attaches the user state directly from PostgreSQL, keeping user profile data completely out of `localStorage`.

5. **Log Out (`POST /api/v1/auth/logout`)**:
   - Immediately clears and expires the HTTP-only cookies and ends active sessions.

### 3.2 Search & Ride Discovery (Open Category vs. Community)
- When a user searches without selecting a community or selects **"Open Category"**:
  - The backend does **not** restrict the search to community-only drivers. The user has access to **all available rides** across all verified drivers and corridors.
- When a user explicitly chooses a specific community (e.g., **"Rishihood"**):
  - The query strictly isolates the rides to drivers within that specific community domain.

### 3.3 Two-Step Ride Completion & Wallet Payouts
To prevent premature or unfair earnings transfers:
1. When a booking is created, the passenger's payment is held in escrow (`status: CONFIRMED`, `driverEarning.status: PENDING`).
2. When the trip ends, the driver marks the passenger's ride as finished (`POST /api/v1/rides/:rideId/complete`). The booking transitions to `COMPLETED`.
3. The passenger clicks **"Approve Payment"** (`POST /api/v1/bookings/:bookingId/approve-payment`).
4. **Only upon this two-step confirmation** is the net fare credited to the driver's internal `wallet_balance` via a recorded `DRIVER_PAYOUT` transaction.
5. If a passenger cancels or initiates a refund, the amount is automatically returned directly to the passenger's `wallet_balance` as a `REFUND` transaction.

### 3.4 Safety & SOS Emergency Alerts
- When a passenger or driver triggers the emergency button:
  - An active `SOSAlert` is created with live GPS latitude and longitude.
  - The system fetches all registered `EmergencyContacts` for the user.
  - Automated emergency SMS dispatches are triggered via the Twilio SMS integration containing the user's name, distress notice, and a live Google Maps pin link:
    ```
    EMERGENCY SOS: Aryan Rai has triggered an emergency alert on RideShare.
    Location: https://maps.google.com/?q=28.6894,77.2104
    ```

---

## 4. REST API Endpoint Reference

### Authentication & Identity (`/api/v1`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `GET` | `/me` | Top-level endpoint: fetch current user via HTTP-only cookie | Yes |
| `POST` | `/auth/signup` | Register new user with domain detection | No |
| `POST` | `/auth/login` | Authenticate user & set HTTP-only cookie | No |
| `POST` | `/auth/logout` | Invalidate active session & clear cookies | Yes |
| `GET` | `/auth/me` | Retrieve profile of currently authenticated user | Yes |
| `GET` | `/users/me` | Retrieve profile of currently authenticated user | Yes |
| `PATCH` | `/users/me` | Update permitted profile fields | Yes |

### Communities (`/api/v1/communities`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `GET` | `/` | List all active communities (supports domain search) | Public |
| `GET` | `/:communityId` | Get community details & member count | Public |
| `POST` | `/:communityId/join` | Join a community network | Yes |

### Vehicles (`/api/v1/vehicles`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `POST` | `/` | Register vehicle with license & seat capacity | Yes (Driver) |
| `GET` | `/` | List authenticated driver's registered vehicles | Yes (Driver) |

### Rides (`/api/v1/rides`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `POST` | `/` | Publish scheduled carpool route | Yes (Driver) |
| `GET` | `/` | Search available rides (corridor & community filter) | Public |
| `GET` | `/:rideId` | Detailed view of a specific ride | Public |
| `POST` | `/:rideId/complete` | Driver marks ride as completed for passengers | Yes (Driver) |

### Bookings (`/api/v1/bookings`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `POST` | `/` | Reserve passenger seats on an offered ride | Yes |
| `GET` | `/my` | View current user's passenger bookings | Yes |
| `POST` | `/:bookingId/approve-payment` | Passenger approves payment to credit driver's wallet | Yes (Rider) |
| `POST` | `/:bookingId/cancel` | Cancel booking & trigger automatic wallet refund | Yes |

### Safety & SOS (`/api/v1/sos` & `/api/v1/emergency-contacts`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `GET` | `/emergency-contacts` | List user's emergency contacts | Yes |
| `POST` | `/emergency-contacts` | Add emergency contact (phone, relation) | Yes |
| `POST` | `/sos` | Trigger one-touch SOS with live GPS & SMS dispatch | Yes |
| `GET` | `/sos/active` | Get current active distress status | Yes |
| `POST` | `/sos/:alertId/resolve` | Mark emergency resolved | Yes |

---

## 5. Local Setup & Execution Guide

### Prerequisites
- **Node.js** v20+ or v22+
- **PostgreSQL** database instance (or Supabase / Neon connection URL)

### Environment Configuration
Create a `.env` file inside `backend/`:
```env
PORT=5001
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/rydora?schema=public"
JWT_SECRET="your-super-secure-jwt-secret-key-at-least-32-chars"
TWILIO_ACCOUNT_SID="AC_optional_twilio_sid"
TWILIO_AUTH_TOKEN="optional_twilio_auth_token"
TWILIO_PHONE_NUMBER="+1234567890"
RAZORPAY_KEY_ID="rzp_test_optional"
RAZORPAY_KEY_SECRET="optional_secret"
```

### Setup Steps
```bash
# 1. Install dependencies for backend and frontend
cd backend && npm install
cd ../frontend && npm install

# 2. Generate Prisma Client & push schema migrations
cd ../backend
npx prisma generate
npx prisma db push

# 3. Build & verify both packages
npm run build
cd ../frontend && npm run build

# 4. Start Development Servers
# Terminal 1: Backend API (port 5001)
cd backend && npm run dev

# Terminal 2: Frontend App (port 5173 with proxy to 5001)
cd frontend && npm run dev
```

Open `http://localhost:5173` in your browser.
