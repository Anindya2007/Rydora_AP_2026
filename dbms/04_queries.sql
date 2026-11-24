-- =====================================================================
-- Rydora Ride-Sharing & Carpooling Platform: Relational SQL Query Catalog
-- AP Project Checkpoint 2/3 Deliverable: dbms/04_queries.sql
-- Team: T0145 · Section: A
-- Target Engine: PostgreSQL 15+
-- Description: Complete catalog of production application queries covering
-- Identity, Communities, Fleet, Rides, Bookings, Finance/Ledger, Safety/SOS,
-- Ratings, Notifications, and Sustainability.
-- Every query is explicitly categorized and labeled as -- READ or -- WRITE,
-- maximizing relational JOINs across normalized entities.
-- =====================================================================

-- =====================================================================
-- MODULE 1: IDENTITY, AUTHENTICATION & SESSIONS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 1.1: Register New User Account
-- Description: Creates a new user record with default ACTIVE account status.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "users" (
    "userId",
    "name",
    "email",
    "phone",
    "passwordHash",
    "profileImage",
    "accountStatus",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- userId (UUID)
    $2, -- name (VARCHAR)
    LOWER(TRIM($3)), -- email (VARCHAR normalized)
    $4, -- phone (VARCHAR)
    $5, -- passwordHash (TEXT)
    $6, -- profileImage (TEXT)
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 1.2: Assign User Role
-- Description: Maps newly registered user to default RIDER role.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "user_roles" (
    "roleId",
    "userId",
    "role",
    "createdAt"
) VALUES (
    $1, -- roleId (UUID)
    $2, -- userId (UUID)
    'RIDER',
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 1.3: Authenticate User & Fetch Assigned Roles
-- Description: Retrieves user security credentials and joined role authorizations by email.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    u."userId",
    u."name",
    u."email",
    u."phone",
    u."passwordHash",
    u."accountStatus",
    COALESCE(ARRAY_AGG(ur."role") FILTER (WHERE ur."role" IS NOT NULL), '{}') AS "roles"
FROM "users" u
LEFT JOIN "user_roles" ur ON u."userId" = ur."userId"
WHERE LOWER(u."email") = LOWER(TRIM($1))
  AND u."deletedAt" IS NULL
GROUP BY u."userId", u."name", u."email", u."phone", u."passwordHash", u."accountStatus";

-- ---------------------------------------------------------------------
-- Query 1.4: Persist Authenticated User Session
-- Description: Stores active session token and device metadata for revocation tracking.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "user_sessions" (
    "sessionId",
    "userId",
    "refreshTokenHash",
    "deviceInfo",
    "ipAddress",
    "expiresAt",
    "createdAt"
) VALUES (
    $1, -- sessionId (UUID)
    $2, -- userId (UUID)
    $3, -- refreshTokenHash (TEXT)
    $4, -- deviceInfo (TEXT)
    $5, -- ipAddress (VARCHAR)
    CURRENT_TIMESTAMP + INTERVAL '24 hours',
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 1.5: Resolve Complete User Profile with Preferences & Driver Eligibility
-- Description: Multi-table JOIN loading user profile, preferences, active roles, and driver verification.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    u."userId",
    u."name",
    u."email",
    u."phone",
    u."profileImage",
    u."accountStatus",
    u."createdAt",
    up."language",
    up."theme",
    dp."licenseNumber",
    dp."eligibilityStatus" AS "driverStatus",
    COALESCE(ARRAY_AGG(DISTINCT ur."role"), '{}') AS "roles",
    COUNT(DISTINCT r."ratingId") AS "totalRatingsReceived",
    COALESCE(ROUND(AVG(r."score"), 2), 5.00) AS "averageRating"
FROM "users" u
LEFT JOIN "user_preferences" up ON u."userId" = up."userId"
LEFT JOIN "driver_profiles" dp ON u."userId" = dp."userId"
LEFT JOIN "user_roles" ur ON u."userId" = ur."userId"
LEFT JOIN "ratings" r ON u."userId" = r."rateeId"
WHERE u."userId" = $1
  AND u."deletedAt" IS NULL
GROUP BY 
    u."userId", u."name", u."email", u."phone", u."profileImage", 
    u."accountStatus", u."createdAt", up."language", up."theme", 
    dp."licenseNumber", dp."eligibilityStatus";

-- ---------------------------------------------------------------------
-- Query 1.6: Revoke User Session (Logout)
-- Description: Marks an active session as revoked.
-- ---------------------------------------------------------------------
-- WRITE
UPDATE "user_sessions"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "sessionId" = $1
  AND "revokedAt" IS NULL;


-- =====================================================================
-- MODULE 2: COMMUNITIES, DOMAINS & VERIFIED MEMBERSHIPS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 2.1: Discover Community by Organization Email Domain
-- Description: Identifies matching community and domain policies from passenger/driver email.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    c."communityId",
    c."name" AS "communityName",
    c."slug",
    c."type" AS "communityType",
    c."status" AS "communityStatus",
    cd."domain",
    cd."isPrimary"
FROM "communities" c
INNER JOIN "community_domains" cd ON c."communityId" = cd."communityId"
WHERE LOWER(cd."domain") = LOWER($1)
  AND cd."isActive" = true
  AND c."status" = 'ACTIVE';

-- ---------------------------------------------------------------------
-- Query 2.2: Register New Domain Community
-- Description: Creates a new trusted carpool community for an institution or campus.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "communities" (
    "communityId",
    "name",
    "slug",
    "type",
    "status",
    "description",
    "createdById",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- communityId
    $2, -- name
    LOWER(TRIM($3)), -- slug
    $4, -- type ('UNIVERSITY', 'OFFICE', etc.)
    'ACTIVE',
    $5, -- description
    $6, -- createdById
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 2.3: Link Official Domain to Community
-- Description: Maps an institutional domain (e.g., rishihood.edu.in) to community.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "community_domains" (
    "domainId",
    "communityId",
    "domain",
    "isPrimary",
    "isActive",
    "createdAt"
) VALUES (
    $1, -- domainId
    $2, -- communityId
    LOWER(TRIM($3)), -- domain
    $4, -- isPrimary (BOOLEAN)
    true,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 2.4: Upsert Active Community Membership
-- Description: Grants user verified active membership within a community circle.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "community_memberships" (
    "membershipId",
    "communityId",
    "userId",
    "role",
    "status",
    "joinedAt"
) VALUES (
    $1, -- membershipId
    $2, -- communityId
    $3, -- userId
    $4, -- role ('MEMBER' or 'ADMIN')
    'ACTIVE',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("communityId", "userId")
DO UPDATE SET 
    "status" = 'ACTIVE',
    "role" = EXCLUDED."role";

-- ---------------------------------------------------------------------
-- Query 2.5: List User's Communities with Member Statistics
-- Description: JOINs communities, memberships, and total verified active member counts.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    c."communityId",
    c."name" AS "communityName",
    c."slug",
    c."type",
    cm."role" AS "userRole",
    cm."joinedAt",
    COUNT(m2."userId") AS "totalActiveMembers"
FROM "community_memberships" cm
INNER JOIN "communities" c ON cm."communityId" = c."communityId"
LEFT JOIN "community_memberships" m2 
    ON c."communityId" = m2."communityId" AND m2."status" = 'ACTIVE'
WHERE cm."userId" = $1
  AND cm."status" = 'ACTIVE'
  AND c."status" = 'ACTIVE'
GROUP BY c."communityId", c."name", c."slug", c."type", cm."role", cm."joinedAt"
ORDER BY c."name" ASC;


-- =====================================================================
-- MODULE 3: VEHICLES & DRIVER ONBOARDING
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 3.1: Register Driver Vehicle
-- Description: Adds a new vehicle linked to an authenticated driver.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "vehicles" (
    "vehicleId",
    "driverId",
    "make",
    "model",
    "year",
    "color",
    "licensePlate",
    "type",
    "seatCapacity",
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- vehicleId
    $2, -- driverId
    $3, -- make
    $4, -- model
    $5, -- year
    $6, -- color
    UPPER(TRIM($7)), -- licensePlate
    $8, -- type ('SEDAN', 'SUV', etc.)
    $9, -- seatCapacity
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 3.2: Create or Verify Driver Profile
-- Description: Establishes driver licensing and verification standing.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "driver_profiles" (
    "driverProfileId",
    "userId",
    "licenseNumber",
    "licenseExpiry",
    "eligibilityStatus",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- driverProfileId
    $2, -- userId
    UPPER(TRIM($3)), -- licenseNumber
    $4, -- licenseExpiry (DATE)
    'ELIGIBLE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("userId")
DO UPDATE SET 
    "licenseNumber" = EXCLUDED."licenseNumber",
    "licenseExpiry" = EXCLUDED."licenseExpiry",
    "eligibilityStatus" = 'ELIGIBLE',
    "updatedAt" = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------
-- Query 3.3: Fetch Driver Vehicles with Verification Standing
-- Description: JOINs driver vehicles with driver verification status and trip metrics.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    v."vehicleId",
    v."make",
    v."model",
    v."year",
    v."color",
    v."licensePlate",
    v."type" AS "vehicleType",
    v."seatCapacity",
    v."isActive",
    dp."eligibilityStatus",
    dp."totalTrips",
    dp."ratingAverage"
FROM "vehicles" v
INNER JOIN "users" u ON v."driverId" = u."userId"
LEFT JOIN "driver_profiles" dp ON u."userId" = dp."userId"
WHERE v."driverId" = $1
  AND v."isActive" = true
ORDER BY v."createdAt" DESC;


-- =====================================================================
-- MODULE 4: RIDE PUBLISHING, CORRIDOR DISCOVERY & STOPS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 4.1: Publish Scheduled Carpool Ride
-- Description: Driver creates an empty seat carpool offer along their commute route.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "rides" (
    "rideId",
    "driverId",
    "vehicleId",
    "originAddress",
    "originLat",
    "originLng",
    "destinationAddress",
    "destinationLat",
    "destinationLng",
    "departureTime",
    "totalSeats",
    "availableSeats",
    "farePerSeat",
    "rideStatus",
    "plannedDistanceKm",
    "plannedDurationMinutes",
    "notes",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- rideId
    $2, -- driverId
    $3, -- vehicleId
    $4, -- originAddress
    $5, -- originLat
    $6, -- originLng
    $7, -- destinationAddress
    $8, -- destinationLat
    $9, -- destinationLng
    $10, -- departureTime
    $11, -- totalSeats
    $11, -- availableSeats (initially equal to totalSeats)
    $12, -- farePerSeat
    'SCHEDULED',
    $13, -- plannedDistanceKm
    $14, -- plannedDurationMinutes
    $15, -- notes
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 4.2: Associate Ride with Community Carpool Corridor
-- Description: Binds a published ride to one or more communities for verified closed carpooling.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "ride_communities" (
    "rideCommunityId",
    "rideId",
    "communityId"
) VALUES (
    $1, -- rideCommunityId
    $2, -- rideId
    $3  -- communityId
);

-- ---------------------------------------------------------------------
-- Query 4.3: Add Waypoint Stop Along Route
-- Description: Persists intermediate pickup or dropoff waypoints along a commuter corridor.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "ride_stops" (
    "stopId",
    "rideId",
    "stopOrder",
    "locationAddress",
    "latitude",
    "longitude",
    "stopType",
    "plannedTime"
) VALUES (
    $1, -- stopId
    $2, -- rideId
    $3, -- stopOrder
    $4, -- locationAddress
    $5, -- latitude
    $6, -- longitude
    $7, -- stopType ('PICKUP', 'DROPOFF', 'WAYPOINT')
    $8  -- plannedTime
);

-- ---------------------------------------------------------------------
-- Query 4.4: Search Active Rides with Driver, Vehicle & Community JOINs
-- Description: Core discovery query searching rides matching source/destination corridors with full relational hydration.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    r."rideId",
    r."originAddress",
    r."originLat",
    r."originLng",
    r."destinationAddress",
    r."destinationLat",
    r."destinationLng",
    r."departureTime",
    r."availableSeats",
    r."totalSeats",
    r."farePerSeat",
    r."rideStatus",
    u."userId" AS "driverId",
    u."name" AS "driverName",
    u."profileImage" AS "driverImage",
    dp."ratingAverage" AS "driverRating",
    dp."totalTrips" AS "driverTotalTrips",
    v."make" AS "vehicleMake",
    v."model" AS "vehicleModel",
    v."color" AS "vehicleColor",
    v."licensePlate",
    c."communityId",
    c."name" AS "communityName"
FROM "rides" r
INNER JOIN "users" u ON r."driverId" = u."userId"
INNER JOIN "vehicles" v ON r."vehicleId" = v."vehicleId"
LEFT JOIN "driver_profiles" dp ON u."userId" = dp."userId"
LEFT JOIN "ride_communities" rc ON r."rideId" = rc."rideId"
LEFT JOIN "communities" c ON rc."communityId" = c."communityId"
WHERE r."rideStatus" = 'SCHEDULED'
  AND r."departureTime" > CURRENT_TIMESTAMP
  AND r."availableSeats" >= $1 -- requested seats
  AND (
      $2::UUID IS NULL -- if communityId filter is null (Open category)
      OR rc."communityId" = $2
  )
ORDER BY r."departureTime" ASC
LIMIT 50;

-- ---------------------------------------------------------------------
-- Query 4.5: Retrieve Full Ride Details with En-Route Stops
-- Description: Detailed ride view joining route stops in deterministic order.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    r."rideId",
    r."originAddress",
    r."destinationAddress",
    r."departureTime",
    r."availableSeats",
    r."farePerSeat",
    r."rideStatus",
    u."name" AS "driverName",
    u."phone" AS "driverPhone",
    v."make",
    v."model",
    v."licensePlate",
    rs."stopOrder",
    rs."locationAddress" AS "stopAddress",
    rs."stopType",
    rs."plannedTime"
FROM "rides" r
INNER JOIN "users" u ON r."driverId" = u."userId"
INNER JOIN "vehicles" v ON r."vehicleId" = v."vehicleId"
LEFT JOIN "ride_stops" rs ON r."rideId" = rs."rideId"
WHERE r."rideId" = $1
ORDER BY rs."stopOrder" ASC;

-- ---------------------------------------------------------------------
-- Query 4.6: Transition Ride Lifecycle State
-- Description: Advances ride status from SCHEDULED -> ACTIVE -> COMPLETED.
-- ---------------------------------------------------------------------
-- WRITE
UPDATE "rides"
SET "rideStatus" = $2, -- ('ACTIVE', 'COMPLETED', etc.)
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "rideId" = $1
  AND "rideStatus" != 'CANCELLED';


-- =====================================================================
-- MODULE 5: BOOKINGS, SEAT ALLOCATION & PASSENGER MANIFEST
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 5.1: Atomic Conditional Seat Allocation (Concurrency Guard)
-- Description: Locks ride row in PostgreSQL and decrements seats if capacity remains.
-- ---------------------------------------------------------------------
-- WRITE
UPDATE "rides"
SET "availableSeats" = "availableSeats" - $2,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "rideId" = $1
  AND "rideStatus" = 'SCHEDULED'
  AND "availableSeats" >= $2;

-- ---------------------------------------------------------------------
-- Query 5.2: Create Passenger Booking Reservation
-- Description: Creates booking record in PENDING status for allocated seats.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "bookings" (
    "bookingId",
    "rideId",
    "riderId",
    "pickupAddress",
    "pickupLat",
    "pickupLng",
    "dropoffAddress",
    "dropoffLat",
    "dropoffLng",
    "seatCount",
    "totalFare",
    "bookingStatus",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- bookingId
    $2, -- rideId
    $3, -- riderId
    $4, -- pickupAddress
    $5, -- pickupLat
    $6, -- pickupLng
    $7, -- dropoffAddress
    $8, -- dropoffLat
    $9, -- dropoffLng
    $10, -- seatCount
    $11, -- totalFare
    'PENDING',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 5.3: Driver Passenger Manifest for Ride
-- Description: Multi-table JOIN loading all passengers booked on a ride for driver check-in.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    b."bookingId",
    b."seatCount",
    b."totalFare",
    b."bookingStatus",
    b."pickupAddress",
    b."dropoffAddress",
    b."createdAt" AS "bookedAt",
    u."userId" AS "passengerId",
    u."name" AS "passengerName",
    u."phone" AS "passengerPhone",
    u."profileImage" AS "passengerImage",
    p."paymentStatus"
FROM "bookings" b
INNER JOIN "users" u ON b."riderId" = u."userId"
LEFT JOIN "payments" p ON b."bookingId" = p."bookingId"
WHERE b."rideId" = $1
ORDER BY b."createdAt" ASC;

-- ---------------------------------------------------------------------
-- Query 5.4: Passenger Booking History (My Rides)
-- Description: Retrieves passenger travel history joining ride, driver, vehicle, and payment details.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    b."bookingId",
    b."seatCount",
    b."totalFare",
    b."bookingStatus",
    b."createdAt" AS "bookedAt",
    r."rideId",
    r."originAddress",
    r."destinationAddress",
    r."departureTime",
    r."rideStatus",
    d."name" AS "driverName",
    d."phone" AS "driverPhone",
    v."make" AS "vehicleMake",
    v."model" AS "vehicleModel",
    v."licensePlate",
    p."paymentStatus",
    rt."score" AS "ratingGiven"
FROM "bookings" b
INNER JOIN "rides" r ON b."rideId" = r."rideId"
INNER JOIN "users" d ON r."driverId" = d."userId"
INNER JOIN "vehicles" v ON r."vehicleId" = v."vehicleId"
LEFT JOIN "payments" p ON b."bookingId" = p."bookingId"
LEFT JOIN "ratings" rt ON b."bookingId" = rt."bookingId" AND rt."raterId" = b."riderId"
WHERE b."riderId" = $1
ORDER BY b."createdAt" DESC
LIMIT 50;

-- ---------------------------------------------------------------------
-- Query 5.5: Driver Approves Passenger Booking
-- Description: Transitions pending booking to CONFIRMED.
-- ---------------------------------------------------------------------
-- WRITE
UPDATE "bookings"
SET "bookingStatus" = 'CONFIRMED',
    "confirmedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "bookingId" = $1
  AND "bookingStatus" = 'PENDING';

-- ---------------------------------------------------------------------
-- Query 5.6: Booking Cancellation & Atomic Seat Restoration
-- Description: Steps to cancel booking and atomically increment ride available seats.
-- ---------------------------------------------------------------------
-- WRITE (Step A: Cancel Booking)
UPDATE "bookings"
SET "bookingStatus" = 'CANCELLED',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "bookingId" = $1
  AND "bookingStatus" IN ('PENDING', 'CONFIRMED');

-- WRITE (Step B: Restore Seats Capped at Total Capacity)
UPDATE "rides"
SET "availableSeats" = LEAST("totalSeats", "availableSeats" + $2),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "rideId" = $1;

-- ---------------------------------------------------------------------
-- Query 5.7: Mark Booking as Completed
-- Description: Completes booking upon trip arrival.
-- ---------------------------------------------------------------------
-- WRITE
UPDATE "bookings"
SET "bookingStatus" = 'COMPLETED',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "bookingId" = $1
  AND "bookingStatus" = 'CONFIRMED';


-- =====================================================================
-- MODULE 6: FINANCIAL TRANSACTIONS, LEDGER & SETTLEMENTS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 6.1: Record Passenger Payment Transaction
-- Description: Inserts completed payment record for booking fare.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "payments" (
    "paymentId",
    "bookingId",
    "payerId",
    "amount",
    "currency",
    "paymentMethod",
    "paymentStatus",
    "gatewayTransactionId",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- paymentId
    $2, -- bookingId
    $3, -- payerId
    $4, -- amount
    'INR',
    $5, -- paymentMethod ('CARD', 'UPI', 'WALLET', 'SIMULATED')
    'COMPLETED',
    $6, -- gatewayTransactionId
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 6.2: Record Driver Earning Record
-- Description: Allocates ride earnings to driver financial account.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "driver_earnings" (
    "earningId",
    "driverId",
    "rideId",
    "bookingId",
    "grossEarning",
    "platformFee",
    "deductions",
    "netEarning",
    "status",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- earningId
    $2, -- driverId
    $3, -- rideId
    $4, -- bookingId
    $5, -- grossEarning
    0.00, -- zero platform fee
    0.00,
    $5, -- netEarning equals grossEarning
    'AVAILABLE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 6.3: Double-Entry Ledger Transaction Record
-- Description: Inserts immutable financial ledger audit event for settlement.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "ledger_transactions" (
    "transactionId",
    "referenceId",
    "type",
    "amount",
    "currency",
    "description",
    "createdAt"
) VALUES (
    $1, -- transactionId
    $2, -- referenceId (bookingId/rideId)
    'RIDE_PAYMENT',
    $3, -- amount
    'INR',
    $4, -- description
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 6.4: Execute Booking Refund Record
-- Description: Registers refund on cancelled booking.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "refunds" (
    "refundId",
    "paymentId",
    "amount",
    "reason",
    "refundStatus",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- refundId
    $2, -- paymentId
    $3, -- amount
    $4, -- reason
    'SUCCEEDED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 6.5: Driver Financial Statement & Earnings Breakdown
-- Description: JOINs driver earnings, rides, passenger details, and settlement statuses.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    de."earningId",
    de."grossEarning",
    de."netEarning",
    de."status" AS "earningStatus",
    de."createdAt" AS "earnedAt",
    r."rideId",
    r."originAddress",
    r."destinationAddress",
    r."departureTime",
    u."name" AS "passengerName",
    b."seatCount"
FROM "driver_earnings" de
INNER JOIN "rides" r ON de."rideId" = r."rideId"
LEFT JOIN "bookings" b ON de."bookingId" = b."bookingId"
LEFT JOIN "users" u ON b."riderId" = u."userId"
WHERE de."driverId" = $1
ORDER BY de."createdAt" DESC;


-- =====================================================================
-- MODULE 7: SAFETY, REAL-TIME SOS & GUARDIAN ESCALATION
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 7.1: Add Trusted Safety Guardian (Emergency Contact)
-- Description: Registers emergency contact for immediate escalation notifications.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "trusted_contacts" (
    "contactId",
    "userId",
    "name",
    "phone",
    "email",
    "relationship",
    "isEmergencyContact",
    "createdAt",
    "updatedAt"
) VALUES (
    $1, -- contactId
    $2, -- userId
    $3, -- name
    $4, -- phone
    $5, -- email
    $6, -- relationship
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 7.2: Trigger Emergency SOS Alert
-- Description: Activates urgent SOS alert with real-time GPS telemetry.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "sos_alerts" (
    "alertId",
    "userId",
    "rideId",
    "status",
    "latitude",
    "longitude",
    "address",
    "triggeredAt"
) VALUES (
    $1, -- alertId
    $2, -- userId
    $3, -- rideId (optional)
    'TRIGGERED',
    $4, -- latitude
    $5, -- longitude
    $6, -- address
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 7.3: Fetch Active Guardian Emergency Alerts
-- Description: Multi-table JOIN resolving active SOS alerts where caller's phone matches victim's registered guardian.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    sa."alertId",
    sa."status",
    sa."latitude",
    sa."longitude",
    sa."address",
    sa."triggeredAt",
    victim."userId" AS "victimId",
    victim."name" AS "victimName",
    victim."phone" AS "victimPhone",
    tc."relationship",
    r."originAddress",
    r."destinationAddress",
    r."rideStatus"
FROM "sos_alerts" sa
INNER JOIN "users" victim ON sa."userId" = victim."userId"
INNER JOIN "trusted_contacts" tc ON victim."userId" = tc."userId"
LEFT JOIN "rides" r ON sa."rideId" = r."rideId"
WHERE tc."phone" = $1 -- caller's verified phone number
  AND sa."status" IN ('TRIGGERED', 'ACKNOWLEDGED')
ORDER BY sa."triggeredAt" DESC;

-- ---------------------------------------------------------------------
-- Query 7.4: Acknowledge & Resolve SOS Alert
-- Description: Marks an active SOS emergency event as resolved.
-- ---------------------------------------------------------------------
-- WRITE
UPDATE "sos_alerts"
SET "status" = 'RESOLVED',
    "resolvedAt" = CURRENT_TIMESTAMP,
    "resolverNotes" = $2,
    "resolvedById" = $3
WHERE "alertId" = $1
  AND "status" IN ('TRIGGERED', 'ACKNOWLEDGED');


-- =====================================================================
-- MODULE 8: TRUST, RATINGS & REVIEWS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 8.1: Submit User Rating & Review
-- Description: Persists star score and written review between ride participants.
-- ---------------------------------------------------------------------
-- WRITE (Step A: Rating)
INSERT INTO "ratings" (
    "ratingId",
    "bookingId",
    "rideId",
    "raterId",
    "rateeId",
    "score",
    "comment",
    "createdAt"
) VALUES (
    $1, -- ratingId
    $2, -- bookingId
    $3, -- rideId
    $4, -- raterId
    $5, -- rateeId
    $6, -- score (1 to 5)
    $7, -- comment
    CURRENT_TIMESTAMP
);

-- WRITE (Step B: Optional Review Details)
INSERT INTO "reviews" (
    "reviewId",
    "ratingId",
    "headline",
    "reviewText",
    "createdAt"
) VALUES (
    $1, -- reviewId
    $2, -- ratingId
    $3, -- headline
    $4, -- reviewText
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 8.2: Recalculate Driver Profile Aggregate Rating
-- Description: Updates driver profile rating average and trip counter based on rating rows.
-- ---------------------------------------------------------------------
-- WRITE
UPDATE "driver_profiles" dp
SET "ratingAverage" = sub."avgScore",
    "totalTrips" = sub."totalCount",
    "updatedAt" = CURRENT_TIMESTAMP
FROM (
    SELECT 
        "rateeId",
        ROUND(AVG("score"), 2) AS "avgScore",
        COUNT("ratingId") AS "totalCount"
    FROM "ratings"
    WHERE "rateeId" = $1
    GROUP BY "rateeId"
) sub
WHERE dp."userId" = sub."rateeId";

-- ---------------------------------------------------------------------
-- Query 8.3: Retrieve User Reviews with Rater Context
-- Description: JOINs reviews, ratings, and rater profile for social trust display.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    rt."ratingId",
    rt."score",
    rt."comment",
    rt."createdAt",
    rv."headline",
    rv."reviewText",
    rater."name" AS "raterName",
    rater."profileImage" AS "raterImage"
FROM "ratings" rt
INNER JOIN "users" rater ON rt."raterId" = rater."userId"
LEFT JOIN "reviews" rv ON rt."ratingId" = rv."ratingId"
WHERE rt."rateeId" = $1
ORDER BY rt."createdAt" DESC
LIMIT 20;


-- =====================================================================
-- MODULE 9: NOTIFICATIONS & DISPATCH
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 9.1: Queue In-App Notification
-- Description: Inserts a push/in-app alert for user booking or trip updates.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "notifications" (
    "notificationId",
    "userId",
    "type",
    "title",
    "body",
    "isRead",
    "createdAt"
) VALUES (
    $1, -- notificationId
    $2, -- userId
    $3, -- type ('BOOKING_CONFIRMATION', 'SAFETY_ALERT', etc.)
    $4, -- title
    $5, -- body
    false,
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 9.2: Fetch Unread User Notifications
-- Description: Retrieves unread alerts ordered by urgency.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    "notificationId",
    "type",
    "title",
    "body",
    "createdAt"
FROM "notifications"
WHERE "userId" = $1
  AND "isRead" = false
ORDER BY "createdAt" DESC
LIMIT 25;

-- ---------------------------------------------------------------------
-- Query 9.3: Mark Notifications as Read
-- Description: Bulk acknowledges unread notifications.
-- ---------------------------------------------------------------------
-- WRITE
UPDATE "notifications"
SET "isRead" = true
WHERE "userId" = $1
  AND "isRead" = false;


-- =====================================================================
-- MODULE 10: SUSTAINABILITY, GREEN POINTS & ANALYTICS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Query 10.1: Record Carbon Emission Savings
-- Description: Estimates carbon footprint reduction from shared carpool seating.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "emission_estimates" (
    "estimateId",
    "rideId",
    "bookingId",
    "distanceKm",
    "co2SavedGrams",
    "createdAt"
) VALUES (
    $1, -- estimateId
    $2, -- rideId
    $3, -- bookingId
    $4, -- distanceKm
    ROUND($4 * 140.0, 2), -- 140g CO2 saved per shared carpool km
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 10.2: Award Commuter Green Points
-- Description: Adds green points to passenger/driver sustainability ledger.
-- ---------------------------------------------------------------------
-- WRITE
INSERT INTO "green_point_transactions" (
    "transactionId",
    "userId",
    "points",
    "type",
    "description",
    "createdAt"
) VALUES (
    $1, -- transactionId
    $2, -- userId
    $3, -- points (INTEGER)
    'RIDE_SHARED',
    $4, -- description
    CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Query 10.3: Platform Executive Analytics Dashboard
-- Description: High-level management query aggregating platform metrics across tables with complex JOINs.
-- ---------------------------------------------------------------------
-- READ
SELECT 
    COUNT(DISTINCT u."userId") AS "totalRegisteredUsers",
    COUNT(DISTINCT r."rideId") AS "totalRidesCreated",
    COUNT(DISTINCT b."bookingId") FILTER (WHERE b."bookingStatus" = 'COMPLETED') AS "completedCarPoolTrips",
    COALESCE(SUM(b."totalFare") FILTER (WHERE b."bookingStatus" = 'COMPLETED'), 0.00) AS "totalGrossVolumeINR",
    COALESCE(ROUND(SUM(ee."co2SavedGrams") / 1000.0, 2), 0.00) AS "totalCO2SavedKilograms",
    COUNT(DISTINCT sa."alertId") AS "totalSOSAlertsTriggered"
FROM "users" u
LEFT JOIN "rides" r ON r."driverId" = u."userId"
LEFT JOIN "bookings" b ON b."rideId" = r."rideId"
LEFT JOIN "emission_estimates" ee ON ee."rideId" = r."rideId"
LEFT JOIN "sos_alerts" sa ON sa."userId" = u."userId";
