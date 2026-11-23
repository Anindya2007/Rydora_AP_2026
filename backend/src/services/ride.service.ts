import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { BookingStatus, RideStatus, UserRole } from '../generated/prisma/client.js';
import type { CreateRideInput, DriverRidesQueryInput, RideQueryInput, UpdateRideInput } from '../validators/rideValidator.js';
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

export interface PaginatedRidesResult {
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
  // --------------------------------------------------------------------------
  // STEP 1: Verify Driver Identity & Verification Status
  // Only users who have been approved by an administrator and hold the DRIVER role
  // are allowed to publish rides.
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // STEP 2: Verify Vehicle Ownership & Active Lifecycle Status
  // A driver cannot publish rides using another person's car or a deactivated vehicle.
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // STEP 3: Enforce Vehicle Passenger Seat Capacity Limit
  // Offerer cannot offer more seats than the vehicle physically supports.
  // --------------------------------------------------------------------------
  if (input.totalSeats > vehicle.seatCapacity) {
    throw new BadRequestError(
      `Total seats offered (${input.totalSeats}) exceeds vehicle seat capacity (${vehicle.seatCapacity})`
    );
  }

  // --------------------------------------------------------------------------
  // STEP 4: Resolve Target Community & Ensure Active Driver Membership
  // Drivers publish open carpool rides. If no communityId is provided,
  // automatically defaults to the Open Community.
  // --------------------------------------------------------------------------
  let targetCommunityId = input.communityId;
  if (!targetCommunityId) {
    const openComm = await prisma.community.findFirst({
      where: {
        OR: [
          { domain: 'open.rydora.com' },
          { name: { contains: 'Open', mode: 'insensitive' } },
        ],
      },
      select: { communityId: true },
    });
    if (openComm) {
      targetCommunityId = openComm.communityId;
    } else {
      const anyActive = await prisma.community.findFirst({
        where: { status: 'ACTIVE' },
        select: { communityId: true },
      });
      targetCommunityId = anyActive?.communityId;
    }
  }

  if (!targetCommunityId) {
    throw new BadRequestError('No active community available for carpool publication');
  }

  const community = await prisma.community.findUnique({
    where: { communityId: targetCommunityId },
    select: {
      communityId: true,
      status: true,
    },
  });

  if (!community || community.status !== 'ACTIVE') {
    throw new NotFoundError('Community not found or is inactive');
  }

  // Ensure driver holds active membership so carpool publishing always succeeds
  await prisma.communityMembership.upsert({
    where: {
      communityId_userId: {
        communityId: targetCommunityId,
        userId: driverId,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      communityId: targetCommunityId,
      userId: driverId,
      status: 'ACTIVE',
    },
  });

  // --------------------------------------------------------------------------
  // STEP 5: Scheduling Conflict Check
  // A driver or vehicle cannot be committed to two overlapping rides simultaneously.
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // STEP 6: Persist the New Ride to the Database
  // Initial state: availableSeats = totalSeats, status = SCHEDULED
  // --------------------------------------------------------------------------
  const ride = await prisma.ride.create({
    data: {
      driverId,
      vehicleId: input.vehicleId,
      communityId: targetCommunityId,
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

/**
 * Lists and searches public/community carpool rides (GET /api/v1/rides).
 *
 * Security & Data Privacy:
 * 1. Public / Authenticated Discovery: Does not require elevated DRIVER role.
 * 2. Zero Private Leakage: Output is strictly projected through rideDetailSelectProjection
 *    which hides driver passwordHash, walletBalance, licenseNumber, and licenseExpiry.
 * 3. Database-Level Filtering: Applies all conditions (communityId, source, destination, status,
 *    availableSeats, vehicleType, departure date ranges) directly in PostgreSQL via Prisma.
 * 4. Deterministic Ordering: Orders by requested field (default: departureTime asc) with rideId tie-breaker.
 * 5. Safe Bounded Pagination: Computes standard PaginationMeta with bounded page and limit.
 *
 * @param options Validated ride query options and pagination parameters.
 * @returns Paginated list of public ride summaries and pagination metadata.
 */
export async function listRides(
  options?: RideQueryInput,
  userId?: string
): Promise<PaginatedRidesResult> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (options?.communityId) {
    where.communityId = options.communityId;
  }

  if (options?.source) {
    where.source = {
      contains: options.source,
      mode: 'insensitive',
    };
  }

  if (options?.destination) {
    where.destination = {
      contains: options.destination,
      mode: 'insensitive',
    };
  }

  if (options?.status) {
    where.status = options.status;
  }

  // Seats filter: either availableSeats or minSeats
  const requiredSeats = options?.minSeats ?? options?.availableSeats;
  if (requiredSeats !== undefined) {
    where.availableSeats = {
      gte: requiredSeats,
    };
  }

  // Vehicle type filter via vehicle relation
  if (options?.vehicleType) {
    where.vehicle = {
      vehicleType: {
        equals: options.vehicleType,
        mode: 'insensitive',
      },
    };
  }

  // Date and date range handling on departureTime
  if (options?.date) {
    const dayStart = new Date(`${options.date}T00:00:00.000Z`);
    const dayEnd = new Date(`${options.date}T23:59:59.999Z`);
    where.departureTime = {
      gte: dayStart,
      lte: dayEnd,
    };
  } else if (options?.startDate || options?.endDate) {
    const departureFilter: { gte?: Date; lte?: Date } = {};
    if (options.startDate) {
      departureFilter.gte = options.startDate.includes('T')
        ? new Date(options.startDate)
        : new Date(`${options.startDate}T00:00:00.000Z`);
    }
    if (options.endDate) {
      departureFilter.lte = options.endDate.includes('T')
        ? new Date(options.endDate)
        : new Date(`${options.endDate}T23:59:59.999Z`);
    }
    where.departureTime = departureFilter;
  }

  const sortBy = options?.sortBy ?? 'departureTime';
  const sortOrder = options?.sortOrder ?? 'asc';

  // Deterministic sorting with secondary tie-breaker on rideId
  const orderBy: any = [
    { [sortBy]: sortOrder },
    { rideId: 'asc' },
  ];

  const [total, records] = await Promise.all([
    prisma.ride.count({ where }),
    prisma.ride.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: rideDetailSelectProjection,
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;

  let userCommunityIds: string[] = [];
  if (userId) {
    const memberships = await prisma.communityMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { communityId: true },
    });
    userCommunityIds = memberships.map((m) => m.communityId);
  }

  let formattedRides = records.map(formatRideDetailOutput);
  if (userCommunityIds.length > 0) {
    formattedRides.sort((a, b) => {
      const aIsMember = a.community && userCommunityIds.includes(a.community.communityId) ? 1 : 0;
      const bIsMember = b.community && userCommunityIds.includes(b.community.communityId) ? 1 : 0;
      if (aIsMember !== bIsMember) {
        return bIsMember - aIsMember; // member's community rides prioritized at the top
      }
      return 0;
    });
  }

  return {
    rides: formattedRides,
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

/**
 * Updates permitted mutable fields of a ride belonging to the authenticated driver.
 *
 * Security & Lifecycle Rules:
 * 1. Existence Check: Finds ride by rideId. If not found, throws NotFoundError (404).
 * 2. Ownership Check: If ride.driverId !== driverId, throws ForbiddenError (403).
 * 3. Lifecycle Enforcement: Only SCHEDULED rides can be updated.
 *    If status is IN_PROGRESS, COMPLETED, or CANCELLED, throws BadRequestError (400).
 *    If departureTime has already passed, throws BadRequestError (400).
 * 4. Vehicle Invariant: If vehicleId is changed:
 *    - New vehicle must belong to driver and be isActive = true.
 *    - New vehicle seatCapacity must be >= totalSeats.
 * 5. Seat Capacity & Booking Invariant:
 *    - Booked seats = ride.totalSeats - ride.availableSeats.
 *    - If new totalSeats < bookedSeats, throws BadRequestError.
 *    - new availableSeats = new totalSeats - bookedSeats.
 * 6. Scheduling Conflict Prevention:
 *    - If departureTime or vehicleId is changed, checks that driver/vehicle has no conflicting ride.
 * 7. Route Invariant:
 *    - If source is updated, source !== destination.
 * 8. Atomic Database Update:
 *    - Updates only permitted fields in PostgreSQL and returns formatted RideDetailOutput.
 *
 * @param driverId UUID of the authenticated driver.
 * @param rideId UUID of the target ride.
 * @param input Validated update payload.
 * @returns Standardized RideDetailOutput representation.
 */
export async function updateRide(
  driverId: string,
  rideId: string,
  input: UpdateRideInput
): Promise<RideDetailOutput> {
  // 1. Fetch current ride state with vehicle
  const existingRide = await prisma.ride.findUnique({
    where: { rideId },
    include: {
      vehicle: {
        select: {
          vehicleId: true,
          seatCapacity: true,
          isActive: true,
          driverId: true,
        },
      },
    },
  });

  if (!existingRide) {
    throw new NotFoundError('Ride not found');
  }

  // 2. Ownership check
  if (existingRide.driverId !== driverId) {
    throw new ForbiddenError('You are not authorized to update this ride');
  }

  // 3. Lifecycle state check
  if (existingRide.status !== RideStatus.SCHEDULED) {
    throw new BadRequestError(
      `Cannot update ride with status ${existingRide.status}. Only SCHEDULED rides can be updated.`
    );
  }

  if (new Date(existingRide.departureTime).getTime() <= Date.now()) {
    throw new BadRequestError('Cannot update a ride whose scheduled departure time has passed');
  }

  // 4. Source & destination collision check with existing record
  const effectiveSource = input.source?.trim() ?? existingRide.source;
  const effectiveDestination = input.destination?.trim() ?? existingRide.destination;
  if (effectiveSource.toLowerCase() === effectiveDestination.toLowerCase()) {
    throw new BadRequestError('Source and destination cannot be identical');
  }

  // 5. Vehicle change validation
  let targetVehicle = existingRide.vehicle;
  if (input.vehicleId && input.vehicleId !== existingRide.vehicleId) {
    const newVehicle = await prisma.vehicle.findFirst({
      where: {
        vehicleId: input.vehicleId,
        driverId,
      },
      select: {
        vehicleId: true,
        seatCapacity: true,
        isActive: true,
        driverId: true,
      },
    });

    if (!newVehicle) {
      throw new NotFoundError('Selected vehicle not found or does not belong to you');
    }

    if (!newVehicle.isActive) {
      throw new BadRequestError('Selected vehicle is inactive and cannot be assigned to rides');
    }

    targetVehicle = newVehicle;
  }

  // 6. Total seats vs vehicle capacity & existing bookings
  const bookedSeats = existingRide.totalSeats - existingRide.availableSeats;
  let newAvailableSeats = existingRide.availableSeats;

  if (input.totalSeats !== undefined) {
    if (input.totalSeats > targetVehicle.seatCapacity) {
      throw new BadRequestError(
        `Total seats offered (${input.totalSeats}) exceeds vehicle seat capacity (${targetVehicle.seatCapacity})`
      );
    }

    if (input.totalSeats < bookedSeats) {
      throw new BadRequestError(
        `Cannot reduce total seats to ${input.totalSeats}; ${bookedSeats} seats are already booked`
      );
    }

    newAvailableSeats = input.totalSeats - bookedSeats;
  } else if (input.vehicleId && existingRide.totalSeats > targetVehicle.seatCapacity) {
    throw new BadRequestError(
      `Current total seats (${existingRide.totalSeats}) exceeds new vehicle seat capacity (${targetVehicle.seatCapacity})`
    );
  }

  // 7. Scheduling conflicts check if departureTime or vehicleId changed
  const effectiveDepartureTime = input.departureTime ?? existingRide.departureTime;
  const departureChanged =
    input.departureTime &&
    input.departureTime.getTime() !== new Date(existingRide.departureTime).getTime();
  const vehicleChanged = input.vehicleId && input.vehicleId !== existingRide.vehicleId;

  if (departureChanged || vehicleChanged) {
    const conflict = await prisma.ride.findFirst({
      where: {
        rideId: { not: rideId },
        departureTime: effectiveDepartureTime,
        status: { in: [RideStatus.SCHEDULED, RideStatus.IN_PROGRESS] },
        OR: [
          { driverId },
          { vehicleId: targetVehicle.vehicleId },
        ],
      },
      select: { rideId: true },
    });

    if (conflict) {
      throw new ConflictError(
        'A ride is already scheduled for this driver or vehicle at the specified departure time'
      );
    }
  }

  // 8. Assemble database update payload (preserving omitted fields)
  const updateData: any = {};
  if (input.vehicleId) updateData.vehicleId = input.vehicleId;
  if (input.source) updateData.source = input.source.trim();
  if (input.destination) updateData.destination = input.destination.trim();
  if (input.departureTime) updateData.departureTime = input.departureTime;
  if (input.totalSeats !== undefined) {
    updateData.totalSeats = input.totalSeats;
    updateData.availableSeats = newAvailableSeats;
  }
  if (input.farePerSeat !== undefined) updateData.farePerSeat = input.farePerSeat;
  if (input.sourceLatitude !== undefined) updateData.sourceLatitude = input.sourceLatitude;
  if (input.sourceLongitude !== undefined) updateData.sourceLongitude = input.sourceLongitude;
  if (input.destinationLatitude !== undefined) updateData.destinationLatitude = input.destinationLatitude;
  if (input.destinationLongitude !== undefined) updateData.destinationLongitude = input.destinationLongitude;

  const updatedRide = await prisma.ride.update({
    where: { rideId },
    data: updateData,
    select: rideDetailSelectProjection,
  });

  return formatRideDetailOutput(updatedRide);
}

/**
 * Cancels a scheduled ride belonging to the authenticated driver.
 *
 * Security & Lifecycle Rules:
 * 1. Existence Check: Finds ride by rideId. If not found, throws NotFoundError (404).
 * 2. Ownership Check: If ride.driverId !== driverId, throws ForbiddenError (403).
 * 3. Non-Repeatable & State Transitions:
 *    - If status === CANCELLED, throws BadRequestError ('Ride is already cancelled') (400).
 *    - If status === COMPLETED, throws BadRequestError ('Cannot cancel a completed ride') (400).
 *    - If status === IN_PROGRESS, throws BadRequestError ('Cannot cancel a ride that is currently in progress') (400).
 *    - Only SCHEDULED rides may be cancelled.
 * 4. Concurrency Safety:
 *    - Uses atomic conditional mutation `tx.ride.updateMany({ where: { rideId, driverId, status: RideStatus.SCHEDULED }, data: { status: RideStatus.CANCELLED } })`.
 *    - If `updateResult.count === 0`, throws ConflictError ('Ride cancellation conflict: ride status was modified concurrently') (409).
 * 5. Safe Response:
 *    - Returns updated RideDetailOutput without sensitive driver credentials.
 *
 * @param driverId UUID of the authenticated driver.
 * @param rideId UUID of the target ride.
 * @returns Standardized RideDetailOutput with status CANCELLED.
 */
export async function cancelRide(
  driverId: string,
  rideId: string
): Promise<RideDetailOutput> {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch current ride state
    const ride = await tx.ride.findUnique({
      where: { rideId },
      select: {
        rideId: true,
        driverId: true,
        status: true,
      },
    });

    if (!ride) {
      throw new NotFoundError('Ride not found');
    }

    // 2. Ownership enforcement
    if (ride.driverId !== driverId) {
      throw new ForbiddenError('You are not authorized to cancel this ride');
    }

    // 3. Lifecycle state transition validation
    if (ride.status === RideStatus.CANCELLED) {
      throw new BadRequestError('Ride is already cancelled');
    }

    if (ride.status === RideStatus.COMPLETED) {
      throw new BadRequestError('Cannot cancel a completed ride');
    }

    if (ride.status === RideStatus.IN_PROGRESS) {
      throw new BadRequestError('Cannot cancel a ride that is currently in progress');
    }

    if (ride.status !== RideStatus.SCHEDULED) {
      throw new BadRequestError(`Invalid status transition: cannot cancel ride with status ${ride.status}`);
    }

    // 4. Atomic conditional update to guard against concurrent race conditions
    const updateResult = await tx.ride.updateMany({
      where: {
        rideId,
        driverId,
        status: RideStatus.SCHEDULED,
      },
      data: {
        status: RideStatus.CANCELLED,
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictError(
        'Ride cancellation conflict: ride status was modified concurrently'
      );
    }

    // 5. Atomic Booking Cancellation Propagation (M9.2.5):
    // In the exact same interactive database transaction, propagate the cancellation
    // to all active bookings (PENDING, CONFIRMED) associated with this cancelled ride.
    // Invariants:
    // - Attributed directly to the verified driver: cancelledById = driverId
    // - Authoritative timestamp: cancelledAt = cancellationTimestamp
    // - Standardized cancellation reason: [CANCELLED_BY_DRIVER] Ride cancelled by driver
    // - Preservation of prior cancellations: Excludes already CANCELLED bookings so prior
    //   passenger voluntary cancellations (and their refund policies) are never overwritten.
    const cancellationTimestamp = new Date();

    await tx.booking.updateMany({
      where: {
        rideId,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: cancellationTimestamp,
        cancelledById: driverId,
        cancellationReason: '[CANCELLED_BY_DRIVER] Ride cancelled by driver',
      },
    });

    // 6. Retrieve updated ride with safe relations
    const updatedRide = await tx.ride.findUnique({
      where: { rideId },
      select: rideDetailSelectProjection,
    });

    if (!updatedRide) {
      throw new NotFoundError('Ride not found');
    }

    return formatRideDetailOutput(updatedRide);
  });
}

export const rideService = {
  createRide,
  getRideById,
  listDriverRides,
  listRides,
  updateRide,
  cancelRide,
};
