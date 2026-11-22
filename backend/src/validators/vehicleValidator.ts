import { z } from 'zod';

/**
 * Universal UUID regex (case-insensitive 8-4-4-4-12 hex format).
 * Matches PostgreSQL's native UUID representation.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permitted vehicle categories for carpooling operations.
 */
export const VEHICLE_TYPES = [
  'CAR',
  'BIKE',
  'SEDAN',
  'HATCHBACK',
  'SUV',
  'VAN',
  'OTHER',
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

/**
 * Validation schema for registering a new vehicle (POST /api/v1/vehicles).
 *
 * Rules:
 * - vehicleType: Must be one of the permitted categories; normalized to uppercase.
 * - make: Non-empty string, max 80 characters.
 * - model: Non-empty string, max 80 characters.
 * - registrationNumber: Non-empty string, max 30 characters; trimmed and uppercased.
 * - seatCapacity: Integer between 1 and 8 (passenger-only capacity).
 * - color: Optional, max 40 characters; trimmed and nullified if empty.
 * - strict: Rejects system-managed fields (vehicleId, driverId, isActive, createdAt, updatedAt).
 */
export const createVehicleSchema = z
  .object({
    vehicleType: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
      z.enum(VEHICLE_TYPES, {
        message: `Invalid vehicle type. Allowed types: ${VEHICLE_TYPES.join(', ')}`,
      })
    ),
    make: z
      .string({ message: 'Vehicle make is required' })
      .trim()
      .min(1, 'Vehicle make is required')
      .max(80, 'Vehicle make must not exceed 80 characters'),
    model: z
      .string({ message: 'Vehicle model is required' })
      .trim()
      .min(1, 'Vehicle model is required')
      .max(80, 'Vehicle model must not exceed 80 characters'),
    registrationNumber: z
      .string({ message: 'Registration number is required' })
      .trim()
      .min(1, 'Registration number is required')
      .max(30, 'Registration number must not exceed 30 characters')
      .transform((val) => val.toUpperCase()),
    seatCapacity: z
      .number({ message: 'Seat capacity must be a valid number' })
      .int('Seat capacity must be an integer')
      .min(1, 'Seat capacity must be at least 1')
      .max(8, 'Seat capacity must not exceed 8'),
    color: z
      .string()
      .trim()
      .max(40, 'Color must not exceed 40 characters')
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val && val.trim() ? val.trim() : null)),
  })
  .strict();

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

/**
 * Validation schema for updating a vehicle (PATCH /api/v1/vehicles/:vehicleId).
 *
 * Rules:
 * - Permitted fields: make, model, color, isActive.
 * - At least one field must be provided.
 * - Disallows changing registrationNumber, vehicleType, vehicleId, or driverId.
 * - strict: Rejects unknown / unauthorized fields.
 */
export const updateVehicleSchema = z
  .object({
    make: z
      .string()
      .trim()
      .min(1, 'Vehicle make cannot be empty')
      .max(80, 'Vehicle make must not exceed 80 characters')
      .optional(),
    model: z
      .string()
      .trim()
      .min(1, 'Vehicle model cannot be empty')
      .max(80, 'Vehicle model must not exceed 80 characters')
      .optional(),
    color: z
      .string()
      .trim()
      .max(40, 'Color must not exceed 40 characters')
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? undefined : val && val.trim() ? val.trim() : null)),
    isActive: z
      .boolean({ message: 'isActive must be a boolean' })
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.make !== undefined ||
      data.model !== undefined ||
      data.color !== undefined ||
      data.isActive !== undefined,
    { message: 'At least one field (make, model, color, or isActive) must be provided for update' }
  );

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

/**
 * Validation schema for routes containing vehicleId parameter (e.g. /:vehicleId).
 */
export const vehicleIdParamSchema = z
  .object({
    vehicleId: z
      .string({ message: 'Vehicle ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Invalid vehicle ID format. Must be a valid UUID'),
  })
  .strict();

export type VehicleIdParam = z.infer<typeof vehicleIdParamSchema>;

/**
 * Validation schema for listing vehicles with pagination and status filtering (GET /api/v1/vehicles/me).
 *
 * Rules:
 * - page: Positive integer, defaults to 1.
 * - limit: Integer between 1 and 100, defaults to 20.
 * - isActive: Optional boolean filter.
 * - includeInactive: Optional boolean filter.
 * - strict: Rejects unexpected query parameters (such as client-supplied driverId).
 */
export const vehicleQuerySchema = z
  .object({
    page: z.coerce
      .number({ message: 'Page must be a valid number' })
      .int('Page must be an integer')
      .positive('Page must be greater than 0')
      .default(1),
    limit: z.coerce
      .number({ message: 'Limit must be a valid number' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .default(20),
    isActive: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          const lower = val.trim().toLowerCase();
          if (lower === 'true') return true;
          if (lower === 'false') return false;
        }
        return val;
      }, z.boolean({ message: 'isActive must be a boolean' }).optional())
      .optional(),
    includeInactive: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          const lower = val.trim().toLowerCase();
          if (lower === 'true') return true;
          if (lower === 'false') return false;
        }
        return val;
      }, z.boolean({ message: 'includeInactive must be a boolean' }).optional())
      .optional(),
  })
  .strict();

export type VehicleQueryInput = z.infer<typeof vehicleQuerySchema>;
