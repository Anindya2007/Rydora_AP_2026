import { z } from 'zod';

/**
 * Universal UUID regex (case-insensitive 8-4-4-4-12 hex format).
 * Matches PostgreSQL's native UUID representation.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validation schema for creating a new booking (POST /api/v1/bookings).
 *
 * Rules:
 * - rideId: Required, valid UUID string.
 * - seatsBooked: Required integer between 1 and 4 (Decision 10).
 * - strict: Rejects client attempts to inject riderId, passengerId, status,
 *   bookingId, totalAmount, or system timestamps.
 */
export const createBookingSchema = z
  .object({
    rideId: z
      .string({ message: 'Ride ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Ride ID must be a valid UUID'),
    seatsBooked: z.coerce
      .number({ message: 'Seats booked must be a valid number' })
      .int('Seats booked must be an integer')
      .min(1, 'At least 1 seat must be booked')
      .max(4, 'Cannot book more than 4 seats in a single reservation'),
  })
  .strict();

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Validation schema for endpoints addressing bookings by UUID (e.g. /:bookingId).
 */
export const bookingIdParamSchema = z
  .object({
    bookingId: z
      .string({ message: 'Booking ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Booking ID must be a valid UUID'),
  })
  .strict();

export type BookingIdParam = z.infer<typeof bookingIdParamSchema>;
