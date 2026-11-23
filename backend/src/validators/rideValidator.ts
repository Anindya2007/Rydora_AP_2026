import { z } from 'zod';

/**
 * Universal UUID regex (case-insensitive 8-4-4-4-12 hex format).
 * Matches PostgreSQL's native UUID representation.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Coordinate latitude/longitude validation helpers.
 */
const latitudeSchema = z.preprocess(
  (val) => (val === undefined || val === null || val === '' ? null : Number(val)),
  z
    .number({ message: 'Latitude must be a valid number' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .nullable()
    .optional()
);

const longitudeSchema = z.preprocess(
  (val) => (val === undefined || val === null || val === '' ? null : Number(val)),
  z
    .number({ message: 'Longitude must be a valid number' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .nullable()
    .optional()
);

/**
 * Validation schema for publishing a new ride (POST /api/v1/rides).
 *
 * Requirements & Invariants:
 * - communityId: Valid UUID format representing target community.
 * - vehicleId: Valid UUID format representing driver's registered vehicle.
 * - source: Non-empty string, max 255 chars.
 * - destination: Non-empty string, max 255 chars, cannot match source.
 * - departureTime: ISO date/time string in the future.
 * - totalSeats: Integer between 1 and 8 (passenger capacity).
 * - farePerSeat: Non-negative number or decimal string representation (e.g. 0.00 to 10000.00).
 * - sourceLatitude / sourceLongitude: Valid geographic coordinates.
 * - destinationLatitude / destinationLongitude: Valid geographic coordinates.
 * - strict: Rejects system-managed fields (rideId, driverId, status, availableSeats, createdAt, updatedAt).
 */
export const createRideSchema = z
  .object({
    communityId: z
      .string({ message: 'Community ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Community ID must be a valid UUID'),
    vehicleId: z
      .string({ message: 'Vehicle ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Vehicle ID must be a valid UUID'),
    source: z
      .string({ message: 'Source location is required' })
      .trim()
      .min(1, 'Source location is required')
      .max(255, 'Source location must not exceed 255 characters'),
    destination: z
      .string({ message: 'Destination location is required' })
      .trim()
      .min(1, 'Destination location is required')
      .max(255, 'Destination location must not exceed 255 characters'),
    departureTime: z
      .union([
        z
          .string({ message: 'Departure time is required' })
          .datetime({ message: 'Departure time must be a valid ISO 8601 datetime' }),
        z.date({ message: 'Departure time must be a valid date' }),
      ])
      .transform((val) => (val instanceof Date ? val : new Date(val)))
      .refine(
        (date) => date.getTime() > Date.now(),
        'Departure time must be in the future'
      ),
    totalSeats: z
      .number({ message: 'Total seats must be a valid number' })
      .int('Total seats must be an integer')
      .min(1, 'Total seats must be at least 1')
      .max(8, 'Total seats must not exceed 8'),
    farePerSeat: z.preprocess(
      (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string' && val.trim() !== '') return Number(val.trim());
        return val;
      },
      z
        .number({ message: 'Fare per seat must be a valid number' })
        .min(0, 'Fare per seat must be non-negative')
        .max(10000, 'Fare per seat must not exceed 10000.00')
    ),
    sourceLatitude: latitudeSchema,
    sourceLongitude: longitudeSchema,
    destinationLatitude: latitudeSchema,
    destinationLongitude: longitudeSchema,
  })
  .strict()
  .refine(
    (data) => data.source.trim().toLowerCase() !== data.destination.trim().toLowerCase(),
    {
      message: 'Source and destination cannot be identical',
      path: ['destination'],
    }
  );

export type CreateRideInput = z.infer<typeof createRideSchema>;

/**
 * Ride query parameters schema for ride discovery (GET /api/v1/rides).
 */
export const rideQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    communityId: z.string().trim().regex(UUID_REGEX).optional(),
    source: z.string().trim().optional(),
    destination: z.string().trim().optional(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  })
  .strict();

export type RideQueryInput = z.infer<typeof rideQuerySchema>;

/**
 * Parameter schema for endpoints addressing rides by UUID.
 */
export const rideIdParamSchema = z
  .object({
    rideId: z
      .string({ message: 'Ride ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Ride ID must be a valid UUID'),
  })
  .strict();

export type RideIdParam = z.infer<typeof rideIdParamSchema>;
