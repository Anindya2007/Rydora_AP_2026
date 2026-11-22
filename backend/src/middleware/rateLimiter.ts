import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env.js';
import type { Request, Response } from 'express';

/**
 * Factory to create rate limiters for authentication endpoints.
 * Configured with standard headers and standard Rydora ApiErrorResponse payload on limit breach.
 */
export function createAuthRateLimiter(options?: Partial<Options>) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute sliding window
    limit: 10, // Max 10 attempts per IP per window
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    handler: (req: Request, res: Response) => {
      const requestId = req.id || (res.locals?.requestId as string) || 'unknown';
      res.status(429).json({
        success: false,
        statusCode: 429,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many authentication attempts. Please try again after 15 minutes.',
          details: null,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
    ...options,
  });
}

/**
 * Default authentication rate limiter applied to signup and login endpoints.
 */
export const authRateLimiter = createAuthRateLimiter();
