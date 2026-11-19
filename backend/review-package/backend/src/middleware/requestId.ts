import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

// Extend Express.Request to carry `id`
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Attaches a unique request ID to incoming requests and sets the response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId.trim() ? incomingId.trim() : randomUUID();

  req.id = requestId;
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}
