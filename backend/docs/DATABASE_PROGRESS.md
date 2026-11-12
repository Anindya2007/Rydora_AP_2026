# Rydora Database Architecture — Implementation Progress

This document tracks the incremental implementation and validation of the Rydora database schema.

---

## Part Tracking Overview

| Part | Module / Domain | Status | Validation Status |
| :--- | :--- | :--- | :--- |
| **Part 0** | Initial Repository Audit | **COMPLETED** | Repository, dependencies, and git state audited |
| **Part 1** | Identity, Authentication & Communities | **COMPLETED** | Formatted and Validated (`prisma validate` passed) |
| **Part 2** | Vehicles and Driver Eligibility | **COMPLETED** | Formatted and Validated (`prisma validate` passed) |
| **Part 3** | Rides and Routes | Pending Confirmation | Not Started |
| **Part 4** | Bookings, Fare Quotes and Cancellations | Pending Confirmation | Not Started |
| **Part 5** | Payments, Ledger and Driver Earnings | Pending Confirmation | Not Started |
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

### Validation Commands
- `npx prisma@6 format` -> Succeeded.
- `DATABASE_URL="..." npx prisma@6 validate` -> Validated successfully with 0 errors.
