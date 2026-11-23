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
      .string({ message: 'Community ID must be a string' })
      .trim()
      .regex(UUID_REGEX, 'Community ID must be a valid UUID')
      .nullable()
      .optional(),
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
        (date) => date.getTime() > Date.now() - 60000,
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
 *
 * Supported Filters:
 * - communityId: Filter rides belonging to a specific community (UUID format).
 * - source: Case-insensitive search on origin/departure location.
 * - destination: Case-insensitive search on destination location.
 * - status: Filter by RideStatus (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED).
 * - date: Filter rides departing on a single calendar day (YYYY-MM-DD).
 * - startDate / endDate: Filter rides departing within a date/time range.
 * - availableSeats / minSeats: Filter rides offering at least N seats.
 * - vehicleType: Filter by vehicle category (e.g. SEDAN, SUV).
 * - sortBy: Sort by departureTime, farePerSeat, availableSeats, or createdAt.
 * - sortOrder: asc or desc.
 * - page & limit: Bounded pagination (limit max 100).
 */
export const rideQuerySchema = z
  .object({
    page: z.coerce
      .number({ message: 'Page must be a valid number' })
      .int('Page must be an integer')
      .positive('Page must be greater than zero')
      .default(1),
    limit: z.coerce
      .number({ message: 'Limit must be a valid number' })
      .int('Limit must be an integer')
      .positive('Limit must be greater than zero')
      .max(100, 'Limit must not exceed 100')
      .default(20),
    communityId: z
      .string({ message: 'Community ID must be a string' })
      .trim()
      .regex(UUID_REGEX, 'Community ID must be a valid UUID')
      .optional(),
    source: z
      .string({ message: 'Source must be a string' })
      .trim()
      .min(1, 'Source filter cannot be empty')
      .max(255, 'Source filter must not exceed 255 characters')
      .optional(),
    destination: z
      .string({ message: 'Destination must be a string' })
      .trim()
      .min(1, 'Destination filter cannot be empty')
      .max(255, 'Destination filter must not exceed 255 characters')
      .optional(),
    status: z
      .enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
        message: 'Status must be one of: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED',
      })
      .optional(),
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
      .optional(),
    startDate: z
      .string()
      .trim()
      .refine(
        (val) =>
          /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(val) &&
          !isNaN(Date.parse(val)),
        'Start date must be a valid YYYY-MM-DD date or ISO 8601 datetime'
      )
      .optional(),
    endDate: z
      .string()
      .trim()
      .refine(
        (val) =>
          /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(val) &&
          !isNaN(Date.parse(val)),
        'End date must be a valid YYYY-MM-DD date or ISO 8601 datetime'
      )
      .optional(),
    availableSeats: z.coerce
      .number({ message: 'Available seats must be a valid number' })
      .int('Available seats must be an integer')
      .min(1, 'Available seats must be at least 1')
      .max(8, 'Available seats must not exceed 8')
      .optional(),
    minSeats: z.coerce
      .number({ message: 'Minimum seats must be a valid number' })
      .int('Minimum seats must be an integer')
      .min(1, 'Minimum seats must be at least 1')
      .max(8, 'Minimum seats must not exceed 8')
      .optional(),
    vehicleType: z
      .string()
      .trim()
      .min(1, 'Vehicle type filter cannot be empty')
      .max(50, 'Vehicle type must not exceed 50 characters')
      .optional(),
    sortBy: z
      .enum(['departureTime', 'farePerSeat', 'availableSeats', 'createdAt'], {
        message: 'Sort field must be one of: departureTime, farePerSeat, availableSeats, createdAt',
      })
      .default('departureTime'),
    sortOrder: z
      .enum(['asc', 'desc'], {
        message: 'Sort order must be either asc or desc',
      })
      .default('asc'),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate).getTime() <= new Date(data.endDate).getTime();
      }
      return true;
    },
    {
      message: 'Start date must be earlier than or equal to end date',
      path: ['endDate'],
    }
  );

export type RideQueryInput = z.infer<typeof rideQuerySchema>;

/**
 * Validation schema for driver's own published rides query (GET /api/v1/rides/me).
 */
export const driverRidesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    communityId: z.string().trim().regex(UUID_REGEX, 'Community ID must be a valid UUID').optional(),
  })
  .strict();

export type DriverRidesQueryInput = z.infer<typeof driverRidesQuerySchema>;

/**
 * Validation schema for updating an existing ride (PATCH /api/v1/rides/:rideId).
 *
 * Rules:
 * - Permitted fields: vehicleId, source, destination, departureTime, totalSeats, farePerSeat,
 *   sourceLatitude, sourceLongitude, destinationLatitude, destinationLongitude.
 * - Disallowed / Protected fields: rideId, driverId, communityId, status, availableSeats,
 *   createdAt, updatedAt (enforced via .strict()).
 * - At least one field must be provided in the update payload.
 * - departureTime, if supplied, must be in the future.
 * - totalSeats, if supplied, must be an integer between 1 and 8.
 * - farePerSeat, if supplied, must be non-negative (0.00 to 10000.00).
 */
export const updateRideSchema = z
  .object({
    vehicleId: z
      .string({ message: 'Vehicle ID must be a string' })
      .trim()
      .regex(UUID_REGEX, 'Vehicle ID must be a valid UUID')
      .optional(),
    source: z
      .string({ message: 'Source must be a string' })
      .trim()
      .min(1, 'Source location cannot be empty')
      .max(255, 'Source location must not exceed 255 characters')
      .optional(),
    destination: z
      .string({ message: 'Destination must be a string' })
      .trim()
      .min(1, 'Destination location cannot be empty')
      .max(255, 'Destination location must not exceed 255 characters')
      .optional(),
    departureTime: z
      .union([
        z
          .string({ message: 'Departure time must be a string' })
          .datetime({ message: 'Departure time must be a valid ISO 8601 datetime' }),
        z.date({ message: 'Departure time must be a valid date' }),
      ])
      .transform((val) => (val instanceof Date ? val : new Date(val)))
      .refine(
        (date) => date.getTime() > Date.now(),
        'Departure time must be in the future'
      )
      .optional(),
    totalSeats: z
      .number({ message: 'Total seats must be a valid number' })
      .int('Total seats must be an integer')
      .min(1, 'Total seats must be at least 1')
      .max(8, 'Total seats must not exceed 8')
      .optional(),
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
    ).optional(),
    sourceLatitude: latitudeSchema,
    sourceLongitude: longitudeSchema,
    destinationLatitude: latitudeSchema,
    destinationLongitude: longitudeSchema,
  })
  .strict()
  .refine(
    (data) => {
      // Must contain at least one field
      return Object.keys(data).length > 0;
    },
    {
      message: 'At least one editable field must be provided for update',
    }
  )
  .refine(
    (data) => {
      if (data.source && data.destination) {
        return data.source.trim().toLowerCase() !== data.destination.trim().toLowerCase();
      }
      return true;
    },
    {
      message: 'Source and destination cannot be identical',
      path: ['destination'],
    }
  );

export type UpdateRideInput = z.infer<typeof updateRideSchema>;

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
