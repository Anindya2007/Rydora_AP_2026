import type { Request, Response, NextFunction } from 'express';

/**
 * Rate limiters disabled per user requirement to maximize responsiveness,
 * polling performance, and overall user experience without 429 interruptions.
 */
export function createAuthRateLimiter(_options?: any) {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

export const authRateLimiter = (_req: Request, _res: Response, next: NextFunction) => next();

export const apiRateLimiter = (_req: Request, _res: Response, next: NextFunction) => next();

