import { z } from 'zod';

/**
 * Validation schema for user registration (POST /api/v1/auth/signup)
 * Enforces strict input validation to prevent unauthorized privilege assignment.
 */
export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name must not exceed 100 characters'),
    email: z
      .string()
      .trim()
      .email('Invalid email address format')
      .max(255, 'Email must not exceed 255 characters')
      .transform((val) => val.toLowerCase()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password must not exceed 128 characters'),
    phone: z
      .string()
      .trim()
      .min(10, 'Phone number must be at least 10 characters')
      .max(20, 'Phone number must not exceed 20 characters')
      .regex(/^\+?[0-9\s-]{10,20}$/, 'Invalid phone number format')
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() ? val.trim() : undefined)),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Validation schema for user login (POST /api/v1/auth/login)
 */
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Invalid email address format')
      .transform((val) => val.toLowerCase()),
    password: z
      .string()
      .min(1, 'Password is required'),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
