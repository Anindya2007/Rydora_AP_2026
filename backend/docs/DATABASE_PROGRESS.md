# Rydora Database Architecture — Implementation Progress

This document tracks the incremental implementation and validation of the Rydora database schema.

---

## Part Tracking Overview

| Part | Module / Domain | Status | Validation Status |
| :--- | :--- | :--- | :--- |
| **Part 0** | Initial Repository Audit | **COMPLETED** | Repository, dependencies, and git state audited |
| **Part 1** | Identity, Authentication & Communities | **COMPLETED** | Formatted and Validated (`prisma validate` passed) |
| **Part 2** | Vehicles and Driver Eligibility | **COMPLETED** | Formatted and Validated (`prisma validate` passed) |
| **Part 3** | Rides and Routes | **COMPLETED** | Formatted and Validated (`prisma validate` passed) |
| **Part 4** | Bookings, Fare Quotes and Cancellations | **COMPLETED** | Formatted and Validated (`prisma validate` passed) |
| **Part 5** | Payments, Ledger and Driver Earnings | **COMPLETED** | Formatted and Validated (`prisma validate` passed) |
| **Part 6** | Safety, Ratings and Trust | Pending Confirmation | Not Started |
| **Part 7** | Notifications, Calendar, AI, Sustainability & Admin | Pending Confirmation | Not Started |
| **Part 8** | Final Schema Integration and Validation | Pending Confirmation | Not Started |

---

## Part 0: Initial Repository Audit Summary

- **Repository Branch:** `feature/badal-backend`
- **Existing Schema State:**
  - Initial `schema.prisma` contained incomplete definitions for `User` and `Ride`.
  - Both models referenced missing types (`UserRole`, `UserCommunity`, `Vehicle`, `Booking`, `Rating`, `Cancellation`, `Community`).
  - Schema was invalid under Prisma CLI due to missing models and unmapped relations.
  - Previous models used `Int` auto-increment primary keys instead of the architectural standard of UUIDs.
- **Migration Ownership:** Anindya owns the migration process; no migrations were run.
- **Action Plan:** Transition to modular UUID architecture, starting with core Identity and Community models in Part 1.

---

## Part 1: Identity, Authentication and Communities

### Models Implemented
1. `User` — Core user identity with soft delete (`deletedAt`), account status, phone/email verification timestamps, and UUID primary key.
2. `UserRole` — Multi-role assignment per user (`RIDER`, `DRIVER`, `ADMIN`) with composite unique constraint `[userId, role]`.
3. `UserSession` — Refresh token tracking, device info, IP address, and revocation timestamp.
4. `EmailVerification` — Secure token hash tracking for email verification.
5. `PasswordResetToken` — Secure token hash tracking for password recovery.
6. `PhoneVerification` — OTP hash, verification status, and attempt tracking.
7. `UserPreference` — 1-to-1 user settings (theme, language, accessibility JSON).
8. `Community` — University, Office, Neighborhood, and Private communities.
9. `CommunityMembership` — Many-to-many membership model with status, role, and verification tracking.
10. `CommunityDomain` — Allowed email domains for academic/corporate verification.
11. `CommunityInvite` — Hashed invite codes with usage counters and email restrictions.
12. `CommunityVerification` — Audit log of verification attempts with reviewer tracking.

### Enums Implemented
- `AccountStatus` (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`)
- `RoleType` (`RIDER`, `DRIVER`, `ADMIN`)
- `ThemeType` (`LIGHT`, `DARK`, `SYSTEM`)
- `CommunityType` (`UNIVERSITY`, `OFFICE`, `NEIGHBORHOOD`, `PRIVATE`)
- `CommunityStatus` (`ACTIVE`, `INACTIVE`, `SUSPENDED`)
- `MembershipStatus` (`PENDING`, `ACTIVE`, `REJECTED`, `REVOKED`)
- `CommunityRole` (`MEMBER`, `MODERATOR`, `ADMIN`)
- `VerificationStatus` (`NOT_STARTED`, `PENDING`, `VERIFIED`, `REJECTED`, `NOT_REQUIRED`)
- `VerificationMethod` (`EMAIL_DOMAIN`, `INVITE_CODE`, `MANUAL`)
- `VerificationAttemptStatus` (`PENDING`, `VERIFIED`, `REJECTED`, `EXPIRED`)

---

## Part 2: Vehicles and Driver Eligibility

### Models Implemented
1. `Vehicle` — Vehicles owned by users, tracking plate registration (unique), capacity, make/model, type, active status, and verification.
2. `DriverProfile` — 1-to-1 driver profile per user, tracking driver license verification, driver verification status, and overall eligibility (`ELIGIBLE`, `PENDING_REVIEW`, etc.).
3. `VehicleDocument` — Document verification audit trail for vehicle registration certificates (RC), insurance, pollution certificates, and permits with expiration dates and reviewer tracking.

### Enums Implemented
- `VehicleType` (`SEDAN`, `HATCHBACK`, `SUV`, `MOTORCYCLE`, `VAN`, `OTHER`)
- `DriverEligibilityStatus` (`ELIGIBLE`, `INELIGIBLE`, `PENDING_REVIEW`, `SUSPENDED`)
- `VehicleDocumentType` (`REGISTRATION_CERTIFICATE`, `INSURANCE`, `POLLUTION_FITNESS`, `COMMERCIAL_PERMIT`, `OTHER`)
- `DocumentVerificationStatus` (`PENDING`, `VERIFIED`, `REJECTED`, `EXPIRED`)

### Relationships Created / Updated
- `User` ↔ `Vehicle` (1-to-many, user can own multiple vehicles, cascade deletion on vehicle).
- `User` ↔ `DriverProfile` (1-to-1, cascade deletion on profile).
- `Vehicle` ↔ `VehicleDocument` (1-to-many, cascade deletion on documents).
- `User` ↔ `VehicleDocument` (`VehicleDocumentReviewedBy` relation, `SetNull` on reviewer deletion).

---

## Part 3: Rides and Routes

### Models Implemented
1. `Ride` — Core ride entity with origin & destination geo-coordinates, address and place IDs, departure time, seats allocation, pricing, and ride status.
2. `RideCommunity` — Many-to-many junction table connecting a ride to multiple authorized communities with composite unique constraint `[rideId, communityId]`.
3. `RideStop` — Ordered intermediate stops (pickup, drop-off, waypoint) with strictly enforced sequence uniqueness `[rideId, sequence]`.
4. `RideRoute` — Practical 1-to-1 routing entity storing polyline geometry, distance in meters, duration in seconds, provider reference, and route metadata without requiring complex PostGIS dependencies.

### Enums Implemented
- `RideStatus` (`SCHEDULED`, `ACTIVE`, `COMPLETED`, `CANCELLED`)
- `StopType` (`PICKUP`, `DROPOFF`, `WAYPOINT`)

### Relationships Created / Updated
- `User` ↔ `Ride` (`DriverRides` relation, `Restrict` deletion on user when rides exist).
- `Vehicle` ↔ `Ride` (1-to-many, `Restrict` deletion on vehicle when rides exist).
- `Ride` ↔ `RideCommunity` (1-to-many, `Cascade` deletion).
- `Community` ↔ `RideCommunity` (1-to-many, `Cascade` deletion).
- `Ride` ↔ `RideStop` (1-to-many, `Cascade` deletion).
- `Ride` ↔ `RideRoute` (1-to-1, `Cascade` deletion).

---

## Part 4: Bookings, Fare Quotes and Cancellations

### Models Implemented
1. `Booking` — Rider seat reservation capturing agreed pickup/drop-off, seat counts, immutable fare snapshot, lifecycle status, and confirmation timestamps.
2. `FareQuote` — Pre-booking pricing quotation with validity period, calculation details, and line item breakdown.
3. `FareLineItem` — Granular fare calculation components (base fare, distance, time, surge, platform fee, community discounts).
4. `CancellationPolicy` — Configurable cancellation rules (free cancellation window, percentage/flat penalty).
5. `Cancellation` — Cancellation audit trail recording responsible party (`RIDER`, `DRIVER`, `PLATFORM`), reason, timestamp, and calculated penalty.
6. `NoShowRecord` — Explicit tracking for rider/driver no-shows with wait duration evidence and review status.
7. `PenaltyAssessment` — Non-settlement penalty evaluation decoupled from real payments, referencing policy and responsible party.
8. `DisputeCase` — Rider/driver dispute lifecycle management with administrative review and resolution auditing.

### Enums Implemented
- `BookingStatus` (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `EXPIRED`)
- `FareQuoteStatus` (`ACTIVE`, `ACCEPTED`, `EXPIRED`, `REJECTED`)
- `FareLineItemType` (`BASE_FARE`, `DISTANCE_FARE`, `TIME_FARE`, `PLATFORM_FEE`, `COMMUNITY_DISCOUNT`, `SURGE`, `TAX`, `OTHER`)
- `ResponsibleParty` (`RIDER`, `DRIVER`, `PLATFORM`)
- `NoShowStatus` (`PENDING`, `VERIFIED`, `REJECTED`)
- `PenaltyAssessmentStatus` (`PENDING`, `WAIVED`, `APPLIED`, `DISPUTED`)
- `DisputeStatus` (`OPEN`, `UNDER_REVIEW`, `RESOLVED`, `REJECTED`)

---

## Part 5: Payments, Ledger and Driver Earnings

### Models Implemented
1. `Payment` — Actual payment attempts with gateway reference, idempotency keys, currency, status, and simulated flag.
2. `Refund` — Refund tracking referencing original payment, requested amounts, processing timestamps, and status.
3. `FinancialAccount` — Internal financial account entities (User Wallet, Driver Escrow, Platform Treasury) decoupled from external real settlement.
4. `LedgerTransaction` — Balanced ledger transaction records grouping double-entry journal operations with idempotency protection.
5. `LedgerEntry` — Individual debit/credit double-entry bookkeeping lines with running balance auditing.
6. `DriverEarning` — Driver earnings accounting per ride/booking tracking gross fares, platform commissions, deductions, net payouts, and payout status.

### Enums Implemented
- `PaymentMethod` (`CARD`, `UPI`, `NET_BANKING`, `WALLET`, `SIMULATED`)
- `PaymentStatus` (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`)
- `RefundStatus` (`PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`)
- `FinancialAccountType` (`USER_WALLET`, `DRIVER_ESCROW`, `PLATFORM_TREASURY`)
- `FinancialAccountStatus` (`ACTIVE`, `FROZEN`, `CLOSED`)
- `LedgerTransactionType` (`RIDE_PAYMENT`, `DRIVER_PAYOUT`, `PLATFORM_COMMISSION`, `REFUND`, `PENALTY`, `INCENTIVE`)
- `LedgerEntryType` (`DEBIT`, `CREDIT`)
- `DriverEarningStatus` (`PENDING`, `AVAILABLE`, `PAID_OUT`, `WITHHELD`)

### Relationships Created / Updated
- `User` ↔ `Payment` (`UserPayments` relation, `Restrict` deletion).
- `Booking` ↔ `Payment` (1-to-many, `Restrict` deletion).
- `Payment` ↔ `Refund` (1-to-many, `Restrict` deletion).
- `User` ↔ `Refund` (`RefundsRequested` relation, `Restrict` deletion).
- `User` ↔ `FinancialAccount` (1-to-1, `Restrict` deletion).
- `FinancialAccount` ↔ `LedgerEntry` (1-to-many, `Restrict` deletion).
- `LedgerTransaction` ↔ `LedgerEntry` (1-to-many, `Cascade` deletion).
- `User` ↔ `DriverEarning` (`DriverEarnings` relation, `Restrict` deletion).
- `Ride` ↔ `DriverEarning` (1-to-many, `Restrict` deletion).
- `Booking` ↔ `DriverEarning` (1-to-1 optional, `SetNull`).

### Validation Commands
- `npx prisma@6 format` -> Succeeded.
- `DATABASE_URL="..." npx prisma@6 validate` -> Validated successfully with 0 errors.
