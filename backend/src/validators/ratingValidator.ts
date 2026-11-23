import { z } from 'zod';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createRatingSchema = z.object({
  bookingId: z
    .string()
    .trim()
    .regex(UUID_REGEX, { message: 'bookingId must be a valid UUID' }),
  rating: z
    .number()
    .int({ message: 'rating must be an integer between 1 and 5' })
    .min(1, { message: 'rating must be at least 1' })
    .max(5, { message: 'rating cannot exceed 5' }),
  review: z
    .string()
    .trim()
    .max(500, { message: 'review cannot exceed 500 characters' })
    .optional(),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;

export const ratingUserIdParamSchema = z.object({
  userId: z
    .string()
    .trim()
    .regex(UUID_REGEX, { message: 'userId must be a valid UUID' }),
});

export type RatingUserIdParamInput = z.infer<typeof ratingUserIdParamSchema>;

export const ratingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type RatingsQueryInput = z.infer<typeof ratingsQuerySchema>;
