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
| **Part 6** | Safety, Ratings and Trust | **COMPLETED** | Formatted and Validated (`prisma validate` passed) |
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

---

## Part 6: Safety, Ratings and Trust

### Models Implemented
1. `TrustedContact` — Up to 3 emergency contacts per user with relationship and emergency notification flags.
2. `SafetyIncident` — Incident reports linked optionally to rides, tracking reporters, reported users, severity, categories, and resolution logs.
3. `SOSAlert` — Immediate emergency alerts tied to an active ride with GPS coordinates, timestamps, and resolution audit.
4. `RideLocation` — Periodic GPS location breadcrumbs during active rides (prunable for privacy retention).
5. `RouteDeviationEvent` — Automated deviation detection with deviation distance metrics and driver/rider acknowledgments.
6. `SafetyEvidence` — Secure file attachments (photos, audio) for incident investigation with strict restriction flags.
7. `ConsentRecord` — Explicit user consents for location tracking, audio recording, and emergency data access.
8. `Rating` — Bidirectional 1-5 star ratings between rider and driver per booking, enforcing a single rating per rater per booking (`@@unique([bookingId, raterId])`).
9. `Review` — Qualitative review text and headlines linked 1-to-1 with a rating.
10. `FeedbackCategory` — Feedback tags (e.g., "Punctual", "Clean Car", "Safe Driver").
11. `FeedbackAnalysis` — Decoupled AI sentiment analysis (`SentimentLabel`, sentiment score, issue detection) that does not directly trigger automated administrative punishments.
12. `ModerationReport` — Administrative moderation queue for reported users, reviews, or chat incidents.
13. `DriverTier` — Tier definitions (Bronze, Silver, Gold, Platinum) with rating thresholds and commission incentives.
14. `DriverTierHistory` — Audit history of tier promotions and demotions.
15. `DriverIncentive` — Performance targets and bonus rewards with ride progress counters.

### Enums Implemented
- `IncidentSeverity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `IncidentStatus` (`REPORTED`, `INVESTIGATING`, `RESOLVED`, `DISMISSED`)
- `IncidentCategory` (`HARASSMENT`, `RECKLESS_DRIVING`, `ROUTE_DEVIATION`, `VEHICLE_CONDITION`, `PAYMENT_DISPUTE`, `OTHER`)
- `SOSAlertStatus` (`TRIGGERED`, `ACKNOWLEDGED`, `RESOLVED`, `FALSE_ALARM`)
- `DeviationStatus` (`DETECTED`, `ACKNOWLEDGED`, `RESOLVED`, `FALSE_POSITIVE`)
- `ConsentType` (`LOCATION_TRACKING`, `EMERGENCY_CONTACT_SHARING`, `AUDIO_RECORDING`, `MARKETING_COMMUNICATION`)
- `SentimentLabel` (`POSITIVE`, `NEUTRAL`, `NEGATIVE`)
- `ModerationTargetType` (`USER`, `REVIEW`, `COMMUNITY`, `CHAT`)
- `ModerationStatus` (`PENDING`, `INVESTIGATING`, `RESOLVED`, `DISMISSED`)
- `IncentiveStatus` (`ACTIVE`, `COMPLETED`, `EXPIRED`, `CANCELLED`)

### Relationships Created / Updated
- `User` ↔ `TrustedContact` (1-to-many, `Cascade` deletion).
- `User` ↔ `SafetyIncident` (`ReportedIncidents`, `IncidentsAgainstUser`, `ResolvedIncidents`).
- `Ride` ↔ `SafetyIncident` (1-to-many optional, `SetNull`).
- `Ride` ↔ `SOSAlert` (1-to-many, `Restrict` deletion).
- `User` ↔ `SOSAlert` (`SOSAlertsTriggered`, `SOSAlertsResolved`).
- `Ride` ↔ `RideLocation` (1-to-many, `Cascade` deletion).
- `Ride` ↔ `RouteDeviationEvent` (1-to-many, `Cascade` deletion).
- `SafetyIncident` ↔ `SafetyEvidence` (1-to-many, `Cascade` deletion).
- `User` ↔ `SafetyEvidence` (`EvidenceUploaded` relation, `Restrict` deletion).
- `User` ↔ `ConsentRecord` (1-to-many, `Cascade` deletion).
- `Booking` ↔ `Rating` (1-to-many, `Restrict` deletion).
- `Ride` ↔ `Rating` (1-to-many, `Restrict` deletion).
- `User` ↔ `Rating` (`RatingsGiven`, `RatingsReceived`, `Restrict` deletion).
- `Rating` ↔ `Review` (1-to-1, `Cascade` deletion).
- `Review` ↔ `FeedbackAnalysis` (1-to-1, `Cascade` deletion).
- `User` ↔ `ModerationReport` (`ModerationReportsFiled`, `ModerationReportsHandled`).
- `DriverTier` ↔ `DriverTierHistory` (1-to-many, `Restrict` deletion).
- `User` ↔ `DriverTierHistory` (1-to-many, `Cascade` deletion).
- `User` ↔ `DriverIncentive` (1-to-many, `Cascade` deletion).

### Validation Commands
- `npx prisma@6 format` -> Succeeded.
- `DATABASE_URL="..." npx prisma@6 validate` -> Validated successfully with 0 errors.
