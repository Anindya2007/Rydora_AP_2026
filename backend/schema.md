# Rydora Database Schema

## 1. Purpose

This document explains the proposed Rydora database structure, the purpose of each model, how the models relate to one another, and how the main application workflows use them.

The design covers:

1. User profile and driver profile in one table
2. Role-based access
3. Community management and membership
4. Vehicle information
5. Ride creation and management
6. Ride discovery and recommendation
7. Booking and cancellation
8. Aggregate user ratings
9. Emergency contacts and SOS alerts
10. Payments, refunds, platform fees, and driver earnings

The schema contains **10 Prisma models**:

| # | Model | Main responsibility |
|---:|---|---|
| 1 | `User` | Stores user details, driver details, roles, wallet balance, and aggregate rating |
| 2 | `Community` | Stores each community and its creator |
| 3 | `CommunityMembership` | Connects users to communities and stores membership status/role |
| 4 | `Vehicle` | Stores vehicles belonging to drivers |
| 5 | `Ride` | Stores rides offered by drivers |
| 6 | `Booking` | Stores ride bookings and cancellation details |
| 7 | `EmergencyContact` | Stores a user's emergency contacts |
| 8 | `SOSAlert` | Stores emergency alerts raised by users |
| 9 | `Transaction` | Stores payment, refund, platform-fee, and payout movements |
| 10 | `DriverEarning` | Stores the driver's gross amount, platform fee, net earning, and payout state |

This is a **proposed schema**, not a statement that the database has already been created. No migration or database operation is included in this document.

---

## 2. Overall relationship structure

```text
User
 ├── creates ─────────────── Community
 ├── joins ───────────────── CommunityMembership ─── Community
 ├── owns ────────────────── Vehicle
 ├── drives ──────────────── Ride ─────────────────── Community
 │                            ├── has ─────────────── Booking
 │                            └── may be linked to ── SOSAlert
 ├── makes ───────────────── Booking
 ├── saves ───────────────── EmergencyContact
 ├── raises ──────────────── SOSAlert
 ├── sends / receives ────── Transaction
 └── earns ───────────────── DriverEarning

Booking
 ├── has multiple ────────── Transaction records
 └── has zero or one ─────── DriverEarning record

Transaction
 ├── may reference ──────── another Transaction (e.g. refund -> original payment)
 └── may be linked to ───── DriverEarning payout
```

### Main relationship cardinalities

| Relationship | Cardinality | Explanation |
|---|---|---|
| User → Community | One-to-many | A user can create multiple communities. |
| User ↔ Community | Many-to-many through `CommunityMembership` | A user can join multiple communities, and a community can have multiple users. |
| User → Vehicle | One-to-many | A driver can register multiple vehicles. |
| User → Ride | One-to-many | A driver can publish multiple rides. |
| Community → Ride | One-to-many | A community can contain many rides. |
| Ride → Booking | One-to-many | A ride can receive bookings from multiple users. |
| User → Booking | One-to-many | A user can make multiple bookings. |
| User → EmergencyContact | One-to-many | A user can save multiple emergency contacts. |
| User → SOSAlert | One-to-many | A user can raise multiple SOS alerts. |
| Booking → Transaction | One-to-many | A booking can have a payment, one or more refunds, and related money movements. |
| Booking → DriverEarning | One-to-zero-or-one | A booking can have one driver earning record once the earning is calculated. |
| User → DriverEarning | One-to-many | A driver can have earning records for many bookings. |

---

## 3. Model-by-model explanation

## 3.1 `User`

**Purpose:** Stores the common profile for every account. Driver-specific information is kept in the same table so a separate driver profile table is not required.

| Field | Meaning |
|---|---|
| `userId` | UUID primary key for the user. |
| `name` | User's display name. |
| `email` | Unique login/contact email. |
| `phone` | Optional unique phone number. |
| `passwordHash` | Hashed password; never store a plain-text password. |
| `profileImage` | Optional profile image URL or storage reference. |
| `roles` | PostgreSQL enum array containing `USER`, `DRIVER`, or both. |
| `licenseNumber` | Optional driver's licence number; populated for drivers. |
| `licenseExpiry` | Optional driver's licence expiry date. |
| `driverVerified` | Whether driver verification has been completed. |
| `walletBalance` | Internal wallet balance, if the wallet feature is enabled. |
| `averageRating` | Aggregate average rating for the user. |
| `ratingCount` | Number of ratings included in the average. |
| `createdAt`, `updatedAt` | Record creation and last-update timestamps. |

### How roles work

- A normal account can have `roles = [USER]`.
- A driver account can have `roles = [USER, DRIVER]` because a driver can also book rides.
- Backend authorization must check the required role before allowing driver-only actions such as creating a ride or registering a vehicle.
- The database enum stores allowed role values, but the application must still enforce role permissions.

### How the driver profile works

Driver fields are nullable because not every user is a driver. A user becomes eligible to perform driver actions only after the application verifies the required driver information and sets the `DRIVER` role and verification state appropriately.

### How ratings work

This design stores only `averageRating` and `ratingCount`. When a new rating is submitted, backend logic must calculate and update the aggregate. It does **not** store each review, review text, who rated whom, or rating history. Add a separate `Rating` model later if those details are required.

### Wallet balance warning

`walletBalance` is a cached balance, not a transaction history. Every balance change must be supported by a corresponding completed transaction and performed atomically with that transaction update. Do not increment a balance just because a transaction is pending.

---

## 3.2 `Community`

**Purpose:** Stores the communities available in Rydora.

| Field | Meaning |
|---|---|
| `communityId` | UUID primary key. |
| `name` | Community name. |
| `domain` | Community's email/institution domain or domain identifier. |
| `description` | Optional description. |
| `status` | `ACTIVE` or `INACTIVE`. |
| `createdById` | Foreign key to the user who created the community. |
| `createdAt`, `updatedAt` | Timestamps. |

`createdById` identifies the community creator. It does not represent every member. Membership is stored in `CommunityMembership`.

The schema indexes `domain` to support domain-based lookup. It does not make `domain` unique; add a uniqueness rule only after confirming that each domain can belong to exactly one community.

---

## 3.3 `CommunityMembership`

**Purpose:** Connects users and communities.

A separate membership model is retained because one user may belong to more than one community, and one community may contain many users. A single `communityId` column on `User` would restrict each user to only one community.

| Field | Meaning |
|---|---|
| `membershipId` | UUID primary key. |
| `communityId` | Foreign key to `Community`. |
| `userId` | Foreign key to `User`. |
| `memberRole` | Community-level role: `MEMBER` or `ADMIN`. |
| `status` | `ACTIVE` or `INACTIVE`. |
| `joinedAt` | When the user joined. |

The combination of `communityId` and `userId` is unique. This prevents duplicate membership rows for the same user in the same community. The `memberRole` is separate from the global `User.roles` field: a user can be a community admin without automatically becoming a platform-wide admin.

---

## 3.4 `Vehicle`

**Purpose:** Stores vehicle details for drivers.

| Field | Meaning |
|---|---|
| `vehicleId` | UUID primary key. |
| `driverId` | Foreign key to the owning driver in `User`. |
| `vehicleType` | Vehicle category, such as car or bike. Stored as text to keep categories flexible. |
| `make`, `model` | Manufacturer and model. |
| `registrationNumber` | Unique vehicle registration number. |
| `color` | Optional vehicle color. |
| `seatCapacity` | Maximum passenger capacity recorded for the vehicle. |
| `isActive` | Whether this vehicle is available for use. |
| `createdAt`, `updatedAt` | Timestamps. |

A user can register multiple vehicles. The backend must verify that the user has the `DRIVER` role and that the selected vehicle belongs to that driver before publishing a ride. The schema's foreign keys alone do not prove that a vehicle selected for a ride belongs to the same user listed as the ride's driver.

---

## 3.5 `Ride`

**Purpose:** Stores rides created by drivers and provides the data needed for discovery.

| Field | Meaning |
|---|---|
| `rideId` | UUID primary key. |
| `driverId` | Foreign key to the driver in `User`. |
| `vehicleId` | Foreign key to the vehicle used for the ride. |
| `communityId` | Foreign key to the community in which the ride is offered. |
| `source`, `destination` | Pickup and destination names/addresses. |
| `departureTime` | Scheduled departure timestamp. |
| `sourceLatitude`, `sourceLongitude` | Optional source coordinates. |
| `destinationLatitude`, `destinationLongitude` | Optional destination coordinates. |
| `totalSeats` | Total bookable seats offered for the ride. |
| `availableSeats` | Seats still available for booking. |
| `farePerSeat` | Price for one seat. |
| `status` | `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`. |
| `createdAt`, `updatedAt` | Timestamps. |

### Ride discovery and recommendations

No separate recommendation table is required for the current feature scope. Discovery can query rides using:

- Community membership and `communityId`.
- Ride `status` and `departureTime`.
- Source and destination text.
- Coordinates for proximity/distance calculations.

Recommendation logic belongs in backend services. It can rank matching rides by route proximity, departure-time closeness, available seats, or other criteria. The indexes in the model support common filters; they do not themselves implement a recommendation algorithm.

### Seat management

When a booking is accepted, the backend must verify that `availableSeats` is at least the requested seat count and decrement it safely. Cancellation may restore the seats according to the cancellation rules. These operations should use a database transaction or an atomic conditional update to prevent two simultaneous bookings from taking the same final seat.

---

## 3.6 `Booking`

**Purpose:** Stores a user's request/reservation for seats on a ride. Cancellation details are included in this model, removing the need for a separate `BookingCancellation` model.

| Field | Meaning |
|---|---|
| `bookingId` | UUID primary key. |
| `rideId` | Foreign key to the booked ride. |
| `riderId` | Foreign key to the user who made the booking. |
| `seatsBooked` | Number of seats requested. |
| `status` | `PENDING`, `CONFIRMED`, `COMPLETED`, or `CANCELLED`. |
| `totalAmount` | Amount agreed for this booking. Keep this value as a snapshot even if the ride's fare changes later. |
| `bookedAt`, `updatedAt` | Booking timestamps. |
| `cancelledAt` | Nullable cancellation timestamp. |
| `cancelledById` | Nullable user ID of the actor who cancelled it. Can be null for a system-triggered cancellation. |
| `cancellationReason` | Optional reason for cancellation. |

### Booking flow

1. A user selects a ride and requests one or more seats.
2. The backend checks ride status, seat availability, community eligibility, and booking rules.
3. A booking is created with `PENDING` status.
4. After the required confirmation/payment/acceptance steps, the backend updates the booking status.
5. When the ride is completed, its booking can become `COMPLETED`.
6. When cancelled, the status becomes `CANCELLED`, and the cancellation fields are populated.

A payment being completed and a ride booking being completed are different events. Payment status belongs in `Transaction`; ride/booking lifecycle status belongs in `Ride` and `Booking`.

The schema does not force one booking per user per ride. This allows a user to cancel and book again. The backend must prevent duplicate or conflicting active bookings according to the product rules.

---

## 3.7 `EmergencyContact`

**Purpose:** Stores contacts that can be notified when a user raises an SOS alert.

| Field | Meaning |
|---|---|
| `contactId` | UUID primary key. |
| `userId` | Foreign key to the owner of the contact. |
| `name` | Contact's name. |
| `phone` | Contact phone number. |
| `relationship` | Optional relationship label. |
| `isPrimary` | Whether this is the user's preferred emergency contact. |
| `createdAt` | Creation timestamp. |

The combination of `userId` and `phone` is unique, preventing the same number from being saved twice for one user. Backend logic should ensure the user has at most one primary contact at a time.

---

## 3.8 `SOSAlert`

**Purpose:** Records an emergency alert raised by a user.

| Field | Meaning |
|---|---|
| `alertId` | UUID primary key. |
| `userId` | User who raised the alert. |
| `rideId` | Optional related ride. It is nullable so a user can raise an SOS outside an active ride. |
| `message` | Optional alert details. |
| `latitude`, `longitude` | Optional location captured when the alert was raised. |
| `status` | `ACTIVE`, `RESOLVED`, or `CANCELLED`. |
| `createdAt` | Time the alert was created. |
| `resolvedAt` | Optional time the alert was resolved. |

The optional ride relation uses `SetNull`, so removing a ride reference does not require deleting the SOS record. SOS history should be retained for safety and auditing purposes.

The database stores the emergency contact list and alert record. Sending SMS, calling contacts, or notifying emergency services must be implemented by backend integrations; a database relation does not send notifications by itself.

---

## 3.9 `Transaction`

**Purpose:** Stores actual or attempted money movements related to bookings. This one model is used for booking payments, refunds, platform fees, and driver payouts. A separate `Refund` model is not included in this version.

| Field | Meaning |
|---|---|
| `transactionId` | UUID primary key. |
| `bookingId` | Foreign key to the related booking. |
| `senderId` | Optional user sending the money. |
| `receiverId` | Optional user receiving the money. |
| `amount` | Amount recorded for this movement. |
| `currency` | Currency code; defaults to `INR`. |
| `type` | `BOOKING_PAYMENT`, `REFUND`, `PLATFORM_FEE`, or `DRIVER_PAYOUT`. |
| `status` | `PENDING`, `COMPLETED`, `FAILED`, or `REVERSED`. |
| `paymentMethod` | Optional method such as UPI, card, or wallet. |
| `providerReference` | Optional unique reference supplied by an external payment provider. |
| `referenceTransactionId` | Optional self-reference to another transaction, normally the original payment for a refund. |
| `description` | Optional explanation. |
| `createdAt`, `updatedAt` | Timestamps. |
| `completedAt` | Optional successful-completion timestamp. |

### How payment and refund records work

- A booking payment is saved as a `BOOKING_PAYMENT` transaction.
- A refund is saved as a new `REFUND` transaction. The original payment is not overwritten or deleted.
- `referenceTransactionId` links the refund to the original payment. This permits multiple partial refunds against one payment.
- A platform fee is recorded as `PLATFORM_FEE`.
- A driver payout is recorded as `DRIVER_PAYOUT` and can be linked to the relevant `DriverEarning` record.

`senderId` and `receiverId` are nullable so a transaction can represent a movement between a user and an external payment provider/platform account that is not itself a `User` row. For an internal user-to-user wallet transfer, both IDs should be present. Backend validation must require at least one participant and validate that the referenced users and transaction type make sense.

### Important transaction rules

1. Do not mark a transaction `COMPLETED` until the payment provider confirms success or the internal wallet transfer succeeds.
2. Update wallet balances and transaction status atomically. Do not credit a driver merely because the receiver has the `DRIVER` role.
3. Verify that the receiver is the driver assigned to the booking's ride before crediting driver funds.
4. Use an idempotency mechanism/provider reference to prevent duplicate credits when a payment provider retries a webhook. `providerReference` is unique when supplied, but the backend must still process callbacks safely.
5. A refund must be a new transaction linked to the original payment; do not edit the original payment amount or status to pretend it was a refund.
6. When platform commission applies, calculate the driver's net earning as gross amount minus platform fee. Keep the earning calculation consistent with the actual money movements.

The two user IDs alone do not represent a bank account or payment gateway account. A null participant indicates the other side is external/platform-side and must be interpreted from `type`, `paymentMethod`, and provider details.

---

## 3.10 `DriverEarning`

**Purpose:** Stores the earning calculation for each completed/eligible booking, making the driver's earnings dashboard straightforward without calculating every view from raw transaction rows.

| Field | Meaning |
|---|---|
| `earningId` | UUID primary key. |
| `bookingId` | Unique foreign key to the booking; one earning summary per booking in this design. |
| `driverId` | Foreign key to the driver who owns the earning. |
| `grossAmount` | Gross booking amount allocated to the driver before platform fee. |
| `platformFee` | Platform commission/fee deducted from the gross amount. |
| `netAmount` | Amount payable to the driver after the fee. |
| `status` | `PENDING`, `AVAILABLE`, `PAID`, or `REVERSED`. |
| `payoutTransactionId` | Optional unique link to the transaction used to pay out this earning. |
| `createdAt`, `updatedAt` | Timestamps. |
| `paidAt` | Optional payout completion time. |

### Why this is separate from `Transaction`

`Transaction` is the financial movement history. `DriverEarning` is the driver's earning statement. They answer different questions:

- Transaction: What money movement occurred, between which participants, and did it succeed?
- DriverEarning: How much did the driver earn from this booking, what fee was deducted, and is the amount available or paid?

The driver dashboard can query `DriverEarning` by `driverId` and status. It can show gross earnings, platform fees, net earnings, pending amounts, and paid amounts. The dashboard should not add `Transaction.amount` and `DriverEarning.netAmount` together; they represent related aspects of the same financial flow, not two separate earnings.

A payout should create a `DRIVER_PAYOUT` transaction and link it through `payoutTransactionId`. The earning should become `PAID` only after that payout is confirmed.

---

## 4. Enums and allowed values

| Enum | Values | Used by |
|---|---|---|
| `UserRole` | `USER`, `DRIVER` | `User.roles` |
| `CommunityStatus` | `ACTIVE`, `INACTIVE` | `Community.status` |
| `MembershipStatus` | `ACTIVE`, `INACTIVE` | `CommunityMembership.status` |
| `CommunityMemberRole` | `MEMBER`, `ADMIN` | `CommunityMembership.memberRole` |
| `RideStatus` | `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | `Ride.status` |
| `BookingStatus` | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` | `Booking.status` |
| `SOSAlertStatus` | `ACTIVE`, `RESOLVED`, `CANCELLED` | `SOSAlert.status` |
| `TransactionType` | `BOOKING_PAYMENT`, `REFUND`, `PLATFORM_FEE`, `DRIVER_PAYOUT` | `Transaction.type` |
| `TransactionStatus` | `PENDING`, `COMPLETED`, `FAILED`, `REVERSED` | `Transaction.status` |
| `DriverEarningStatus` | `PENDING`, `AVAILABLE`, `PAID`, `REVERSED` | `DriverEarning.status` |

---

## 5. End-to-end workflows

### A. User joins a community

1. A community is created by a user. `Community.createdById` stores its creator.
2. When another user joins, create a `CommunityMembership` row with the relevant `communityId` and `userId`.
3. Set `memberRole` and `status` according to the membership rules.
4. Ride discovery can use the user's active community memberships to determine which community rides they can see.

### B. Driver publishes a ride

1. Verify the user has the `DRIVER` role and has passed driver verification.
2. Verify the selected vehicle belongs to that driver and is active.
3. Create a `Ride` with driver, vehicle, community, route, departure time, seats, fare, and status.
4. Set `availableSeats` initially to the permitted bookable seat count.

### C. Rider books a ride

1. Check that the ride is scheduled and has enough available seats.
2. Check community eligibility and any other booking restrictions.
3. Create a `Booking` with a snapshot of the agreed `totalAmount` and requested `seatsBooked`.
4. Safely reserve/decrement the seats.
5. Record payment attempts in `Transaction`.
6. Update booking state according to the confirmation process.

### D. Booking is cancelled

1. Change `Booking.status` to `CANCELLED`.
2. Populate `cancelledAt`, `cancelledById`, and `cancellationReason`.
3. Restore seats only when permitted by the cancellation policy.
4. If a refund is due, create a separate `Transaction` with type `REFUND`, and set `referenceTransactionId` to the original payment transaction.
5. Do not mark the refund completed until the payment provider confirms it.

### E. Driver completes a ride and receives earnings

1. Mark the ride and relevant booking as completed according to the application workflow.
2. Calculate the booking's gross amount, platform fee, and net driver earning.
3. Create or update the `DriverEarning` record.
4. Mark it `AVAILABLE` when the earning is eligible for payout.
5. When a payout is initiated, create a `DRIVER_PAYOUT` transaction and link it to the earning.
6. After payout confirmation, update the transaction and earning to `COMPLETED`/`PAID` and set `paidAt`.

### F. User raises an SOS alert

1. Create an `SOSAlert` for the user, optionally linking it to the active ride.
2. Save the available location and message.
3. Retrieve the user's `EmergencyContact` records.
4. Trigger notifications through backend messaging/provider integrations.
5. Update the SOS status and `resolvedAt` when resolved.

---

## 6. Ride discovery and recommendation logic

A separate `Recommendation` model is not included because recommendations are derived from existing ride data. A backend service can:

1. Restrict results to communities the user belongs to.
2. Filter to scheduled rides with future departure times and available seats.
3. Compare the requested origin/destination with the ride's source/destination and coordinates.
4. Rank matches by route distance, time difference, available seats, and other product rules.

The current indexes provide basic query support. If geographic search becomes a major feature, evaluate PostgreSQL PostGIS or another location-search strategy rather than assuming ordinary text indexes provide accurate distance calculations.

---

## 7. Important integrity rules to enforce

Some business rules cannot be fully expressed by these Prisma relations alone. Enforce them in backend services and, where suitable, add PostgreSQL `CHECK` constraints through a reviewed SQL migration.

| Rule | Where to enforce |
|---|---|
| `seatCapacity` must be positive. | Validation and database constraint. |
| `totalSeats` must be positive. | Validation and database constraint. |
| `availableSeats` must be between zero and `totalSeats`. | Atomic booking logic and database constraint. |
| `seatsBooked` must be positive and no greater than available seats at booking time. | Booking service and atomic seat update. |
| Fare and transaction amounts must not be negative. | Validation and database constraint. |
| `averageRating` must be within the permitted rating scale (for example, 0–5). | Rating service and database constraint. |
| The user creating a ride must have the `DRIVER` role and pass verification. | Authorization/service logic. |
| The ride's vehicle must belong to the same driver referenced by the ride. | Ride service validation. |
| A booking rider must satisfy community eligibility rules. | Booking service validation. |
| A transaction receiver must be the intended recipient for that booking/ride. | Transaction service validation. |
| Wallet balance changes must match completed wallet transactions. | Atomic transaction service. |
| A refund must reference a valid original payment and cannot exceed the refundable balance. | Refund service validation. |
| `netAmount` must equal `grossAmount - platformFee`. | Earning calculation service and/or database constraint. |
| An emergency contact marked primary should be the user's only primary contact. | Service logic or a PostgreSQL partial unique index. |

For concurrent bookings, use a database transaction and an atomic conditional update of `availableSeats`; a read-then-write sequence without concurrency protection can oversell seats.

---

## 8. Tables intentionally not included

| Excluded model | Reason |
|---|---|
| `DriverProfile` | Driver-specific fields are included in `User`. |
| `BookingCancellation` | Cancellation fields are stored in `Booking`. |
| `Refund` | Refunds are represented as `Transaction` rows linked to their original payment. |
| `Payment` | Payments are represented by `Transaction` rows. |
| `Rating` | Only the aggregate rating and count are stored in `User`; no per-review history is required in the current design. |
| `Recommendation` | Recommendations are generated by backend query/ranking logic. |
| `DriverEarning` is not excluded | It is retained because the driver's earning breakdown and payout lifecycle are distinct from raw transaction movements. |

---

## 9. Prisma 7 configuration note

This schema uses the Prisma 7-style `prisma-client` generator and intentionally does not put `url` inside the `datasource` block. The database URL is configured in `prisma.config.ts`.

Example `prisma.config.ts` at the project root:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

The `output` path in the generator assumes this file is saved at `prisma/schema.prisma`. Adjust it only if your project uses a different folder layout.

---

## 10. Decisions to confirm before migrations

1. **Wallet vs direct payments:** Confirm whether Rydora will maintain an actual in-app wallet for riders and drivers, or whether the payment gateway will transfer funds directly. `walletBalance` is included for an internal wallet, but the transaction workflow must match the chosen payment architecture.
2. **Community domain rule:** Confirm whether one email domain can belong to only one community. The current schema does not make `domain` unique.
3. **Booking confirmation:** The enum includes `CONFIRMED` in addition to `PENDING`, `COMPLETED`, and `CANCELLED` to distinguish an accepted booking from a request that is still awaiting confirmation.
4. **Ratings:** Confirm that only aggregate ratings are required. Per-user review history would require a separate `Rating` model.
5. **Currency:** The transaction currency defaults to `INR`. Add multi-currency rules only if the application needs them.
6. **Community administration:** `CommunityMembership.memberRole` supports `MEMBER` and `ADMIN`. Confirm whether additional community-level roles are needed.

---

## 11. Validation and migration status

- This is a proposed Prisma schema and explanatory document.
- The Prisma CLI is not installed in the file-generation environment, so `prisma validate` has not been run here.
- No Prisma Client generation, migration, database connection, table creation, or data modification has been performed.
- Before migration, validate the schema using the Prisma version installed in the project, review the generated SQL, and test the migration against an isolated PostgreSQL database.
