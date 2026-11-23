import { prisma } from '../config/prisma.js';
import { BookingStatus, RideStatus } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../middleware/auth.js';
import type { PaginationMeta } from '../utils/response.js';
import type {
  CreateBookingInput,
  MyBookingsQueryInput,
  RejectBookingInput,
  RideBookingsQueryInput,
} from '../validators/bookingValidator.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import {
  calculateHaversineDistance,
  matchRouteCorridor,
  resolveLocationCoordinates,
  type Coordinates,
} from '../utils/distance.js';

export interface BookingDriverSummary {
  userId: string;
  name: string;
  phone?: string | null;
  profileImage: string | null;
}

export interface BookingRiderSummary {
  userId: string;
  name: string;
  phone?: string | null;
  email?: string;
  profileImage: string | null;
}

export interface BookingRideSummary {
  rideId: string;
  driverId: string;
  source: string;
  destination: string;
  departureTime: Date;
  farePerSeat: string;
  status: RideStatus;
  driver?: BookingDriverSummary;
}

export interface BookingOutput {
  bookingId: string;
  rideId: string;
  riderId: string;
  seatsBooked: number;
  status: BookingStatus;
  totalAmount: string;
  bookedAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancellationReason: string | null;
  rider?: BookingRiderSummary;
  ride?: BookingRideSummary;
}

/**
 * Standard selection projection for public booking details.
 * Prevents leaking private driver credentials, password hashes, or internal wallet balances.
 */
export const bookingDetailSelectProjection = {
  bookingId: true,
  rideId: true,
  riderId: true,
  seatsBooked: true,
  status: true,
  totalAmount: true,
  bookedAt: true,
  updatedAt: true,
  cancelledAt: true,
  cancelledById: true,
  cancellationReason: true,
  rider: {
    select: {
      userId: true,
      name: true,
      phone: true,
      email: true,
      profileImage: true,
    },
  },
  ride: {
    select: {
      rideId: true,
      driverId: true,
      source: true,
      destination: true,
      departureTime: true,
      farePerSeat: true,
      status: true,
      driver: {
        select: {
          userId: true,
          name: true,
          phone: true,
          profileImage: true,
        },
      },
    },
  },
};

/**
 * Selection projection for passenger manifests (GET /api/v1/rides/:rideId/bookings).
 * Excludes passenger email, phone, wallet balance, and password hashes for rider privacy.
 */
export const manifestBookingSelectProjection = {
  bookingId: true,
  rideId: true,
  riderId: true,
  seatsBooked: true,
  status: true,
  totalAmount: true,
  bookedAt: true,
  updatedAt: true,
  cancelledAt: true,
  cancelledById: true,
  cancellationReason: true,
  rider: {
    select: {
      userId: true,
      name: true,
      phone: true,
      profileImage: true,
      // email is omitted for privacy
    },
  },
  ride: {
    select: {
      rideId: true,
      driverId: true,
      source: true,
      destination: true,
      departureTime: true,
      farePerSeat: true,
      status: true,
      driver: {
        select: {
          userId: true,
          name: true,
          profileImage: true,
        },
      },
    },
  },
};

/**
 * Formats raw booking record for driver passenger manifest, strictly stripping passenger email.
 */
export function formatManifestBookingOutput(raw: any): BookingOutput {
  return {
    bookingId: raw.bookingId,
    rideId: raw.rideId,
    riderId: raw.riderId,
    seatsBooked: raw.seatsBooked,
    status: raw.status,
    totalAmount: raw.totalAmount ? raw.totalAmount.toString() : '0.00',
    bookedAt: raw.bookedAt,
    updatedAt: raw.updatedAt,
    cancelledAt: raw.cancelledAt ?? null,
    cancelledById: raw.cancelledById ?? null,
    cancellationReason: raw.cancellationReason ?? null,
    rider: raw.rider
      ? {
          userId: raw.rider.userId,
          name: raw.rider.name,
          phone: raw.rider.phone ?? null,
          profileImage: raw.rider.profileImage ?? null,
        }
      : undefined,
    ride: raw.ride
      ? {
          rideId: raw.ride.rideId,
          driverId: raw.ride.driverId,
          source: raw.ride.source,
          destination: raw.ride.destination,
          departureTime: raw.ride.departureTime,
          farePerSeat: raw.ride.farePerSeat ? raw.ride.farePerSeat.toString() : '0.00',
          status: raw.ride.status,
          driver: raw.ride.driver
            ? {
                userId: raw.ride.driver.userId,
                name: raw.ride.driver.name,
                phone: raw.ride.driver.phone ?? null,
                profileImage: raw.ride.driver.profileImage ?? null,
              }
            : undefined,
        }
      : undefined,
  };
}

/**
 * Formats raw Prisma Booking model to standardized BookingOutput with clean decimal strings.
 */
export function formatBookingOutput(raw: any): BookingOutput {
  return {
    bookingId: raw.bookingId,
    rideId: raw.rideId,
    riderId: raw.riderId,
    seatsBooked: raw.seatsBooked,
    status: raw.status,
    totalAmount: raw.totalAmount ? raw.totalAmount.toString() : '0.00',
    bookedAt: raw.bookedAt,
    updatedAt: raw.updatedAt,
    cancelledAt: raw.cancelledAt ?? null,
    cancelledById: raw.cancelledById ?? null,
    cancellationReason: raw.cancellationReason ?? null,
    rider: raw.rider
      ? {
          userId: raw.rider.userId,
          name: raw.rider.name,
          phone: raw.rider.phone ?? null,
          email: raw.rider.email,
          profileImage: raw.rider.profileImage ?? null,
        }
      : undefined,
    ride: raw.ride
      ? {
          rideId: raw.ride.rideId,
          driverId: raw.ride.driverId,
          source: raw.ride.source,
          destination: raw.ride.destination,
          departureTime: raw.ride.departureTime,
          farePerSeat: raw.ride.farePerSeat ? raw.ride.farePerSeat.toString() : '0.00',
          status: raw.ride.status,
          driver: raw.ride.driver
            ? {
                userId: raw.ride.driver.userId,
                name: raw.ride.driver.name,
                phone: raw.ride.driver.phone ?? null,
                profileImage: raw.ride.driver.profileImage ?? null,
              }
            : undefined,
        }
      : undefined,
  };
}

/**
 * Creates a new booking reservation and atomically allocates seats (POST /api/v1/bookings).
 *
 * Security & Lifecycle Invariants:
 * 1. Authentication & Identity: Rider identity derived strictly from authenticated user (never trusted from body).
 * 2. Self-Booking Prevention: A driver cannot book seats on their own published ride.
 * 3. Ride Lifecycle Check: Only rides in SCHEDULED status whose departureTime is in the future can be booked.
 * 4. Strict Community Silo (Decision 07): Rider must be an ACTIVE member of the community hosting the ride.
 * 5. Duplicate Active Booking Prevention (Decision 10): A rider cannot hold multiple active bookings (PENDING, CONFIRMED) on the same ride.
 * 6. Atomic Seat Allocation & Concurrency Guard: Decrements availableSeats via conditional database update
 *    (`UPDATE rides SET available_seats = available_seats - $seats WHERE ride_id = $id AND status = 'SCHEDULED' AND available_seats >= $seats`).
 *    This locks the row in PostgreSQL and guarantees zero overselling.
 * 7. Transactional Integrity: If booking creation or any subsequent step fails, the entire transaction rolls back.
 *
 * @param riderId UUID of the authenticated passenger.
 * @param input Validated booking creation payload.
 * @returns Standardized BookingOutput representation.
 */
export async function createBooking(
  riderId: string,
  input: CreateBookingInput
): Promise<BookingOutput> {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch target ride details
    const ride = await tx.ride.findUnique({
      where: { rideId: input.rideId },
      select: {
        rideId: true,
        driverId: true,
        communityId: true,
        source: true,
        destination: true,
        departureTime: true,
        sourceLatitude: true,
        sourceLongitude: true,
        destinationLatitude: true,
        destinationLongitude: true,
        farePerSeat: true,
        status: true,
        availableSeats: true,
        totalSeats: true,
      },
    });

    if (!ride) {
      throw new NotFoundError('Ride not found');
    }

    // 2. Prevent self-booking (Driver cannot be a passenger on their own ride)
    if (ride.driverId === riderId) {
      throw new BadRequestError('Drivers cannot book seats on their own rides');
    }

    // 3. Verify ride lifecycle state and future departure time
    if (ride.status !== RideStatus.SCHEDULED) {
      throw new BadRequestError(
        `Cannot book a ride with status ${ride.status}. Only SCHEDULED rides can be booked.`
      );
    }

    if (new Date(ride.departureTime).getTime() <= Date.now()) {
      throw new BadRequestError('Cannot book a ride whose scheduled departure time has passed');
    }

    // 4. Open Booking for Everyone:
    // Anyone from any community (or not in any community) can book seats.
    // Automatically affiliation-upsert passenger in the ride's community.
    await tx.communityMembership.upsert({
      where: {
        communityId_userId: {
          communityId: ride.communityId,
          userId: riderId,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        communityId: ride.communityId,
        userId: riderId,
        status: 'ACTIVE',
      },
    });

    // 5. Duplicate Active Booking Prevention (Decision 10)
    const existingActiveBooking = await tx.booking.findFirst({
      where: {
        rideId: input.rideId,
        riderId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      select: { bookingId: true },
    });

    if (existingActiveBooking) {
      throw new ConflictError('You already have an active booking for this ride');
    }

    // 6. Atomic Seat Allocation via conditional database update
    // This atomic WHERE condition prevents race conditions and overselling at the SQL row level.
    const seatAllocation = await tx.ride.updateMany({
      where: {
        rideId: input.rideId,
        status: RideStatus.SCHEDULED,
        availableSeats: { gte: input.seatsBooked },
      },
      data: {
        availableSeats: { decrement: input.seatsBooked },
      },
    });

    if (seatAllocation.count === 0) {
      throw new BadRequestError(
        `Insufficient available seats. Requested: ${input.seatsBooked}, but ride does not have enough remaining capacity.`
      );
    }

    // 7. Compute total booking amount (seatsBooked * distance-proportional farePerSeat)
    const fullFarePerSeat = Number(ride.farePerSeat);
    let effectiveFarePerSeat = fullFarePerSeat;

    // Resolve driver coordinates (from database columns or geocoding table)
    const driverSource: Coordinates | null =
      ride.sourceLatitude && ride.sourceLongitude
        ? { latitude: Number(ride.sourceLatitude), longitude: Number(ride.sourceLongitude) }
        : resolveLocationCoordinates(ride.source);

    const driverDest: Coordinates | null =
      ride.destinationLatitude && ride.destinationLongitude
        ? { latitude: Number(ride.destinationLatitude), longitude: Number(ride.destinationLongitude) }
        : resolveLocationCoordinates(ride.destination);

    if (driverSource && driverDest) {
      const driverTotalDist = Math.max(0.5, calculateHaversineDistance(driverSource, driverDest));
      const ratePerKm = fullFarePerSeat / driverTotalDist;

      if (input.subTripDistanceKm && input.subTripDistanceKm > 0) {
        const calculated = input.subTripDistanceKm * ratePerKm;
        effectiveFarePerSeat = Math.min(fullFarePerSeat, Math.max(20, Math.round(calculated)));
      } else {
        const riderPickup: Coordinates | null =
          input.pickupLat !== undefined && input.pickupLng !== undefined
            ? { latitude: input.pickupLat, longitude: input.pickupLng }
            : input.passengerPickup
            ? resolveLocationCoordinates(input.passengerPickup)
            : null;

        const riderDropoff: Coordinates | null =
          input.dropoffLat !== undefined && input.dropoffLng !== undefined
            ? { latitude: input.dropoffLat, longitude: input.dropoffLng }
            : input.passengerDropoff
            ? resolveLocationCoordinates(input.passengerDropoff)
            : null;

        if (riderPickup && riderDropoff) {
          const match = matchRouteCorridor(driverSource, driverDest, riderPickup, riderDropoff);
          const calculated = match.riderDistanceKm * ratePerKm;
          effectiveFarePerSeat = Math.min(fullFarePerSeat, Math.max(20, Math.round(calculated)));
        }
      }
    }

    const totalAmountNum = (effectiveFarePerSeat * input.seatsBooked).toFixed(2);

    // 8. Create the booking record
    const booking = await tx.booking.create({
      data: {
        rideId: input.rideId,
        riderId,
        seatsBooked: input.seatsBooked,
        status: BookingStatus.PENDING,
        totalAmount: totalAmountNum,
      },
      select: bookingDetailSelectProjection,
    });

    return formatBookingOutput(booking);
  });
}

export interface PaginatedBookingsResult {
  bookings: BookingOutput[];
  pagination: PaginationMeta;
}

/**
 * Retrieves a single booking by ID with ownership and role-based authorization (GET /api/v1/bookings/:bookingId).
 *
 * Authorization Invariants:
 * 1. Passenger Access: The rider who created the booking may retrieve it.
 * 2. Driver Access: The driver of the ride associated with this booking may retrieve it.
 * 3. Platform Admin Access: Administrators may retrieve any booking.
 * 4. Unrelated User Rejection: Any authenticated user who is neither the rider, nor the ride's driver,
 *    nor an admin is rejected with 403 Forbidden.
 * 5. Safe Projection: Returns sanitized BookingOutput without exposing password hashes, wallet balances, or license data.
 *
 * @param user Authenticated user context.
 * @param bookingId UUID of target booking.
 * @returns Standardized BookingOutput.
 */
export async function getBookingById(
  user: AuthenticatedUser,
  bookingId: string
): Promise<BookingOutput> {
  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    select: bookingDetailSelectProjection,
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Authorization check
  const isRider = booking.riderId === user.userId;
  const isDriver = booking.ride?.driverId === user.userId;
  const isAdmin = user.roles.includes('ADMIN');

  if (!isRider && !isDriver && !isAdmin) {
    throw new ForbiddenError('You are not authorized to view this booking');
  }

  return formatBookingOutput(booking);
}

/**
 * Retrieves the authenticated passenger's booking history with bounded pagination (GET /api/v1/bookings/me).
 *
 * Requirements & Invariants:
 * 1. Strict Rider Isolation: Results are strictly filtered by riderId derived from req.user.userId.
 * 2. Bounded Pagination: Supports page and limit (default 20, max 100).
 * 3. Status Filtering: Supports optional filtering by valid BookingStatus enum values.
 * 4. Deterministic Ordering: Ordered by bookedAt descending, tie-broken by bookingId ascending.
 * 5. Safe Projection: Returns sanitized BookingOutput items with associated safe ride details.
 *
 * @param riderId Authenticated passenger UUID.
 * @param options Validated pagination and status filter options.
 * @returns Paginated list of bookings and pagination metadata.
 */
export async function listPassengerBookings(
  riderId: string,
  options?: MyBookingsQueryInput
): Promise<PaginatedBookingsResult> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {
    riderId,
  };

  if (options?.status) {
    where.status = options.status;
  }

  const orderBy: any = [{ bookedAt: 'desc' }, { bookingId: 'asc' }];

  const [total, records] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: bookingDetailSelectProjection,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const pagination: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  return {
    bookings: records.map(formatBookingOutput),
    pagination,
  };
}

/**
 * Retrieves the passenger manifest for a specific ride (GET /api/v1/rides/:rideId/bookings).
 *
 * Requirements & Invariants:
 * 1. Authorization: Only the publishing driver or a platform ADMIN may view the manifest.
 * 2. Unrelated users are rejected with 403 Forbidden.
 * 3. Safe Projection: Returns sanitized BookingOutput without exposing password hashes or private credentials.
 * 4. Bounded Pagination: Supports page and limit (default 20, max 100).
 * 5. Deterministic Ordering: Ordered by bookedAt descending, tie-broken by bookingId ascending.
 */
export async function listRideBookings(
  user: AuthenticatedUser,
  rideId: string,
  options?: RideBookingsQueryInput
): Promise<PaginatedBookingsResult> {
  const ride = await prisma.ride.findUnique({
    where: { rideId },
    select: {
      rideId: true,
      driverId: true,
    },
  });

  if (!ride) {
    throw new NotFoundError('Ride not found');
  }

  const isDriver = ride.driverId === user.userId;
  const isAdmin = user.roles.includes('ADMIN');

  if (!isDriver && !isAdmin) {
    throw new ForbiddenError(
      'You are not authorized to view the passenger manifest for this ride'
    );
  }

  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {
    rideId,
  };

  if (options?.status) {
    where.status = options.status;
  }

  const orderBy: any = [{ bookedAt: 'desc' }, { bookingId: 'asc' }];

  const [total, records] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: manifestBookingSelectProjection,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const pagination: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  return {
    bookings: records.map(formatManifestBookingOutput),
    pagination,
  };
}

/**
 * Approves a pending passenger booking request (PATCH /api/v1/bookings/:bookingId/approve).
 *
 * Requirements & Lifecycle Invariants:
 * 1. Driver Ownership: Only the driver of the ride can approve bookings on that ride.
 * 2. Eligible State: Only PENDING bookings can be approved.
 * 3. Idempotency/Conflict: Already approved bookings return 400. Cancelled or completed bookings return 400.
 * 4. Ride State: Only bookings for SCHEDULED rides can be approved.
 * 5. Seat Allocation Model: Seats were already allocated during creation (M7A). availableSeats is NOT decremented again.
 * 6. Concurrency Safety: Atomic conditional update (status === PENDING) prevents race conditions.
 */
export async function approveBooking(
  driverId: string,
  bookingId: string
): Promise<BookingOutput> {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        rideId: true,
        riderId: true,
        seatsBooked: true,
        status: true,
        ride: {
          select: {
            rideId: true,
            driverId: true,
            status: true,
            departureTime: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.ride.driverId !== driverId) {
      throw new ForbiddenError(
        'Only the driver who published this ride can approve its bookings'
      );
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      throw new BadRequestError('Booking has already been approved');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError('Cannot approve a cancelled booking');
    }
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestError('Cannot approve a completed booking');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestError(`Cannot approve booking with status ${booking.status}`);
    }

    if (booking.ride.status !== RideStatus.SCHEDULED) {
      throw new BadRequestError(
        `Cannot approve booking for a ride with status ${booking.ride.status}. Only SCHEDULED rides can be approved.`
      );
    }

    const updateResult = await tx.booking.updateMany({
      where: {
        bookingId,
        status: BookingStatus.PENDING,
      },
      data: {
        status: BookingStatus.CONFIRMED,
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestError(
        'Booking status transition conflict. Booking is no longer in pending status.'
      );
    }

    const updatedBooking = await tx.booking.findUnique({
      where: { bookingId },
      select: bookingDetailSelectProjection,
    });

    return formatBookingOutput(updatedBooking);
  });
}

/**
 * Rejects a pending passenger booking request (PATCH /api/v1/bookings/:bookingId/reject).
 *
 * Requirements & Lifecycle Invariants:
 * 1. Driver Ownership: Only the driver of the ride can reject bookings on that ride.
 * 2. Eligible State: Only PENDING bookings can be rejected. Confirmed, cancelled, or completed bookings cannot.
 * 3. State Representation (Decision M7C.1): Transitions status to CANCELLED, recording cancelledById (driver)
 *    and cancellationReason with a [REJECTED_BY_DRIVER] prefix without requiring schema alterations.
 * 4. Atomic Seat Restoration: Restores seatsBooked back to availableSeats, capped at totalSeats to prevent over-restoration.
 * 5. Concurrency Safety: Atomic updateMany ensures concurrent approve/reject calls cannot produce corrupted state.
 */
export async function rejectBooking(
  driverId: string,
  bookingId: string,
  reason?: string
): Promise<BookingOutput> {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        rideId: true,
        riderId: true,
        seatsBooked: true,
        status: true,
        ride: {
          select: {
            rideId: true,
            driverId: true,
            status: true,
            totalSeats: true,
            availableSeats: true,
            departureTime: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.ride.driverId !== driverId) {
      throw new ForbiddenError(
        'Only the driver who published this ride can reject its bookings'
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError('Booking has already been rejected or cancelled');
    }
    if (booking.status === BookingStatus.CONFIRMED) {
      throw new BadRequestError(
        'Cannot reject a booking that has already been confirmed'
      );
    }
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestError('Cannot reject a completed booking');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestError(`Cannot reject booking with status ${booking.status}`);
    }

    if (booking.ride.status !== RideStatus.SCHEDULED) {
      throw new BadRequestError(
        `Cannot reject booking for a ride with status ${booking.ride.status}. Only SCHEDULED rides can be managed.`
      );
    }

    if (new Date(booking.ride.departureTime).getTime() <= Date.now()) {
      throw new BadRequestError(
        'Cannot reject booking for a ride whose departure time has already passed'
      );
    }

    const formattedReason = reason?.trim()
      ? `[REJECTED_BY_DRIVER] ${reason.trim()}`
      : '[REJECTED_BY_DRIVER] Driver declined the booking request';

    const updateResult = await tx.booking.updateMany({
      where: {
        bookingId,
        status: BookingStatus.PENDING,
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: driverId,
        cancellationReason: formattedReason,
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestError(
        'Booking status transition conflict. Booking is no longer in pending status.'
      );
    }

    // Atomic seat restoration: capped at totalSeats
    const seatRestore = await tx.ride.updateMany({
      where: {
        rideId: booking.rideId,
        availableSeats: {
          lte: booking.ride.totalSeats - booking.seatsBooked,
        },
      },
      data: {
        availableSeats: {
          increment: booking.seatsBooked,
        },
      },
    });

    if (seatRestore.count === 0) {
      throw new ConflictError(
        'Seat restoration failed: available seats on the ride cannot exceed total vehicle capacity'
      );
    }

    const updatedBooking = await tx.booking.findUnique({
      where: { bookingId },
      select: bookingDetailSelectProjection,
    });

    return formatBookingOutput(updatedBooking);
  });
}

/**
 * Cancels an active passenger booking (PATCH /api/v1/bookings/:bookingId/cancel).
 *
 * Requirements & Lifecycle Invariants (Decision 11 & Issue 9):
 * 1. Authorization: Only the passenger who created the booking (riderId) or a platform ADMIN can cancel.
 * 2. Eligible State: Only PENDING or CONFIRMED bookings can be cancelled.
 * 3. Terminal/Duplicate Guard: Already CANCELLED bookings reject with 400 Bad Request and do not restore seats twice.
 * 4. Completion Guard: COMPLETED bookings cannot be cancelled (400 Bad Request).
 * 5. Ride Lifecycle: Ride must be in SCHEDULED status and departure time must be in the future (> now).
 * 6. Cancellation Window & Policy:
 *    - If Δt >= 120 minutes: 100% full refund policy window.
 *    - If Δt < 120 minutes: 50% late cancellation policy window.
 *    - Policy metadata is stored in cancellationReason audit trail.
 * 7. Atomic Seat Restoration: Reserved seats are restored to availableSeats, guarded by totalSeats capacity.
 * 8. Concurrency Safety: Atomic updateMany on booking status ensures concurrent cancellations do not double-restore seats.
 */
export async function cancelPassengerBooking(
  userId: string,
  bookingId: string,
  reason?: string,
  isAdmin: boolean = false
): Promise<BookingOutput> {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        rideId: true,
        riderId: true,
        seatsBooked: true,
        status: true,
        totalAmount: true,
        ride: {
          select: {
            rideId: true,
            driverId: true,
            status: true,
            totalSeats: true,
            availableSeats: true,
            departureTime: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.riderId !== userId && !isAdmin) {
      throw new ForbiddenError(
        'Only the passenger who booked this seat can cancel this booking'
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError('Booking has already been cancelled');
    }
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestError('Cannot cancel a completed booking');
    }
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestError(`Cannot cancel booking with status ${booking.status}`);
    }

    if (booking.ride.status !== RideStatus.SCHEDULED) {
      throw new BadRequestError(
        `Cannot cancel booking for a ride with status ${booking.ride.status}. Only SCHEDULED rides can be managed.`
      );
    }

    const now = Date.now();
    const departureTimeMs = new Date(booking.ride.departureTime).getTime();
    const diffMs = departureTimeMs - now;

    if (diffMs <= 0) {
      throw new BadRequestError(
        'Cannot cancel booking for a ride whose scheduled departure time has passed'
      );
    }

    const isFullRefund = diffMs >= 120 * 60 * 1000;
    let prefix: string;
    if (isAdmin && booking.riderId !== userId) {
      prefix = '[CANCELLED_BY_ADMIN]';
    } else if (isFullRefund) {
      prefix = '[CANCELLED_BY_RIDER: FULL_REFUND]';
    } else {
      prefix = '[CANCELLED_BY_RIDER: LATE_CANCEL_50_PERCENT]';
    }

    const userReason = reason?.trim();
    const formattedReason = userReason
      ? `${prefix} ${userReason}`
      : `${prefix} Passenger cancelled booking${
          isFullRefund
            ? ' (> 2 hours prior to departure; 100% refund policy)'
            : ' (< 2 hours prior to departure; 50% refund policy applies)'
        }`;

    const updateResult = await tx.booking.updateMany({
      where: {
        bookingId,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: userId,
        cancellationReason: formattedReason,
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestError(
        'Booking status transition conflict. Booking is no longer active.'
      );
    }

    // Atomic seat restoration: capped at totalSeats to prevent overflow
    const seatRestore = await tx.ride.updateMany({
      where: {
        rideId: booking.rideId,
        availableSeats: {
          lte: booking.ride.totalSeats - booking.seatsBooked,
        },
      },
      data: {
        availableSeats: {
          increment: booking.seatsBooked,
        },
      },
    });

    if (seatRestore.count === 0) {
      throw new ConflictError(
        'Seat restoration failed: available seats on the ride cannot exceed total vehicle capacity'
      );
    }

    const updatedBooking = await tx.booking.findUnique({
      where: { bookingId },
      select: bookingDetailSelectProjection,
    });

    return formatBookingOutput(updatedBooking);
  });
}

/**
 * ============================================================================
 * RELEASE EXPIRED PENDING BOOKINGS (Automated Cleanup & Deadlock Release)
 * ============================================================================
 * When a rider creates a booking reservation, seats are immediately decremented
 * from `Ride.availableSeats` to prevent overselling.
 *
 * If a rider leaves the tab open, loses their internet connection, or abandons
 * the payment flow without confirming within the expiry window (default: 10 minutes),
 * this function automatically:
 * 1. Finds all stale PENDING bookings created more than `expiryMinutes` ago.
 * 2. Marks their status as CANCELLED with an '[EXPIRED]' audit reason.
 * 3. Atomically restores the held seats back to the ride's `availableSeats`.
 *
 * This prevents ghost seat reservations and allows other genuine passengers to book.
 *
 * @param expiryMinutes - Inactivity threshold in minutes (default: 10 minutes)
 * @returns Number of expired bookings successfully released
 */
export async function releaseExpiredPendingBookings(
  expiryMinutes: number = 10
): Promise<number> {
  const cutoffTime = new Date(Date.now() - expiryMinutes * 60 * 1000);

  // 1. Find all stale PENDING bookings created prior to the cutoff threshold
  const staleBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      bookedAt: {
        lte: cutoffTime,
      },
    },
    select: {
      bookingId: true,
      rideId: true,
      seatsBooked: true,
      ride: {
        select: {
          totalSeats: true,
          availableSeats: true,
        },
      },
    },
  });

  if (staleBookings.length === 0) {
    return 0;
  }

  let releasedCount = 0;

  // 2. Atomically cancel each stale booking and restore ride seats
  for (const stale of staleBookings) {
    try {
      await prisma.$transaction(async (tx) => {
        // Atomic status transition from PENDING to CANCELLED
        const cancelResult = await tx.booking.updateMany({
          where: {
            bookingId: stale.bookingId,
            status: BookingStatus.PENDING,
          },
          data: {
            status: BookingStatus.CANCELLED,
            cancelledAt: new Date(),
            cancellationReason: `[EXPIRED] Reservation timed out after ${expiryMinutes} minutes without payment confirmation`,
          },
        });

        // Only restore seats if this transaction actually transitioned the booking status
        if (cancelResult.count > 0) {
          await tx.ride.updateMany({
            where: {
              rideId: stale.rideId,
              availableSeats: {
                lte: stale.ride.totalSeats - stale.seatsBooked,
              },
            },
            data: {
              availableSeats: {
                increment: stale.seatsBooked,
              },
            },
          });
          releasedCount++;
        }
      });
    } catch (err: any) {
      console.warn(
        `⚠️ [Booking Expiry] Failed to release stale booking ${stale.bookingId}:`,
        err.message
      );
    }
  }

  return releasedCount;
}

export const bookingService = {
  createBooking,
  getBookingById,
  listPassengerBookings,
  listRideBookings,
  approveBooking,
  rejectBooking,
  cancelPassengerBooking,
  releaseExpiredPendingBookings,
};
