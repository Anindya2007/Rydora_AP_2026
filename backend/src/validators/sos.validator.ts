import { z } from 'zod';
import { SOSAlertStatus } from '../generated/prisma/client.js';

/**
 * UUID v4 / PostgreSQL standard regex (case-insensitive).
 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Schema for activating an SOS emergency alert.
 *
 * Rules:
 * 1. rideId: Optional UUID. If specified, user must be a participant on this ride.
 * 2. message: Optional emergency message, max 1000 characters.
 * 3. latitude: Optional coordinate [-90, 90].
 * 4. longitude: Optional coordinate [-180, 180].
 * 5. Strict mode prevents unexpected or malicious fields.
 */
export const createSOSAlertSchema = z
  .object({
    rideId: z
      .string({ message: 'Ride ID must be a string' })
      .regex(UUID_REGEX, 'Invalid ride ID format. Expected UUID')
      .nullable()
      .optional(),
    message: z
      .string({ message: 'Message must be a string' })
      .trim()
      .max(1000, 'Message cannot exceed 1000 characters')
      .nullable()
      .optional(),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  })
  .strict();

export type CreateSOSAlertInput = z.infer<typeof createSOSAlertSchema>;

/**
 * Schema for alertId route parameter.
 */
export const alertIdParamSchema = z
  .object({
    alertId: z
      .string({ message: 'Alert ID is required' })
      .regex(UUID_REGEX, 'Invalid alert ID format. Expected UUID'),
  })
  .strict();

export type AlertIdParamInput = z.infer<typeof alertIdParamSchema>;

/**
 * Schema for listing SOS alerts with pagination and optional status filter.
 */
export const listSOSAlertsQuerySchema = z
  .object({
    status: z.nativeEnum(SOSAlertStatus).optional(),
    page: z.preprocess(
      (val) => (val ? Number(val) : 1),
      z.number().int().min(1, 'Page must be at least 1').default(1)
    ),
    limit: z.preprocess(
      (val) => (val ? Number(val) : 10),
      z.number().int().min(1, 'Limit must be at least 1').max(50, 'Limit cannot exceed 50').default(10)
    ),
  })
  .strict();

export type ListSOSAlertsQueryInput = z.infer<typeof listSOSAlertsQuerySchema>;

/**
 * Schema for resolving an SOS alert with optional notes.
 */
export const resolveSOSAlertSchema = z
  .object({
    notes: z
      .string({ message: 'Notes must be a string' })
      .trim()
      .max(500, 'Notes cannot exceed 500 characters')
      .nullable()
      .optional(),
  })
  .strict();

export type ResolveSOSAlertInput = z.infer<typeof resolveSOSAlertSchema>;
