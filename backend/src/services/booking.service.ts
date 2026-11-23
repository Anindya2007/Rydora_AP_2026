import { prisma } from '../config/prisma.js';
import { BookingStatus, RideStatus } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../middleware/auth.js';
import type { PaginationMeta } from '../utils/response.js';
import type {
  CreateBookingInput,
  MyBookingsQueryInput,
} from '../validators/bookingValidator.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';

export interface BookingRiderSummary {
  userId: string;
  name: string;
  email: string;
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
    },
  },
};

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

    // 4. Strict Community Silo (Decision 07): Verify active passenger membership
    const membership = await tx.communityMembership.findUnique({
      where: {
        communityId_userId: {
          communityId: ride.communityId,
          userId: riderId,
        },
      },
      select: { status: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError(
        'You must be an active member of this community to book a ride'
      );
    }

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

    // 7. Compute total booking amount (seatsBooked * farePerSeat)
    const farePerSeatNum = Number(ride.farePerSeat);
    const totalAmountNum = (farePerSeatNum * input.seatsBooked).toFixed(2);

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

export const bookingService = {
  createBooking,
  getBookingById,
  listPassengerBookings,
};
