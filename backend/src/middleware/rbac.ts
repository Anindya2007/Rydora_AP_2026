import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '../generated/prisma/client.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export type PlatformRole = 'USER' | 'DRIVER' | 'ADMIN';

export const ExtendedRole = {
  ...UserRole,
  ADMIN: 'ADMIN' as const,
};

/**
 * Reusable Role-Based Access Control (RBAC) middleware factory.
 *
 * Enforces that the authenticated user (`req.user`) has at least one of the
 * specified `allowedRoles`.
 *
 * Must be mounted AFTER `authenticate` middleware in the route chain.
 *
 * Rules:
 * 1. If `req.user` is missing, forwards a 401 UnauthorizedError.
 * 2. If `allowedRoles` is empty, fails safely by forwarding a 403 ForbiddenError.
 * 3. If `req.user.roles` is missing, empty, or has no overlap with `allowedRoles`,
 *    forwards a 403 ForbiddenError.
 * 4. Never trusts roles from request body, query parameters, or headers.
 * 5. Does not execute additional database queries (relies on fresh `req.user.roles`).
 * 6. If user has at least one matching role, calls `next()`.
 *
 * @param allowedRoles Global platform roles permitted to access the target route.
 * @returns Express middleware function.
 */
export function requireRoles(...allowedRoles: (PlatformRole | UserRole)[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // 1. Missing authenticated user context -> 401
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // 2. Empty allowedRoles configuration -> fail safe (deny access)
      if (!allowedRoles || allowedRoles.length === 0) {
        throw new ForbiddenError('Forbidden: Insufficient permissions');
      }

      // 3. User roles must be a valid, non-empty array
      const userRoles = req.user.roles;
      if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
        throw new ForbiddenError('Forbidden: Insufficient permissions');
      }

      // 4. Check for at least one matching role
      const hasMatchingRole = userRoles.some((role) =>
        allowedRoles.includes(role as PlatformRole)
      );
      if (!hasMatchingRole) {
        throw new ForbiddenError('Forbidden: Insufficient permissions');
      }

      // 5. Authorized -> proceed to next handler
      next();
    } catch (error) {
      next(error);
    }
  };
}
