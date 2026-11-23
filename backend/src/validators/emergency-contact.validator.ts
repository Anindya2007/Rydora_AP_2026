import { z } from 'zod';

/**
 * Universal UUID regex matching PostgreSQL native UUID format.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Universal phone regex matching E.164 and standard format (+ followed by digits/hyphens/spaces).
 */
export const PHONE_REGEX = /^\+?[0-9\s-]{10,20}$/;

/**
 * Validation schema for creating an emergency contact (POST /api/v1/emergency-contacts).
 *
 * Rules:
 * - name: Required, 1 to 100 characters.
 * - phone: Required, 10 to 20 characters, matching PHONE_REGEX.
 * - relationship: Optional, up to 50 characters.
 * - isPrimary: Optional boolean, defaults to false.
 * - strict: Rejects attempts to inject userId, contactId, createdAt, etc.
 */
export const createEmergencyContactSchema = z
  .object({
    name: z
      .string({ message: 'Contact name is required' })
      .trim()
      .min(1, 'Contact name must not be empty')
      .max(100, 'Contact name must not exceed 100 characters'),
    phone: z
      .string({ message: 'Phone number is required' })
      .trim()
      .min(10, 'Phone number must be at least 10 characters')
      .max(20, 'Phone number must not exceed 20 characters')
      .regex(PHONE_REGEX, 'Invalid phone number format'),
    relationship: z
      .string()
      .trim()
      .min(1, 'Relationship must not be empty')
      .max(50, 'Relationship must not exceed 50 characters')
      .optional()
      .nullable(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export type CreateEmergencyContactInput = z.infer<typeof createEmergencyContactSchema>;

/**
 * Validation schema for updating an emergency contact (PATCH /api/v1/emergency-contacts/:contactId).
 *
 * Rules:
 * - At least one mutable field must be provided.
 * - strict: Rejects unauthorized system field injections.
 */
export const updateEmergencyContactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Contact name must not be empty')
      .max(100, 'Contact name must not exceed 100 characters')
      .optional(),
    phone: z
      .string()
      .trim()
      .min(10, 'Phone number must be at least 10 characters')
      .max(20, 'Phone number must not exceed 20 characters')
      .regex(PHONE_REGEX, 'Invalid phone number format')
      .optional(),
    relationship: z
      .string()
      .trim()
      .min(1, 'Relationship must not be empty')
      .max(50, 'Relationship must not exceed 50 characters')
      .optional()
      .nullable(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.phone !== undefined ||
      data.relationship !== undefined ||
      data.isPrimary !== undefined,
    { message: 'At least one field must be provided for update' }
  );

export type UpdateEmergencyContactInput = z.infer<typeof updateEmergencyContactSchema>;

/**
 * Validation schema for routes with :contactId param.
 */
export const contactIdParamSchema = z
  .object({
    contactId: z
      .string({ message: 'Contact ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Contact ID must be a valid UUID'),
  })
  .strict();

export type ContactIdParam = z.infer<typeof contactIdParamSchema>;
