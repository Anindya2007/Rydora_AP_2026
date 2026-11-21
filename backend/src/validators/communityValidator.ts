import { z } from 'zod';

/**
 * Universal UUID v1-v7 regex (case-insensitive 8-4-4-4-12 hex format).
 * Matches PostgreSQL's native UUID type representation and test mocks.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Institutional/academic domain regex.
 * Accepts standard domain formats such as srmist.edu.in, harvard.edu, college-campus.org.
 * Rejects IP addresses, protocols (http://), URLs with paths (/path), and email addresses (@domain).
 */
export const DOMAIN_REGEX = /^(?!:\/\/)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

/**
 * Validation schema for community creation (POST /api/v1/communities).
 * Restricts input strictly to name, domain, and optional description.
 * Prevents clients from injecting communityId, createdById, or status.
 */
export const createCommunitySchema = z
  .object({
    name: z
      .string({ message: 'Community name is required' })
      .trim()
      .min(2, 'Community name must be at least 2 characters long')
      .max(150, 'Community name must not exceed 150 characters'),
    domain: z
      .string({ message: 'Email domain is required' })
      .trim()
      .min(3, 'Domain must be at least 3 characters long')
      .max(255, 'Domain must not exceed 255 characters')
      .regex(
        DOMAIN_REGEX,
        'Invalid email domain format. Must be a valid domain such as example.edu or srmist.edu.in'
      )
      .transform((val) => val.toLowerCase()),
    description: z
      .string()
      .trim()
      .max(1000, 'Description must not exceed 1000 characters')
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() ? val.trim() : null)),
  })
  .strict();

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

/**
 * Validation schema for community listing and filtering (GET /api/v1/communities).
 * Supports search, domain filtering, and safe pagination.
 */
export const communityQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(100, 'Search query must not exceed 100 characters')
      .optional(),
    domain: z
      .string()
      .trim()
      .max(255, 'Domain filter must not exceed 255 characters')
      .transform((val) => val.toLowerCase())
      .optional(),
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
  })
  .strict();

export type CommunityQueryInput = z.infer<typeof communityQuerySchema>;

/**
 * Validation schema for routes containing communityId parameter (e.g. /:communityId).
 */
export const communityIdParamSchema = z
  .object({
    communityId: z
      .string({ message: 'Community ID is required' })
      .trim()
      .regex(UUID_REGEX, 'Invalid community ID format. Must be a valid UUID'),
  })
  .strict();

export type CommunityIdParam = z.infer<typeof communityIdParamSchema>;

/**
 * Validation schema for community join request body (POST /api/v1/communities/:communityId/join).
 * Explicitly rejects any attempt by the client to inject userId, roles, or status.
 * Identity is securely derived exclusively from req.user.
 */
export const joinCommunitySchema = z
  .object({})
  .strict()
  .optional()
  .default({});

export type JoinCommunityInput = z.infer<typeof joinCommunitySchema>;
