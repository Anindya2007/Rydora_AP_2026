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
