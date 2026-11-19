# 📋 RYDORA — PRODUCT DECISION REGISTER (PDR)

**Project:** Rydora RideShare & Carpooling Ecosystem (AP Capstone 2026)  
**Document Status:** Formal Decision Register — Milestone 1 Baseline  
**Audience:** All 4 Developers (Badal, Anindya, Athar, Anshika) & Project Mentors  
**Scope:** Core Architecture, Access Control, Business Policies, and Financial Mechanics  

---

## Executive Summary & Status Flags Legend

Each architectural and product decision is evaluated across technical feasibility, security implications, data integrity, and student capstone constraints.

- `[RECOMMENDATION]`: Technically analyzed proposal by the Lead Backend Architect (Anindya).
- `[REQUIRES TEAM APPROVAL]`: Must be reviewed and agreed upon by the 4 developers before implementation.
- `[BLOCKS IMPLEMENTATION]`: Work on the dependent domain module cannot proceed until a choice is finalized.
- `[DOES NOT BLOCK CURRENT FOUNDATION]`: Milestone 1 (shared foundation) is agnostic and operational regardless of the choice.

---

## 1. Authentication & Identity

### Decision 01: Authentication Mechanism (Cookie-Based Sessions vs. Bearer JWT)
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Badal AUTH-02]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Should Rydora use HTTP-only cookie-based sessions or Bearer token JWTs in the `Authorization` header? What should be the access-token expiry and refresh-token policy?
- **Available Options:**
  - **Option A:** Bearer JWT in `Authorization` header (Access Token: 15 minutes, Refresh Token: 7-30 days stored in database).
  - **Option B:** HTTP-only, Secure SameSite Cookies storing session IDs or JWTs.
  - **Option C:** Pure long-lived JWTs (24 hours) with no refresh tokens or revocation.
- **Recommendation:** **Option A (Bearer JWT with short-lived access tokens and database-backed refresh tokens)**.
- **Trade-offs:**
  - *Option A Pros:* Simplifies development across React (Vite) frontend, mobile clients, and Postman/curl testing; avoids complex CSRF token setups in early capstone stages; token reuse detection in PostgreSQL allows immediate revocation on compromise.
  - *Option A Cons:* Requires frontend local storage / memory management and explicit token refresh interceptors.
  - *Option B Pros:* Automatic browser transmission, immune to XSS token theft.
  - *Option B Cons:* Requires strict CSRF defenses and custom CORS credentials handling across development ports (`localhost:5173` vs `localhost:5000`).
  - *Option C Pros:* Minimal backend code.
  - *Option C Cons:* Severe security vulnerability: stolen tokens cannot be revoked before expiry.
- **Affected Modules:** `auth.service.ts`, `auth.controller.ts`, `auth.middleware.ts`, Frontend Axios client.
- **Blocked Work:** Badal's Milestone `AUTH-02` (Login) and `AUTH-04` (Refresh Tokens).
- **Approval Owner:** Badal (Identity Lead) & Anindya (Architect).

---

### Decision 02: Email Ownership Verification Gate for Institutional Communities
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Badal COMM-02]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Must users cryptographically verify email ownership via verification links/tokens before their email domain can automatically grant verified membership in university/corporate communities, or is signup email assumed verified?
- **Available Options:**
  - **Option A (Strict Gate):** Users must verify email ownership (`emailVerifiedAt !== null`) before email domain matching automatically verifies community membership. Unverified emails remain in `PENDING` membership status.
  - **Option B (Permissive Gate):** Anyone registering with `@srmist.edu.in` or corporate domains immediately gets `ACTIVE/VERIFIED` community membership.
  - **Option C (Manual Admin Only):** Email domains are not used; all memberships require manual admin approval.
- **Recommendation:** **Option A (Strict Gate)**.
- **Trade-offs:**
  - *Option A Pros:* Prevents spoofing attacks where malicious users register arbitrary university emails to gain unauthorized access to trusted campus carpooling pools.
  - *Option A Cons:* Adds one extra email verification step in user onboarding.
  - *Option B Pros:* Instant onboarding.
  - *Option B Cons:* Zero trust boundary: anyone can type `dean@srmist.edu.in` and access students' private ride itineraries.
- **Affected Modules:** `email-verification.service.ts`, `community.service.ts`.
- **Blocked Work:** Badal's Milestone `COMM-02` (Verified Domain Joining).
- **Approval Owner:** Badal (Auth/Community Lead).

---

## 2. Community Management

### Decision 03: Community Creation Permissions
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Badal COMM-01]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Can any standard registered user (`USER` role) create a new community, or should community creation be restricted to platform administrators?
- **Available Options:**
  - **Option A (Self-Service with Moderation):** Any registered user can create a community; domain bindings are pending until admin approval.
  - **Option B (Admin Only):** Only users with administrative privileges (`ADMIN` in `roles`) can create communities.
  - **Option C (Free-for-All):** Anyone can create communities and immediately bind active domains.
- **Recommendation:** **Option A (Self-Service Creation, Admin Domain Approval)**.
- **Trade-offs:**
  - *Option A Pros:* Enables student organic adoption while protecting official academic domains from squatting.
  - *Option B Pros:* Tightly controlled directory.
  - *Option B Cons:* High operational overhead for student project demonstrations.
  - *Option C Cons:* Critical vulnerability: users could hijack institutional domains.
- **Affected Modules:** `community.validator.ts`, `community.service.ts`, `community.routes.ts`.
- **Blocked Work:** Badal's Milestone `COMM-01` (Community Creation).
- **Approval Owner:** Badal & Team.

---

### Decision 04: Community Creator Initial Membership & Role
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Badal COMM-01]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Should the user who creates a community automatically become an `ADMIN` member in `CommunityMembership` inside the same database transaction?
- **Available Options:**
  - **Option A (Automatic Admin):** Creator is automatically added to `CommunityMembership` with `memberRole: ADMIN` and `status: ACTIVE` in the creation transaction.
  - **Option B (Separate Join Request):** Creator must explicitly join their own community afterwards.
- **Recommendation:** **Option A (Automatic Admin in Transaction)**.
- **Trade-offs:**
  - *Option A Pros:* Intuitive UX; guarantees every community has at least one active moderator to approve incoming member requests; transactional atomicity via `prisma.$transaction`.
  - *Option B Cons:* Creates orphaned communities without active moderators.
- **Affected Modules:** `community.service.ts`.
- **Blocked Work:** Badal's Milestone `COMM-01`.
- **Approval Owner:** Badal.

---

## 3. Driver & Vehicle Management

### Decision 05: Driver Verification Authority & State Machine
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Anindya DRV-01]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** What authority validates a driver's license (`licenseNumber`, `licenseExpiry`) and marks `driverVerified = true`?
- **Available Options:**
  - **Option A (Simulated Admin Approval):** Users submit license and vehicle details; an admin endpoint (`PATCH /api/v1/admin/drivers/:id/verify`) sets `driverVerified = true` and adds `DRIVER` to `roles`.
  - **Option B (Instant Self-Verification for Prototype):** Submitting a non-empty license number immediately marks the user as verified driver.
  - **Option C (Real Third-Party KYC):** Integrate Digilocker or Aadhaar/license OCR API.
- **Recommendation:** **Option A (Simulated Admin Approval Endpoint)**.
- **Trade-offs:**
  - *Option A Pros:* Realistic production-grade workflow demonstrated through admin Swagger/Postman scripts; zero third-party API costs or credential dependencies.
  - *Option B Cons:* Bypasses safety standards required for carpooling capstone evaluation.
  - *Option C Cons:* Complex, requires government/paid API credentials and Indian KYC compliance out of scope for student prototype.
- **Affected Modules:** `driver.service.ts`, `admin.routes.ts`.
- **Blocked Work:** Anindya's Milestone `DRV-01` (Driver Verification).
- **Approval Owner:** Anindya (Fleet Lead).

---

### Decision 06: Vehicle Seat Capacity vs. Ride Passenger Capacity
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Anindya VEH-01, RIDE-01]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Does `Vehicle.seatCapacity` include the driver? How should `Ride.totalSeats` be validated against `Vehicle.seatCapacity`?
- **Available Options:**
  - **Option A (Passenger-Only Capacity):** `Vehicle.seatCapacity` represents bookable passenger seats (e.g. 4 for a 5-seater sedan). `Ride.totalSeats <= Vehicle.seatCapacity`.
  - **Option B (Total Physical Seats):** `Vehicle.seatCapacity` includes driver (e.g. 5). `Ride.totalSeats <= Vehicle.seatCapacity - 1`.
- **Recommendation:** **Option A (Passenger-Only Bookable Seats)**.
- **Trade-offs:**
  - *Option A Pros:* Eliminates off-by-one errors across frontend booking pickers and database checks; clear semantics: "4 seats available for carpooling".
  - *Option B Cons:* Constant confusion in code: whether `- 1` was already subtracted or not.
- **Affected Modules:** `vehicle.validator.ts`, `ride.validator.ts`, `ride.service.ts`.
- **Blocked Work:** Anindya's Milestone `VEH-01` & `RIDE-01`.
- **Approval Owner:** Anindya.

---

## 4. Ride Publishing & Eligibility

### Decision 07: Community Ride Publishing & Discoverability Rules
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Anindya RIDE-01, RIDE-02]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Must a driver be an `ACTIVE` member of a community to publish a ride tied to that `communityId`? Can non-members discover or book that ride?
- **Available Options:**
  - **Option A (Strict Community Silo):** Only verified active members of Community X can publish rides to Community X. Only active members of Community X can search and book those rides.
  - **Option B (Open Discovery with Community Preference):** Anyone can search all rides; community members receive badges or discounts.
  - **Option C (Driver Member, Open Rider):** Driver must belong to the community, but any rider can book.
- **Recommendation:** **Option A (Strict Community Silo)**.
- **Trade-offs:**
  - *Option A Pros:* Delivers the primary capstone value proposition: closed, safe campus/corporate carpooling where riders only travel with university peers or colleagues.
  - *Option A Cons:* Limits ride liquidity across different communities.
  - *Option B & C Cons:* Defeats campus safety and university-specific isolation.
- **Affected Modules:** `ride.service.ts`, `ride.controller.ts`.
- **Blocked Work:** Anindya's Milestone `RIDE-01` & `RIDE-02`.
- **Approval Owner:** Team (All 4 Developers).

---

## 5. Booking & Seat Management

### Decision 08: Seat Reservation Timing (`PENDING` vs. `CONFIRMED` Status)
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Athar BOOK-01]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Does creating a booking in `PENDING` status immediately decrement `Ride.availableSeats`, or are seats reserved only upon payment/driver confirmation?
- **Available Options:**
  - **Option A (Immediate Reservation with Expiry):** `PENDING` booking immediately decrements `availableSeats`. If payment/confirmation is not completed within 10 minutes, booking status becomes `CANCELLED` and seats are restored.
  - **Option B (Reservation on Payment/Confirmation Only):** Seats are not decremented while `PENDING`. They are decremented only upon transition to `CONFIRMED`.
- **Recommendation:** **Option A (Immediate Reservation with 10-Minute Hold)**.
- **Trade-offs:**
  - *Option A Pros:* Prevents race conditions and double-booking where two riders simultaneously attempt to pay for the last remaining seat.
  - *Option B Cons:* Guarantees race conditions: multiple users think they have secured the seat until the payment webhook fails for the slower user.
- **Affected Modules:** `booking.service.ts`.
- **Blocked Work:** Athar's Milestone `BOOK-01`.
- **Approval Owner:** Athar (Booking Lead) & Anindya.

---

### Decision 09: Booking Confirmation Model (Driver Approval vs. Instant Confirmation)
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Athar BOOK-01]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Do rides confirm instantly upon booking/payment (Instant Booking), or must the driver explicitly accept each booking request?
- **Available Options:**
  - **Option A (Instant Booking for Verified Community Members):** Verified community members get instant `CONFIRMED` booking.
  - **Option B (Driver Manual Approval):** Driver receives notification and must `ACCEPT` or `REJECT` within 2 hours.
  - **Option C (Driver Configurable per Ride):** Driver chooses instant or manual approval when publishing.
- **Recommendation:** **Option A (Instant Booking for Prototype Simplicity & Liquidity)**.
- **Trade-offs:**
  - *Option A Pros:* Drastically simplifies user testing and demo execution; since users are already vetted community members, peer trust is pre-established.
  - *Option B Cons:* High risk during viva/demo that booking requests sit in pending state because the driver demo user hasn't approved them.
- **Affected Modules:** `booking.service.ts`.
- **Blocked Work:** Athar's Milestone `BOOK-01`.
- **Approval Owner:** Athar & Badal.

---

### Decision 10: Multi-Seat Bookings & Duplicate Active Booking Restrictions
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Athar BOOK-01]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Can a single rider book multiple seats (e.g. for friends), and can a rider book two different rides with overlapping departure times?
- **Available Options:**
  - **Option A (Multi-Seat Allowed, No Time-Overlap):** A rider can book 1 to `availableSeats` (max 4). However, a rider cannot have another active booking within ±1 hour of the ride's departure time.
  - **Option B (Single Seat Only):** 1 seat per user per ride.
  - **Option C (Unrestricted):** Users can book unlimited seats and overlapping rides.
- **Recommendation:** **Option A (Multi-Seat Allowed, Overlapping Conflict Check)**.
- **Trade-offs:**
  - *Option A Pros:* Realistic student use case (booking for roommates/friends traveling together); prevents hoarding of overlapping rides.
  - *Option B Cons:* Frustrating UX if two students want to travel in the same carpool.
  - *Option C Cons:* Enables abuse and unrealistic ride hoarding.
- **Affected Modules:** `booking.validator.ts`, `booking.service.ts`.
- **Blocked Work:** Athar's Milestone `BOOK-01`.
- **Approval Owner:** Athar.

---

### Decision 11: Cancellation Policy, Cutoff Times & Seat Restoration
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Athar CANC-01]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** How are cancellations handled? Are seats always restored to `availableSeats`? What refund/penalty logic applies?
- **Available Options:**
  - **Option A (Time-Windowed Policy):**
    - Rider cancels > 2 hours before departure: 100% refund, seats restored to ride.
    - Rider cancels < 2 hours before departure: 50% refund, 50% cancellation fee, seats restored.
    - Driver cancels anytime: 100% refund to all riders, booking marked cancelled, ride cancelled.
  - **Option B (Full Refund Always):** Zero penalties; 100% refund anytime.
  - **Option C (No Refunds):** Final sale on all bookings.
- **Recommendation:** **Option A (Time-Windowed Policy)**.
- **Trade-offs:**
  - *Option A Pros:* Reflects real-world transportation dynamics; protects drivers from last-minute cancellations while allowing fair early changes.
  - *Option B Cons:* Encourages casual cancellations, leaving carpools stranded.
- **Affected Modules:** `cancellation.service.ts`, `transaction.service.ts`.
- **Blocked Work:** Athar's Milestone `CANC-01`.
- **Approval Owner:** Athar & Anindya.

---

## 6. Financial System

### Decision 12: Financial Accounting Model (Stored-Value Wallet vs. Direct Gateway)
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Athar & Anshika]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Should Rydora use the `User.walletBalance` stored-value wallet model, direct online gateway payments, or a simulated ledger?
- **Available Options:**
  - **Option A (Simulated In-App Wallet):** Users start with a simulated promotional balance (e.g. ₹1000); bookings debit wallet balance; driver payouts credit driver wallet balance. All movements logged in `Transaction`.
  - **Option B (Live Payment Gateway Integration):** Real payments via Razorpay / Stripe for every booking.
  - **Option C (Cash on Delivery Only):** No digital transactions stored.
- **Recommendation:** **Option A (Simulated In-App Wallet with Double-Entry Transaction Ledger)**.
- **Trade-offs:**
  - *Option A Pros:* 100% reliable for project evaluation and viva demos; requires zero real bank accounts, KYC, or merchant credentials; fully utilizes the `User.walletBalance`, `Transaction`, and `DriverEarning` models.
  - *Option B Cons:* High failure rate during demos (OTP latency, test cards, webhook tunnels via ngrok); payment gateway terms often prohibit student peer-to-peer carpool aggregations without commercial licenses.
- **Affected Modules:** `transaction.service.ts`, `driver-earning.service.ts`.
- **Blocked Work:** Athar & Anshika's financial milestones.
- **Approval Owner:** Athar, Anshika, Anindya.

---

### Decision 13: Payment Provider Adapter Strategy
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Athar]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** Which payment provider SDK should be imported in Phase 1 vs Phase 2?
- **Available Options:**
  - **Option A:** Mock/Simulated Payment Service in Phase 1; swappable interface designed for Razorpay in Phase 2.
  - **Option B:** Direct Razorpay SDK integration from Day 1.
  - **Option C:** Stripe Checkout only.
- **Recommendation:** **Option A (Mock Payment Adapter with Razorpay interface signature)**.
- **Trade-offs:**
  - *Option A Pros:* Isolates backend testing from network/gateway outages; allows offline unit and integration tests.
  - *Option B Cons:* Requires all 4 developers to share and configure active merchant test API keys.
- **Affected Modules:** `transaction.service.ts`.
- **Blocked Work:** Athar's Milestone `TRANS-01`.
- **Approval Owner:** Athar & Anindya.

---

### Decision 14: Platform Fee Structure & Driver Earning Calculation
- **Status:** `[RECOMMENDATION]` `[REQUIRES TEAM APPROVAL]` `[BLOCKS IMPLEMENTATION: Athar & Anshika]` `[DOES NOT BLOCK CURRENT FOUNDATION]`
- **Exact Question:** How should the platform fee be calculated and recorded in `DriverEarning` (`grossAmount`, `platformFee`, `netAmount`)?
- **Available Options:**
  - **Option A (Flat Percentage):** Fixed 10% platform fee deducted from ride total: `platformFee = grossAmount * 0.10`; `netAmount = grossAmount - platformFee`.
  - **Option B (Flat Fixed Fee):** Fixed ₹20 per booking fee.
  - **Option C (Zero Fee / Cost-Sharing Non-Profit):** 100% of the fare goes to the driver (`platformFee = 0`).
- **Recommendation:** **Option A (Flat 10% Platform Fee)**.
- **Trade-offs:**
  - *Option A Pros:* Realistic business model demonstrating platform monetization; properly populates all fields of `DriverEarning` model.
  - *Option B Cons:* Regressive on short trips (e.g. ₹50 campus hop with ₹20 fee).
  - *Option C Cons:* Leaves `DriverEarning.platformFee` permanently 0, weakening the financial ledger demonstration.
- **Affected Modules:** `booking.service.ts`, `driver-earning.service.ts`.
- **Blocked Work:** Anshika's Milestone `EARN-01`.
- **Approval Owner:** Anshika & Athar.

---

## 7. Decision Responsibility Matrix Summary

| Decision | Topic | Recommendation | Owner / Approval | Implementation Blocker? |
|:---:|:---|:---|:---:|:---:|
| **D01** | Auth Mechanism | Bearer JWT (15m access / DB refresh) | Badal & Anindya | Blocks Auth Login |
| **D02** | Email Verification Gate | Strict gate before domain match | Badal | Blocks Community Join |
| **D03** | Community Creation | Self-service creation, admin domain approval | Badal & Team | Blocks Community Create |
| **D04** | Creator Membership | Auto-admin in creation transaction | Badal | Blocks Community Create |
| **D05** | Driver Verification | Simulated admin approval endpoint | Anindya | Blocks Driver Verify |
| **D06** | Seat Capacity | Passenger-only bookable seats | Anindya | Blocks Ride Publish |
| **D07** | Community Siloing | Strict silo: member driver & riders | All 4 Devs | Blocks Ride Search |
| **D08** | Seat Reservation | Immediate reservation with 10m hold | Athar & Anindya | Blocks Booking Create |
| **D09** | Confirmation Model | Instant booking for verified members | Athar & Badal | Blocks Booking Create |
| **D10** | Multi-Seat Bookings | Allowed (max 4) with overlap check | Athar | Blocks Booking Validation |
| **D11** | Cancellation Policy | Time-windowed refund/fee policy | Athar & Anindya | Blocks Cancellation |
| **D12** | Accounting Model | Simulated wallet with double-entry | Athar, Anshika, Anindya | Blocks Payments/Payouts |
| **D13** | Payment Provider | Mock adapter with Razorpay interface | Athar & Anindya | Blocks Gateway SDK |
| **D14** | Platform Fee | 10% percentage platform fee | Anshika & Athar | Blocks Driver Earnings |

---

## 8. Unresolved Schema & Architectural Consistency Audit (Milestone 1 Review)

The following unresolved issues and cross-cutting inconsistencies were identified during the technical review. In accordance with strict Milestone 1 boundaries, **no unauthorized schema modifications or migrations have been made**. These issues are documented here for team consensus prior to Milestone 2 schema migrations:

### Issue 1: `emailVerifiedAt` Absent from User Model (Decision 02)
- **Problem:** Decision 02 requires verifying email ownership (`emailVerifiedAt !== null`) before a user's institutional domain (e.g., `@srmist.edu.in`) grants verified community membership.
- **Current Schema:** The `User` model currently possesses `driverVerified Boolean`, but contains no `emailVerifiedAt DateTime?` or email verification timestamp.
- **Impact:** Badal's authentication module cannot record the exact timestamp when an email was verified, nor enforce token expiry without this column.
- **Proposed Resolution for Milestone 2:** File a schema change request with Anindya to add `emailVerifiedAt DateTime? @map("email_verified_at") @db.Timestamptz(6)` to the `User` model.

### Issue 2: `MembershipStatus` Missing `PENDING` Enum Value (Decision 02)
- **Problem:** Decision 02 specifies that users joining an institutional community with an unverified email must remain in a `PENDING` membership status.
- **Current Schema:** `enum MembershipStatus` currently contains only `ACTIVE` and `INACTIVE`.
- **Impact:** `CommunityMembership.status` cannot store `PENDING` at the database level.
- **Proposed Resolution for Milestone 2:** Update `MembershipStatus` enum to `enum MembershipStatus { PENDING, ACTIVE, INACTIVE, REJECTED }` via a controlled Prisma migration.

### Issue 3: Community Domain Approval Representation (Decision 03)
- **Problem:** Decision 03 requires that self-service community creation leaves institutional domain claiming in a pending approval state until platform moderation.
- **Current Schema:** `Community` has `status CommunityStatus @default(ACTIVE)` and `domain String`. There is no separate `domainStatus` or `isDomainVerified` column.
- **Impact:** Setting `Community.status = INACTIVE` disables the entire community rather than specifically gating domain-based auto-join.
- **Proposed Resolution for Milestone 2:** Clarify whether `CommunityStatus` applies to the entire community entity, or introduce `isDomainApproved Boolean @default(false)` in the `Community` model.

### Issue 4: Platform-Admin Authorization vs. `UserRole` Enum (Decision 05)
- **Problem:** Decision 03 and Decision 05 reference platform-level administrator actions (moderating domains and verifying driver licenses via `ADMIN in roles`).
- **Current Schema:** `enum UserRole` contains only `USER` and `DRIVER`. Global `ADMIN` is absent from `UserRole` (only `CommunityMemberRole` has `ADMIN`).
- **Impact:** The application cannot assign or check a global `ADMIN` role in `User.roles`.
- **Proposed Resolution for Milestone 2:** Add `ADMIN` to `UserRole` (`enum UserRole { USER, DRIVER, ADMIN }`), or establish an environment-configured superadmin ID list in `env.ts`.

### Issue 5: Booking & Payment State-Transition Flow Consistency (Decisions 08 & 09)
- **Problem:** Decision 08 specifies creating bookings in `PENDING` with a 10-minute hold, while Decision 09 proposes "Instant Booking" resulting in `CONFIRMED`.
- **Current Flow Ambiguity:** It was unclear whether a booking starts as `PENDING` until wallet deduction/payment succeeds, or immediately becomes `CONFIRMED`.
- **Resolution & Unified State Machine:**
  1. Rider initiates booking: `Booking.status = PENDING`, `availableSeats` is decremented atomically.
  2. Payment / wallet deduction succeeds: `Transaction.status = COMPLETED`, `Booking.status` transitions from `PENDING` to `CONFIRMED`.
  3. Payment fails or 10-minute window expires: `Booking.status = CANCELLED`, `availableSeats` is restored atomically.
  4. Ride is completed: `Booking.status = COMPLETED`, triggering driver earning calculation.

### Issue 6: 10-Minute Reservation Expiry Mechanism in Booking Model (Decision 08)
- **Problem:** Decision 08 mandates that `PENDING` bookings release reserved seats after 10 minutes if unpaid.
- **Current Schema:** `Booking` has `bookedAt DateTime` and `updatedAt DateTime`, but no `expiresAt DateTime?`.
- **Impact:** PostgreSQL cannot natively auto-cancel rows without a timestamp comparison or scheduled worker.
- **Proposed Resolution:**
  - Application logic calculates expiration dynamically as `bookedAt + 10 minutes`.
  - Athar will implement a periodic sweep service or on-demand check that cancels expired `PENDING` bookings and restores seats.
  - Optional Milestone 2 addition: Add `expiresAt DateTime? @map("expires_at") @db.Timestamptz(6)` to `Booking`.

### Issue 7: Double-Entry Accounting vs. Current Single-Row Transaction Model (Decision 12)
- **Problem:** Decision 12 refers to a "double-entry transaction ledger", but the `Transaction` model stores a single row with nullable `senderId` and `receiverId`.
- **Clarification:** True accounting double-entry requires balanced debit and credit journal entries across accounts. Rydora's `Transaction` model is a **single-row dual-party transfer log**.
- **Resolution:** Acknowledge that Rydora implements an audited transfer log where each wallet movement records the `senderId` (debit party) and `receiverId` (credit party) on one row. Real balances are updated atomically within `prisma.$transaction`.

### Issue 8: Precise Definition of the ±1-Hour Booking Conflict Rule (Decision 10)
- **Problem:** Decision 10 stated that a rider cannot have overlapping active bookings within ±1 hour of a ride's departure time, but left the mathematical boundary and status filter ambiguous.
- **Formal Rule Definition:**
  - **Filter:** Applies only to existing bookings where `riderId = currentUser.id` and `status IN [PENDING, CONFIRMED]`.
  - **Rule:** For a proposed booking on Ride $R_{\text{new}}$ with departure time $T_{\text{new}}$, reject if there exists any active booking on Ride $R_{\text{existing}}$ with departure time $T_{\text{existing}}$ satisfying:
    $$\left| T_{\text{new}} - T_{\text{existing}} \right| \le 60\text{ minutes}$$
  - **Boundary:** Inclusive ($\le 60\text{ minutes}$). Two rides departing at 09:00 and 10:00 conflict. A ride departing at 10:01 does not conflict.

### Issue 9: Cancellation Cutoff Boundary at Exactly Two Hours (Decision 11)
- **Problem:** Decision 11 stated `> 2 hours` for full refund and `< 2 hours` for 50% refund, leaving the boundary at exactly $t = 2\text{ hours}$ undefined.
- **Formal Boundary Definition:**
  - Let $\Delta t = \text{Ride.departureTime} - \text{currentTimestamp}$.
  - **If $\Delta t \ge 2\text{ hours}$ (i.e. $\Delta t \ge 120\text{ minutes}$):** 100% refund of `totalAmount` to rider wallet, 0% penalty, and seats are restored to `availableSeats`.
  - **If $\Delta t < 2\text{ hours}$ (i.e. $\Delta t < 120\text{ minutes}$):** 50% refund of `totalAmount` to rider wallet, 50% cancellation fee retained, and seats are restored to `availableSeats`.
  - **If driver cancels (anytime prior to departure):** 100% refund to all riders, booking marked `CANCELLED`, ride marked `CANCELLED`.

