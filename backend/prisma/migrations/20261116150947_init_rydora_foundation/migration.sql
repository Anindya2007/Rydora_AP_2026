-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('RIDER', 'DRIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ThemeType" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CommunityType" AS ENUM ('UNIVERSITY', 'OFFICE', 'NEIGHBORHOOD', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('EMAIL_DOMAIN', 'INVITE_CODE', 'MANUAL');

-- CreateEnum
CREATE TYPE "VerificationAttemptStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'HATCHBACK', 'SUV', 'MOTORCYCLE', 'VAN', 'OTHER');

-- CreateEnum
CREATE TYPE "DriverEligibilityStatus" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'PENDING_REVIEW', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VehicleDocumentType" AS ENUM ('REGISTRATION_CERTIFICATE', 'INSURANCE', 'POLLUTION_FITNESS', 'COMMERCIAL_PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StopType" AS ENUM ('PICKUP', 'DROPOFF', 'WAYPOINT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FareQuoteStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FareLineItemType" AS ENUM ('BASE_FARE', 'DISTANCE_FARE', 'TIME_FARE', 'PLATFORM_FEE', 'COMMUNITY_DISCOUNT', 'SURGE', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "ResponsibleParty" AS ENUM ('RIDER', 'DRIVER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "NoShowStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PenaltyAssessmentStatus" AS ENUM ('PENDING', 'WAIVED', 'APPLIED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'UPI', 'NET_BANKING', 'WALLET', 'SIMULATED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('USER_WALLET', 'DRIVER_ESCROW', 'PLATFORM_TREASURY');

-- CreateEnum
CREATE TYPE "FinancialAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('RIDE_PAYMENT', 'DRIVER_PAYOUT', 'PLATFORM_COMMISSION', 'REFUND', 'PENALTY', 'INCENTIVE');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "DriverEarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAID_OUT', 'WITHHELD');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('HARASSMENT', 'RECKLESS_DRIVING', 'ROUTE_DEVIATION', 'VEHICLE_CONDITION', 'PAYMENT_DISPUTE', 'OTHER');

-- CreateEnum
CREATE TYPE "SOSAlertStatus" AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM');

-- CreateEnum
CREATE TYPE "DeviationStatus" AS ENUM ('DETECTED', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('LOCATION_TRACKING', 'EMERGENCY_CONTACT_SHARING', 'AUDIO_RECORDING', 'MARKETING_COMMUNICATION');

-- CreateEnum
CREATE TYPE "SentimentLabel" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('USER', 'REVIEW', 'COMMUNITY', 'CHAT');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IncentiveStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RIDE_UPDATE', 'BOOKING_CONFIRMATION', 'SAFETY_ALERT', 'PAYMENT_RECEIPT', 'COMMUNITY_ANNOUNCEMENT', 'REWARD_EARNED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'OUTLOOK', 'APPLE');

-- CreateEnum
CREATE TYPE "AISessionType" AS ENUM ('RIDE_ASSISTANT', 'SUPPORT_CHATBOT', 'ROUTE_OPTIMIZER');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "GreenPointType" AS ENUM ('RIDE_SHARED', 'ZERO_EMISSION_BONUS', 'COMMUNITY_BONUS', 'REWARD_REDEMPTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "phoneVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "profileImage" TEXT,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "roleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "RoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("roleId")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" VARCHAR(45),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "verificationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("verificationId")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "resetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("resetId")
);

-- CreateTable
CREATE TABLE "phone_verifications" (
    "verificationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("verificationId")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "preferenceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "theme" "ThemeType" NOT NULL DEFAULT 'SYSTEM',
    "accessibilitySettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("preferenceId")
);

-- CreateTable
CREATE TABLE "communities" (
    "communityId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "CommunityType" NOT NULL,
    "description" TEXT,
    "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDiscoverable" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("communityId")
);

-- CreateTable
CREATE TABLE "community_memberships" (
    "membershipId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "membershipRole" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationMethod" "VerificationMethod",
    "verifiedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_memberships_pkey" PRIMARY KEY ("membershipId")
);

-- CreateTable
CREATE TABLE "community_domains" (
    "domainId" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_domains_pkey" PRIMARY KEY ("domainId")
);

-- CreateTable
CREATE TABLE "community_invites" (
    "inviteId" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "emailRestriction" VARCHAR(255),
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_invites_pkey" PRIMARY KEY ("inviteId")
);

-- CreateTable
CREATE TABLE "community_verifications" (
    "verificationId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "status" "VerificationAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_verifications_pkey" PRIMARY KEY ("verificationId")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "vehicleId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "registrationNumber" VARCHAR(50) NOT NULL,
    "make" VARCHAR(50) NOT NULL,
    "model" VARCHAR(50) NOT NULL,
    "color" VARCHAR(30) NOT NULL,
    "seatCapacity" INTEGER NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("vehicleId")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "driverProfileId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "driverVerificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "licenseVerificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "licenseNumber" VARCHAR(50),
    "eligibilityStatus" "DriverEligibilityStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("driverProfileId")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "documentId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "documentType" "VehicleDocumentType" NOT NULL,
    "fileUrl" VARCHAR(500) NOT NULL,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "rides" (
    "rideId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "originAddress" VARCHAR(255) NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "originPlaceId" VARCHAR(255),
    "destinationAddress" VARCHAR(255) NOT NULL,
    "destinationLat" DOUBLE PRECISION NOT NULL,
    "destinationLng" DOUBLE PRECISION NOT NULL,
    "destinationPlaceId" VARCHAR(255),
    "departureTime" TIMESTAMP(3) NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "availableSeats" INTEGER NOT NULL,
    "farePerSeat" DECIMAL(10,2) NOT NULL,
    "rideStatus" "RideStatus" NOT NULL DEFAULT 'SCHEDULED',
    "plannedDistanceKm" DECIMAL(8,2),
    "plannedDurationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rides_pkey" PRIMARY KEY ("rideId")
);

-- CreateTable
CREATE TABLE "ride_communities" (
    "rideCommunityId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_communities_pkey" PRIMARY KEY ("rideCommunityId")
);

-- CreateTable
CREATE TABLE "ride_stops" (
    "stopId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "stopType" "StopType" NOT NULL DEFAULT 'WAYPOINT',
    "address" VARCHAR(255) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "placeId" VARCHAR(255),
    "sequence" INTEGER NOT NULL,
    "estimatedArrivalTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_stops_pkey" PRIMARY KEY ("stopId")
);

-- CreateTable
CREATE TABLE "ride_routes" (
    "routeId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "encodedPolyline" TEXT,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "routeProvider" VARCHAR(50),
    "routeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ride_routes_pkey" PRIMARY KEY ("routeId")
);

-- CreateTable
CREATE TABLE "bookings" (
    "bookingId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "pickupAddress" VARCHAR(255) NOT NULL,
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "dropoffAddress" VARCHAR(255) NOT NULL,
    "dropoffLat" DOUBLE PRECISION NOT NULL,
    "dropoffLng" DOUBLE PRECISION NOT NULL,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalFare" DECIMAL(10,2) NOT NULL,
    "fareQuoteId" UUID,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("bookingId")
);

-- CreateTable
CREATE TABLE "booking_community_eligibilities" (
    "eligibilityId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligibilitySnapshot" JSONB,

    CONSTRAINT "booking_community_eligibilities_pkey" PRIMARY KEY ("eligibilityId")
);

-- CreateTable
CREATE TABLE "fare_quotes" (
    "quoteId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "quotedAmount" DECIMAL(10,2) NOT NULL,
    "status" "FareQuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "calculationDetails" JSONB,
    "farePolicyId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fare_quotes_pkey" PRIMARY KEY ("quoteId")
);

-- CreateTable
CREATE TABLE "fare_line_items" (
    "lineItemId" UUID NOT NULL,
    "fareQuoteId" UUID NOT NULL,
    "itemType" "FareLineItemType" NOT NULL,
    "description" VARCHAR(150) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "calculationMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fare_line_items_pkey" PRIMARY KEY ("lineItemId")
);

-- CreateTable
CREATE TABLE "cancellation_policies" (
    "policyId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "freeCancellationWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "penaltyPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "flatPenaltyAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("policyId")
);

-- CreateTable
CREATE TABLE "cancellations" (
    "cancellationId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "cancelledById" UUID NOT NULL,
    "responsibleParty" "ResponsibleParty" NOT NULL,
    "reason" TEXT NOT NULL,
    "penaltyAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "policyId" UUID,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancellations_pkey" PRIMARY KEY ("cancellationId")
);

-- CreateTable
CREATE TABLE "no_show_records" (
    "noShowId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "reportedById" UUID NOT NULL,
    "waitTimeMinutes" INTEGER NOT NULL DEFAULT 5,
    "waitStartedAt" TIMESTAMP(3),
    "waitEndedAt" TIMESTAMP(3),
    "status" "NoShowStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "no_show_records_pkey" PRIMARY KEY ("noShowId")
);

-- CreateTable
CREATE TABLE "penalty_assessments" (
    "assessmentId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "cancellationId" UUID,
    "noShowId" UUID,
    "responsibleParty" "ResponsibleParty" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PenaltyAssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "policyId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_assessments_pkey" PRIMARY KEY ("assessmentId")
);

-- CreateTable
CREATE TABLE "dispute_cases" (
    "disputeId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "reviewerId" UUID,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispute_cases_pkey" PRIMARY KEY ("disputeId")
);

-- CreateTable
CREATE TABLE "payments" (
    "paymentId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "payerId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentGateway" VARCHAR(50),
    "gatewayTransactionId" VARCHAR(150),
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" VARCHAR(100),
    "paymentMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("paymentId")
);

-- CreateTable
CREATE TABLE "refunds" (
    "refundId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayRefundId" VARCHAR(150),
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("refundId")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "accountId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accountType" "FinancialAccountType" NOT NULL DEFAULT 'USER_WALLET',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" "FinancialAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "transactionId" UUID NOT NULL,
    "transactionType" "LedgerTransactionType" NOT NULL,
    "referenceType" VARCHAR(50),
    "referenceId" UUID,
    "description" VARCHAR(255) NOT NULL,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("transactionId")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "entryId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "driver_earnings" (
    "earningId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "bookingId" UUID,
    "grossEarning" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netEarning" DECIMAL(10,2) NOT NULL,
    "status" "DriverEarningStatus" NOT NULL DEFAULT 'PENDING',
    "payoutBatchId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_earnings_pkey" PRIMARY KEY ("earningId")
);

-- CreateTable
CREATE TABLE "trusted_contacts" (
    "contactId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "relationship" VARCHAR(50),
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusted_contacts_pkey" PRIMARY KEY ("contactId")
);

-- CreateTable
CREATE TABLE "safety_incidents" (
    "incidentId" UUID NOT NULL,
    "rideId" UUID,
    "reporterId" UUID NOT NULL,
    "reportedUserId" UUID,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "category" "IncidentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "resolutionNotes" TEXT,
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_incidents_pkey" PRIMARY KEY ("incidentId")
);

-- CreateTable
CREATE TABLE "sos_alerts" (
    "alertId" UUID NOT NULL,
    "rideId" UUID,
    "userId" UUID NOT NULL,
    "status" "SOSAlertStatus" NOT NULL DEFAULT 'TRIGGERED',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" VARCHAR(255),
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolverNotes" TEXT,
    "resolvedById" UUID,

    CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("alertId")
);

-- CreateTable
CREATE TABLE "ride_locations" (
    "locationId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "bearing" DOUBLE PRECISION,
    "speedKmh" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_locations_pkey" PRIMARY KEY ("locationId")
);

-- CreateTable
CREATE TABLE "route_deviation_events" (
    "deviationId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "deviationDistanceMeters" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "DeviationStatus" NOT NULL DEFAULT 'DETECTED',
    "acknowledgedByDriverAt" TIMESTAMP(3),
    "acknowledgedByRiderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_deviation_events_pkey" PRIMARY KEY ("deviationId")
);

-- CreateTable
CREATE TABLE "safety_evidences" (
    "evidenceId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "fileUrl" VARCHAR(500) NOT NULL,
    "fileType" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "isRestricted" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_evidences_pkey" PRIMARY KEY ("evidenceId")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "consentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "isGranted" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" VARCHAR(45),
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("consentId")
);

-- CreateTable
CREATE TABLE "ratings" (
    "ratingId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "raterId" UUID NOT NULL,
    "rateeId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("ratingId")
);

-- CreateTable
CREATE TABLE "reviews" (
    "reviewId" UUID NOT NULL,
    "ratingId" UUID NOT NULL,
    "headline" VARCHAR(150),
    "reviewText" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("reviewId")
);

-- CreateTable
CREATE TABLE "feedback_categories" (
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "isPositive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_categories_pkey" PRIMARY KEY ("categoryId")
);

-- CreateTable
CREATE TABLE "feedback_analyses" (
    "analysisId" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "sentimentLabel" "SentimentLabel" NOT NULL,
    "detectedIssues" JSONB,
    "isFlaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_analyses_pkey" PRIMARY KEY ("analysisId")
);

-- CreateTable
CREATE TABLE "moderation_reports" (
    "reportId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "actionTaken" TEXT,
    "moderatorId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("reportId")
);

-- CreateTable
CREATE TABLE "driver_tiers" (
    "tierId" UUID NOT NULL,
    "tierName" VARCHAR(50) NOT NULL,
    "minRating" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "minCompletedRides" INTEGER NOT NULL DEFAULT 0,
    "commissionDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_tiers_pkey" PRIMARY KEY ("tierId")
);

-- CreateTable
CREATE TABLE "driver_tier_histories" (
    "historyId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "tierId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "driver_tier_histories_pkey" PRIMARY KEY ("historyId")
);

-- CreateTable
CREATE TABLE "driver_incentives" (
    "incentiveId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "bonusAmount" DECIMAL(10,2) NOT NULL,
    "targetRides" INTEGER NOT NULL,
    "completedRides" INTEGER NOT NULL DEFAULT 0,
    "status" "IncentiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "awardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_incentives_pkey" PRIMARY KEY ("incentiveId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notificationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "referenceType" VARCHAR(50),
    "referenceId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notificationId")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "preferenceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rideUpdates" BOOLEAN NOT NULL DEFAULT true,
    "communityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "marketingPromos" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("preferenceId")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "deliveryId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerResponse" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("deliveryId")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "connectionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "calendarId" VARCHAR(255) DEFAULT 'primary',
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "calendarEmail" VARCHAR(255),
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("connectionId")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "eventId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "externalEventId" VARCHAR(255),
    "title" VARCHAR(200) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "locationAddress" VARCHAR(255),
    "suggestedRideId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "ai_sessions" (
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionType" "AISessionType" NOT NULL DEFAULT 'RIDE_ASSISTANT',
    "provider" VARCHAR(50) NOT NULL DEFAULT 'gemini',
    "modelName" VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-flash',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "messageId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "senderRole" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "ai_analysis_logs" (
    "logId" UUID NOT NULL,
    "sessionId" UUID,
    "analysisType" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "modelUsed" VARCHAR(100) NOT NULL,
    "inputPayload" JSONB,
    "outputPayload" JSONB,
    "latencyMs" INTEGER,
    "costEstimated" DECIMAL(8,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analysis_logs_pkey" PRIMARY KEY ("logId")
);

-- CreateTable
CREATE TABLE "emission_estimates" (
    "estimateId" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "bookingId" UUID,
    "distanceKm" DECIMAL(8,2) NOT NULL,
    "co2SavedKg" DECIMAL(8,2) NOT NULL,
    "baselineCo2Kg" DECIMAL(8,2) NOT NULL,
    "actualCo2Kg" DECIMAL(8,2) NOT NULL,
    "calculationModel" VARCHAR(50) NOT NULL DEFAULT 'DEFRA_2024',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emission_estimates_pkey" PRIMARY KEY ("estimateId")
);

-- CreateTable
CREATE TABLE "green_point_transactions" (
    "transactionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "type" "GreenPointType" NOT NULL,
    "referenceType" VARCHAR(50),
    "referenceId" UUID,
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "green_point_transactions_pkey" PRIMARY KEY ("transactionId")
);

-- CreateTable
CREATE TABLE "rewards" (
    "rewardId" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "pointsRequired" INTEGER NOT NULL,
    "partnerName" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stockQuantity" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("rewardId")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "redemptionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rewardId" UUID NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "redemptionCode" VARCHAR(100),
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("redemptionId")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "logId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "targetEntity" VARCHAR(50) NOT NULL,
    "targetId" UUID,
    "ipAddress" VARCHAR(45),
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("logId")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "settingId" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("settingId")
);

-- CreateTable
CREATE TABLE "fare_policies" (
    "policyId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "perKmRate" DECIMAL(10,2) NOT NULL,
    "perMinuteRate" DECIMAL(10,2) NOT NULL,
    "platformCommissionPercent" DECIMAL(5,2) NOT NULL,
    "minimumFare" DECIMAL(10,2) NOT NULL,
    "surgeMultiplierMax" DECIMAL(3,2) NOT NULL DEFAULT 2.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fare_policies_pkey" PRIMARY KEY ("policyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshTokenHash_key" ON "user_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_tokenHash_key" ON "email_verifications"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verifications_userId_idx" ON "email_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "phone_verifications_userId_idx" ON "phone_verifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "communities_createdById_idx" ON "communities"("createdById");

-- CreateIndex
CREATE INDEX "communities_type_status_idx" ON "communities"("type", "status");

-- CreateIndex
CREATE INDEX "community_memberships_communityId_membershipStatus_idx" ON "community_memberships"("communityId", "membershipStatus");

-- CreateIndex
CREATE INDEX "community_memberships_userId_idx" ON "community_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_memberships_userId_communityId_key" ON "community_memberships"("userId", "communityId");

-- CreateIndex
CREATE INDEX "community_domains_domain_idx" ON "community_domains"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "community_domains_communityId_domain_key" ON "community_domains"("communityId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "community_invites_codeHash_key" ON "community_invites"("codeHash");

-- CreateIndex
CREATE INDEX "community_invites_communityId_idx" ON "community_invites"("communityId");

-- CreateIndex
CREATE INDEX "community_invites_createdById_idx" ON "community_invites"("createdById");

-- CreateIndex
CREATE INDEX "community_verifications_membershipId_idx" ON "community_verifications"("membershipId");

-- CreateIndex
CREATE INDEX "community_verifications_reviewerId_idx" ON "community_verifications"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registrationNumber_key" ON "vehicles"("registrationNumber");

-- CreateIndex
CREATE INDEX "vehicles_ownerId_idx" ON "vehicles"("ownerId");

-- CreateIndex
CREATE INDEX "vehicles_registrationNumber_isActive_idx" ON "vehicles"("registrationNumber", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_userId_key" ON "driver_profiles"("userId");

-- CreateIndex
CREATE INDEX "driver_profiles_eligibilityStatus_idx" ON "driver_profiles"("eligibilityStatus");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicleId_idx" ON "vehicle_documents"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_documents_reviewedById_idx" ON "vehicle_documents"("reviewedById");

-- CreateIndex
CREATE INDEX "rides_driverId_idx" ON "rides"("driverId");

-- CreateIndex
CREATE INDEX "rides_vehicleId_idx" ON "rides"("vehicleId");

-- CreateIndex
CREATE INDEX "rides_departureTime_rideStatus_idx" ON "rides"("departureTime", "rideStatus");

-- CreateIndex
CREATE INDEX "rides_rideStatus_idx" ON "rides"("rideStatus");

-- CreateIndex
CREATE INDEX "ride_communities_communityId_idx" ON "ride_communities"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "ride_communities_rideId_communityId_key" ON "ride_communities"("rideId", "communityId");

-- CreateIndex
CREATE INDEX "ride_stops_rideId_idx" ON "ride_stops"("rideId");

-- CreateIndex
CREATE UNIQUE INDEX "ride_stops_rideId_sequence_key" ON "ride_stops"("rideId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ride_routes_rideId_key" ON "ride_routes"("rideId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_fareQuoteId_key" ON "bookings"("fareQuoteId");

-- CreateIndex
CREATE INDEX "bookings_rideId_idx" ON "bookings"("rideId");

-- CreateIndex
CREATE INDEX "bookings_riderId_idx" ON "bookings"("riderId");

-- CreateIndex
CREATE INDEX "bookings_bookingStatus_idx" ON "bookings"("bookingStatus");

-- CreateIndex
CREATE INDEX "booking_community_eligibilities_bookingId_idx" ON "booking_community_eligibilities"("bookingId");

-- CreateIndex
CREATE INDEX "booking_community_eligibilities_communityId_idx" ON "booking_community_eligibilities"("communityId");

-- CreateIndex
CREATE INDEX "booking_community_eligibilities_membershipId_idx" ON "booking_community_eligibilities"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_community_eligibilities_bookingId_communityId_key" ON "booking_community_eligibilities"("bookingId", "communityId");

-- CreateIndex
CREATE INDEX "fare_quotes_rideId_idx" ON "fare_quotes"("rideId");

-- CreateIndex
CREATE INDEX "fare_quotes_riderId_idx" ON "fare_quotes"("riderId");

-- CreateIndex
CREATE INDEX "fare_quotes_farePolicyId_idx" ON "fare_quotes"("farePolicyId");

-- CreateIndex
CREATE INDEX "fare_line_items_fareQuoteId_idx" ON "fare_line_items"("fareQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "cancellations_bookingId_key" ON "cancellations"("bookingId");

-- CreateIndex
CREATE INDEX "cancellations_cancelledById_idx" ON "cancellations"("cancelledById");

-- CreateIndex
CREATE INDEX "cancellations_policyId_idx" ON "cancellations"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "no_show_records_bookingId_key" ON "no_show_records"("bookingId");

-- CreateIndex
CREATE INDEX "no_show_records_reportedById_idx" ON "no_show_records"("reportedById");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_assessments_cancellationId_key" ON "penalty_assessments"("cancellationId");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_assessments_noShowId_key" ON "penalty_assessments"("noShowId");

-- CreateIndex
CREATE INDEX "penalty_assessments_bookingId_idx" ON "penalty_assessments"("bookingId");

-- CreateIndex
CREATE INDEX "penalty_assessments_status_idx" ON "penalty_assessments"("status");

-- CreateIndex
CREATE INDEX "dispute_cases_bookingId_idx" ON "dispute_cases"("bookingId");

-- CreateIndex
CREATE INDEX "dispute_cases_submittedById_idx" ON "dispute_cases"("submittedById");

-- CreateIndex
CREATE INDEX "dispute_cases_reviewerId_idx" ON "dispute_cases"("reviewerId");

-- CreateIndex
CREATE INDEX "dispute_cases_status_idx" ON "dispute_cases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayTransactionId_key" ON "payments"("gatewayTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_payerId_idx" ON "payments"("payerId");

-- CreateIndex
CREATE INDEX "payments_paymentStatus_idx" ON "payments"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_gatewayRefundId_key" ON "refunds"("gatewayRefundId");

-- CreateIndex
CREATE INDEX "refunds_paymentId_idx" ON "refunds"("paymentId");

-- CreateIndex
CREATE INDEX "refunds_requestedById_idx" ON "refunds"("requestedById");

-- CreateIndex
CREATE INDEX "refunds_refundStatus_idx" ON "refunds"("refundStatus");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_userId_key" ON "financial_accounts"("userId");

-- CreateIndex
CREATE INDEX "financial_accounts_userId_idx" ON "financial_accounts"("userId");

-- CreateIndex
CREATE INDEX "financial_accounts_status_idx" ON "financial_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_idempotencyKey_key" ON "ledger_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ledger_transactions_referenceType_referenceId_idx" ON "ledger_transactions"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "ledger_transactions_transactionType_idx" ON "ledger_transactions"("transactionType");

-- CreateIndex
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_idx" ON "ledger_entries"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "driver_earnings_bookingId_key" ON "driver_earnings"("bookingId");

-- CreateIndex
CREATE INDEX "driver_earnings_driverId_idx" ON "driver_earnings"("driverId");

-- CreateIndex
CREATE INDEX "driver_earnings_rideId_idx" ON "driver_earnings"("rideId");

-- CreateIndex
CREATE INDEX "driver_earnings_status_idx" ON "driver_earnings"("status");

-- CreateIndex
CREATE INDEX "trusted_contacts_userId_idx" ON "trusted_contacts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_contacts_userId_phone_key" ON "trusted_contacts"("userId", "phone");

-- CreateIndex
CREATE INDEX "safety_incidents_rideId_idx" ON "safety_incidents"("rideId");

-- CreateIndex
CREATE INDEX "safety_incidents_reporterId_idx" ON "safety_incidents"("reporterId");

-- CreateIndex
CREATE INDEX "safety_incidents_reportedUserId_idx" ON "safety_incidents"("reportedUserId");

-- CreateIndex
CREATE INDEX "safety_incidents_status_idx" ON "safety_incidents"("status");

-- CreateIndex
CREATE INDEX "sos_alerts_rideId_idx" ON "sos_alerts"("rideId");

-- CreateIndex
CREATE INDEX "sos_alerts_userId_idx" ON "sos_alerts"("userId");

-- CreateIndex
CREATE INDEX "sos_alerts_status_idx" ON "sos_alerts"("status");

-- CreateIndex
CREATE INDEX "ride_locations_rideId_recordedAt_idx" ON "ride_locations"("rideId", "recordedAt");

-- CreateIndex
CREATE INDEX "route_deviation_events_rideId_idx" ON "route_deviation_events"("rideId");

-- CreateIndex
CREATE INDEX "safety_evidences_incidentId_idx" ON "safety_evidences"("incidentId");

-- CreateIndex
CREATE INDEX "consent_records_userId_consentType_idx" ON "consent_records"("userId", "consentType");

-- CreateIndex
CREATE INDEX "ratings_rateeId_idx" ON "ratings"("rateeId");

-- CreateIndex
CREATE INDEX "ratings_rideId_idx" ON "ratings"("rideId");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_bookingId_raterId_key" ON "ratings"("bookingId", "raterId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_ratingId_key" ON "reviews"("ratingId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_categories_name_key" ON "feedback_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_analyses_reviewId_key" ON "feedback_analyses"("reviewId");

-- CreateIndex
CREATE INDEX "moderation_reports_targetType_targetId_idx" ON "moderation_reports"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "moderation_reports_status_idx" ON "moderation_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "driver_tiers_tierName_key" ON "driver_tiers"("tierName");

-- CreateIndex
CREATE INDEX "driver_tier_histories_driverId_idx" ON "driver_tier_histories"("driverId");

-- CreateIndex
CREATE INDEX "driver_tier_histories_tierId_idx" ON "driver_tier_histories"("tierId");

-- CreateIndex
CREATE INDEX "driver_incentives_driverId_idx" ON "driver_incentives"("driverId");

-- CreateIndex
CREATE INDEX "driver_incentives_status_idx" ON "driver_incentives"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_deliveries_notificationId_idx" ON "notification_deliveries"("notificationId");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX "calendar_connections_userId_idx" ON "calendar_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_userId_provider_providerAccountId_key" ON "calendar_connections"("userId", "provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "calendar_events_connectionId_startTime_idx" ON "calendar_events"("connectionId", "startTime");

-- CreateIndex
CREATE INDEX "ai_sessions_userId_idx" ON "ai_sessions"("userId");

-- CreateIndex
CREATE INDEX "ai_messages_sessionId_createdAt_idx" ON "ai_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_analysis_logs_analysisType_idx" ON "ai_analysis_logs"("analysisType");

-- CreateIndex
CREATE INDEX "ai_analysis_logs_createdAt_idx" ON "ai_analysis_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "emission_estimates_bookingId_key" ON "emission_estimates"("bookingId");

-- CreateIndex
CREATE INDEX "emission_estimates_rideId_idx" ON "emission_estimates"("rideId");

-- CreateIndex
CREATE INDEX "green_point_transactions_userId_idx" ON "green_point_transactions"("userId");

-- CreateIndex
CREATE INDEX "green_point_transactions_type_idx" ON "green_point_transactions"("type");

-- CreateIndex
CREATE INDEX "reward_redemptions_userId_idx" ON "reward_redemptions"("userId");

-- CreateIndex
CREATE INDEX "reward_redemptions_rewardId_idx" ON "reward_redemptions"("rewardId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetEntity_targetId_idx" ON "admin_audit_logs"("targetEntity", "targetId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("communityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_domains" ADD CONSTRAINT "community_domains_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("communityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("communityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_verifications" ADD CONSTRAINT "community_verifications_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "community_memberships"("membershipId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_verifications" ADD CONSTRAINT "community_verifications_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("vehicleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("vehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_communities" ADD CONSTRAINT "ride_communities_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_communities" ADD CONSTRAINT "ride_communities_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("communityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_stops" ADD CONSTRAINT "ride_stops_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_routes" ADD CONSTRAINT "ride_routes_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_fareQuoteId_fkey" FOREIGN KEY ("fareQuoteId") REFERENCES "fare_quotes"("quoteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_community_eligibilities" ADD CONSTRAINT "booking_community_eligibilities_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_community_eligibilities" ADD CONSTRAINT "booking_community_eligibilities_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("communityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_community_eligibilities" ADD CONSTRAINT "booking_community_eligibilities_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "community_memberships"("membershipId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_quotes" ADD CONSTRAINT "fare_quotes_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_quotes" ADD CONSTRAINT "fare_quotes_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_quotes" ADD CONSTRAINT "fare_quotes_farePolicyId_fkey" FOREIGN KEY ("farePolicyId") REFERENCES "fare_policies"("policyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_line_items" ADD CONSTRAINT "fare_line_items_fareQuoteId_fkey" FOREIGN KEY ("fareQuoteId") REFERENCES "fare_quotes"("quoteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "cancellation_policies"("policyId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_records" ADD CONSTRAINT "no_show_records_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_records" ADD CONSTRAINT "no_show_records_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_assessments" ADD CONSTRAINT "penalty_assessments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_assessments" ADD CONSTRAINT "penalty_assessments_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "cancellations"("cancellationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_assessments" ADD CONSTRAINT "penalty_assessments_noShowId_fkey" FOREIGN KEY ("noShowId") REFERENCES "no_show_records"("noShowId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_assessments" ADD CONSTRAINT "penalty_assessments_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "cancellation_policies"("policyId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_cases" ADD CONSTRAINT "dispute_cases_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("paymentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "ledger_transactions"("transactionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("accountId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_contacts" ADD CONSTRAINT "trusted_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_locations" ADD CONSTRAINT "ride_locations_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_deviation_events" ADD CONSTRAINT "route_deviation_events_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_evidences" ADD CONSTRAINT "safety_evidences_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "safety_incidents"("incidentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_evidences" ADD CONSTRAINT "safety_evidences_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rateeId_fkey" FOREIGN KEY ("rateeId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "ratings"("ratingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_analyses" ADD CONSTRAINT "feedback_analyses_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("reviewId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_tier_histories" ADD CONSTRAINT "driver_tier_histories_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_tier_histories" ADD CONSTRAINT "driver_tier_histories_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "driver_tiers"("tierId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_incentives" ADD CONSTRAINT "driver_incentives_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("notificationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "calendar_connections"("connectionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_suggestedRideId_fkey" FOREIGN KEY ("suggestedRideId") REFERENCES "rides"("rideId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analysis_logs" ADD CONSTRAINT "ai_analysis_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_sessions"("sessionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_estimates" ADD CONSTRAINT "emission_estimates_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("rideId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_estimates" ADD CONSTRAINT "emission_estimates_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("bookingId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "green_point_transactions" ADD CONSTRAINT "green_point_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("rewardId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================
-- Custom SQL Constraints (not expressible in Prisma DSL)
-- =============================================

-- Seat Integrity: Enforce minimum 1 seat per booking
ALTER TABLE "bookings"
  ADD CONSTRAINT "chk_booking_seat_count"
  CHECK ("seatCount" >= 1);

-- Seat Integrity: Enforce minimum total seats on rides
ALTER TABLE "rides"
  ADD CONSTRAINT "chk_ride_total_seats"
  CHECK ("totalSeats" >= 1);

-- Seat Integrity: Enforce non-negative available seats
ALTER TABLE "rides"
  ADD CONSTRAINT "chk_ride_available_seats_non_negative"
  CHECK ("availableSeats" >= 0);

-- Seat Integrity: Enforce available seats cannot exceed total seats
ALTER TABLE "rides"
  ADD CONSTRAINT "chk_ride_available_seats_lte_total"
  CHECK ("availableSeats" <= "totalSeats");

-- Active Booking Uniqueness: Prevent concurrent active bookings per rider per ride
-- Allows rebooking after cancellation, expiry, no-show, or completion
CREATE UNIQUE INDEX "idx_unique_active_booking_per_rider"
ON "bookings" ("rideId", "riderId")
WHERE "bookingStatus" IN ('PENDING', 'CONFIRMED');
