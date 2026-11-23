import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { RideStatus, UserRole } from '../generated/prisma/client.js';
import type { CreateRideInput, DriverRidesQueryInput } from '../validators/rideValidator.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import type { PaginationMeta } from '../utils/response.js';

export interface RideDriverSummary {
  userId: string;
  name: string;
  email: string;
  profileImage: string | null;
  averageRating: string;
  ratingCount: number;
}

export interface RideVehicleSummary {
  vehicleId: string;
  make: string;
  model: string;
  color: string | null;
  vehicleType: string;
  registrationNumber: string;
  seatCapacity: number;
}

export interface RideCommunitySummary {
  communityId: string;
  name: string;
  domain: string;
}

export interface RideOutput {
  rideId: string;
  driverId: string;
  vehicleId: string;
  communityId: string;
  source: string;
  destination: string;
  departureTime: Date;
  sourceLatitude: string | null;
  sourceLongitude: string | null;
  destinationLatitude: string | null;
  destinationLongitude: string | null;
  totalSeats: number;
  availableSeats: number;
  farePerSeat: string;
  status: RideStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface RideDetailOutput extends RideOutput {
  driver?: RideDriverSummary;
  vehicle?: RideVehicleSummary;
  community?: RideCommunitySummary;
}

export interface PaginatedDriverRidesResult {
  rides: RideDetailOutput[];
  pagination: PaginationMeta;
}

/**
 * Standard Prisma selection projection for Ride entities.
 * Ensures consistent serialization while protecting internal database models.
 */
const rideSelectProjection = {
  rideId: true,
  driverId: true,
  vehicleId: true,
  communityId: true,
  source: true,
  destination: true,
  departureTime: true,
  sourceLatitude: true,
  sourceLongitude: true,
  destinationLatitude: true,
  destinationLongitude: true,
  totalSeats: true,
  availableSeats: true,
  farePerSeat: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Standard selection projection including safe public driver, vehicle, and community relations.
 * Never selects passwordHash, walletBalance, licenseNumber, or other private credentials.
 */
const rideDetailSelectProjection = {
  ...rideSelectProjection,
  driver: {
    select: {
      userId: true,
      name: true,
      email: true,
      profileImage: true,
      averageRating: true,
      ratingCount: true,
    },
  },
  vehicle: {
    select: {
      vehicleId: true,
      make: true,
      model: true,
      color: true,
      vehicleType: true,
      registrationNumber: true,
      seatCapacity: true,
    },
  },
  community: {
    select: {
      communityId: true,
      name: true,
      domain: true,
      status: true,
    },
  },
};

/**
 * Transforms raw Prisma Ride model to standardized RideOutput with clean stringified decimals.
 */
function formatRideOutput(raw: any): RideOutput {
  return {
    rideId: raw.rideId,
    driverId: raw.driverId,
    vehicleId: raw.vehicleId,
    communityId: raw.communityId,
    source: raw.source,
    destination: raw.destination,
    departureTime: raw.departureTime,
    sourceLatitude: raw.sourceLatitude !== null && raw.sourceLatitude !== undefined ? raw.sourceLatitude.toString() : null,
    sourceLongitude: raw.sourceLongitude !== null && raw.sourceLongitude !== undefined ? raw.sourceLongitude.toString() : null,
    destinationLatitude: raw.destinationLatitude !== null && raw.destinationLatitude !== undefined ? raw.destinationLatitude.toString() : null,
    destinationLongitude: raw.destinationLongitude !== null && raw.destinationLongitude !== undefined ? raw.destinationLongitude.toString() : null,
    totalSeats: raw.totalSeats,
    availableSeats: raw.availableSeats,
    farePerSeat: raw.farePerSeat ? raw.farePerSeat.toString() : '0.00',
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Transforms raw Prisma Ride model with relations to standardized RideDetailOutput.
 */
function formatRideDetailOutput(raw: any): RideDetailOutput {
  const base = formatRideOutput(raw);
  return {
    ...base,
    driver: raw.driver
      ? {
          userId: raw.driver.userId,
          name: raw.driver.name,
          email: raw.driver.email,
          profileImage: raw.driver.profileImage,
          averageRating: raw.driver.averageRating ? raw.driver.averageRating.toString() : '5.00',
          ratingCount: raw.driver.ratingCount ?? 0,
        }
      : undefined,
    vehicle: raw.vehicle
      ? {
          vehicleId: raw.vehicle.vehicleId,
          make: raw.vehicle.make,
          model: raw.vehicle.model,
          color: raw.vehicle.color,
          vehicleType: raw.vehicle.vehicleType,
          registrationNumber: raw.vehicle.registrationNumber,
          seatCapacity: raw.vehicle.seatCapacity,
        }
      : undefined,
    community: raw.community
      ? {
          communityId: raw.community.communityId,
          name: raw.community.name,
          domain: raw.community.domain,
        }
      : undefined,
  };
}

/**
 * Publishes a new carpool ride (POST /api/v1/rides).
 *
 * Security & Lifecycle Invariants:
 * 1. Verified Driver Check: Caller must exist, hold DRIVER role, and have driverVerified = true.
 * 2. Vehicle Ownership & Health: Vehicle must belong to the caller and be currently active.
 * 3. Seat Capacity Invariant: Offered seats cannot exceed vehicle passenger seat capacity (Decision 06).
 * 4. Strict Community Silo: Community must be active, and driver must be an active member (Decision 07).
 * 5. Scheduling Conflict Prevention: Driver or vehicle cannot have another ride scheduled at the same departure time.
 * 6. Initial Ride State: availableSeats initialized to totalSeats, status set to SCHEDULED.
 *
 * @param driverId UUID of the authenticated driver.
 * @param input Validated ride creation payload.
 * @returns Standardized RideOutput representation.
 */
export async function createRide(
  driverId: string,
  input: CreateRideInput
): Promise<RideOutput> {
  // 1. Verify driver existence, DRIVER role, and driverVerified status
  const driver = await prisma.user.findUnique({
    where: { userId: driverId },
    select: {
      userId: true,
      roles: true,
      driverVerified: true,
    },
  });

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  const hasDriverRole = Array.isArray(driver.roles) && driver.roles.includes(UserRole.DRIVER);
  if (!hasDriverRole || !driver.driverVerified) {
    throw new ForbiddenError('Forbidden: Must be an approved and verified driver to publish a ride');
  }

  // 2. Verify vehicle ownership and active lifecycle status (zero-knowledge privacy)
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      vehicleId: input.vehicleId,
      driverId,
    },
    select: {
      vehicleId: true,
      seatCapacity: true,
      isActive: true,
    },
  });

  if (!vehicle) {
    throw new NotFoundError('Vehicle not found');
  }

  if (!vehicle.isActive) {
    throw new BadRequestError('Selected vehicle is inactive and cannot be used for rides');
  }

  // 3. Validate seat capacity against vehicle bookable passenger capacity (Decision 06)
  if (input.totalSeats > vehicle.seatCapacity) {
    throw new BadRequestError(
      `Total seats offered (${input.totalSeats}) exceeds vehicle seat capacity (${vehicle.seatCapacity})`
    );
  }

  // 4. Verify target community existence and active driver membership (Decision 07)
  const community = await prisma.community.findUnique({
    where: { communityId: input.communityId },
    select: {
      communityId: true,
      status: true,
    },
  });

  if (!community || community.status !== 'ACTIVE') {
    throw new NotFoundError('Community not found or is inactive');
  }

  const membership = await prisma.communityMembership.findUnique({
    where: {
      communityId_userId: {
        communityId: input.communityId,
        userId: driverId,
      },
    },
    select: {
      status: true,
    },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new ForbiddenError('Forbidden: Driver must be an active member of the community to publish a ride');
  }

  // 5. Prevent scheduling conflicts: driver or vehicle already committed at exact departure time
  const existingConflict = await prisma.ride.findFirst({
    where: {
      departureTime: input.departureTime,
      status: { in: [RideStatus.SCHEDULED, RideStatus.IN_PROGRESS] },
      OR: [
        { driverId },
        { vehicleId: input.vehicleId },
      ],
    },
    select: { rideId: true },
  });

  if (existingConflict) {
    throw new ConflictError(
      'A ride is already scheduled for this driver or vehicle at the specified departure time'
    );
  }

  // 6. Create ride in PostgreSQL
  const ride = await prisma.ride.create({
    data: {
      driverId,
      vehicleId: input.vehicleId,
      communityId: input.communityId,
      source: input.source.trim(),
      destination: input.destination.trim(),
      departureTime: input.departureTime,
      sourceLatitude: input.sourceLatitude ?? null,
      sourceLongitude: input.sourceLongitude ?? null,
      destinationLatitude: input.destinationLatitude ?? null,
      destinationLongitude: input.destinationLongitude ?? null,
      totalSeats: input.totalSeats,
      availableSeats: input.totalSeats,
      farePerSeat: input.farePerSeat,
      status: RideStatus.SCHEDULED,
    },
    select: rideSelectProjection,
  });

  return formatRideOutput(ride);
}

/**
 * Retrieves a single ride by its unique UUID (GET /api/v1/rides/:rideId).
 *
 * Security & Access Rules:
 * 1. Checks ride existence in PostgreSQL.
 * 2. Zero-Leakage: Safe relation projection excludes driver credentials, phone numbers, and balances.
 * 3. Community Isolation (Decision 07):
 *    - Driver of the ride has access.
 *    - Platform ADMIN has access.
 *    - Any rider/user who is an ACTIVE member of the ride's community has access.
 *    - Non-members receive HTTP 403 Forbidden.
 *
 * @param userId UUID of the authenticated caller.
 * @param rideId UUID of the target ride.
 * @returns Standardized RideDetailOutput with driver, vehicle, and community summaries.
 */
export async function getRideById(
  userId: string,
  rideId: string
): Promise<RideDetailOutput> {
  const ride = await prisma.ride.findUnique({
    where: { rideId },
    select: rideDetailSelectProjection,
  });

  if (!ride) {
    throw new NotFoundError('Ride not found');
  }

  // Visibility / Access Control:
  // Driver and platform admin are permitted directly
  const isDriver = ride.driverId === userId;
  const isAdmin = env.ADMIN_USER_IDS.includes(userId.toLowerCase());

  if (!isDriver && !isAdmin) {
    // Rider must be an ACTIVE member of the community hosting the ride
    const membership = await prisma.communityMembership.findUnique({
      where: {
        communityId_userId: {
          communityId: ride.communityId,
          userId,
        },
      },
      select: { status: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Forbidden: Must be an active member of the community to view this ride');
    }
  }

  return formatRideDetailOutput(ride);
}

/**
 * Retrieves rides created by the authenticated driver (GET /api/v1/rides/me).
 *
 * Security & Ownership Rules:
 * 1. Driver Isolation: Filters strictly by driverId. A driver cannot view other drivers' published lists.
 * 2. Optional Filters: Filterable by status (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED) and communityId.
 * 3. Pagination: Follows standard Rydora PaginationMeta (page, limit, total, totalPages, hasNext, hasPrev).
 * 4. Safe Projection: Returns RideDetailOutput items including vehicle and community information.
 *
 * @param driverId UUID of the authenticated driver.
 * @param options Query filters and pagination options.
 * @returns Paginated list of rides and pagination metadata.
 */
export async function listDriverRides(
  driverId: string,
  options?: DriverRidesQueryInput
): Promise<PaginatedDriverRidesResult> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {
    driverId,
  };

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.communityId) {
    where.communityId = options.communityId;
  }

  const [total, records] = await Promise.all([
    prisma.ride.count({ where }),
    prisma.ride.findMany({
      where,
      skip,
      take: limit,
      orderBy: { departureTime: 'desc' },
      select: rideDetailSelectProjection,
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;

  return {
    rides: records.map(formatRideDetailOutput),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export const rideService = {
  createRide,
  getRideById,
  listDriverRides,
};
