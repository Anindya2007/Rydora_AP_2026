import { z } from 'zod';

/**
 * Validation schema for updating user profile (PATCH /api/v1/users/me).
 * Strictly restricts updates to only permitted fields: name, phone, profileImage.
 * Explicitly rejects attempts to inject protected/privilege fields.
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name must not exceed 100 characters')
      .optional(),
    phone: z
      .string()
      .trim()
      .min(10, 'Phone number must be at least 10 characters')
      .max(20, 'Phone number must not exceed 20 characters')
      .regex(/^\+?[0-9\s-]{10,20}$/, 'Invalid phone number format')
      .nullable()
      .optional(),
    profileImage: z
      .string()
      .trim()
      .url('Profile image must be a valid URL')
      .max(500, 'Profile image URL must not exceed 500 characters')
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.phone !== undefined ||
      data.profileImage !== undefined,
    { message: 'At least one field (name, phone, or profileImage) must be provided for update' }
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Universal UUID regex (case-insensitive 8-4-4-4-12 hex format).
 * Matches PostgreSQL native UUID representation.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validation schema for submitting driver licence verification (POST /api/v1/users/driver-verification).
 *
 * Rules:
 * - licenseNumber: Required non-empty string, min 5, max 60 characters, trimmed and uppercase normalized.
 * - licenseExpiry: Required date string or ISO-8601, parsed to Date and must be in the future.
 * - strict: Rejects client-supplied driverVerified, roles, or unknown fields.
 */
export const driverVerificationSubmissionSchema = z
  .object({
    licenseNumber: z
      .string({ message: 'Driving licence number is required' })
      .trim()
      .min(5, 'Driving licence number must be at least 5 characters')
      .max(60, 'Driving licence number must not exceed 60 characters')
      .regex(/^[A-Z0-9\s-]{5,60}$/i, 'Driving licence number contains invalid characters')
      .transform((val) => val.toUpperCase()),
    licenseExpiry: z
      .union([
        z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: 'Invalid licence expiry date format',
        }),
        z.date().refine((d) => !isNaN(d.getTime()), {
          message: 'Invalid licence expiry date format',
        }),
      ])
      .transform((val) => (typeof val === 'string' ? new Date(val) : val))
      .refine(
        (date) => date.getTime() > Date.now(),
        { message: 'Driving licence has expired or expiry date is in the past' }
      ),
  })
  .strict();

export type DriverVerificationSubmissionInput = z.infer<
  typeof driverVerificationSubmissionSchema
>;

/**
 * Validation schema for validating userId route parameter.
 */
export const userIdParamSchema = z
  .object({
    userId: z
      .string({ message: 'User ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Invalid user ID format. Must be a valid UUID'),
  })
  .strict();

export type UserIdParamInput = z.infer<typeof userIdParamSchema>;

/**
 * Validation schema for querying pending verifications list.
 */
export const pendingVerificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'Limit cannot exceed 100').default(20),
  })
  .strict();

export type PendingVerificationsQueryInput = z.infer<
  typeof pendingVerificationsQuerySchema
>;
