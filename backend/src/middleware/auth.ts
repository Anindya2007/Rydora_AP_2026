import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { sessionService } from '../services/session.service.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { PlatformRole } from './rbac.js';

export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  roles: PlatformRole[];
  profileImage: string | null;
  licenseNumber: string | null;
  licenseExpiry: Date | null;
  driverVerified: boolean;
  walletBalance: string;
  averageRating: string;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionId?: string;
    }
  }
}

// UUID validation regex (case-insensitive 8-4-4-4-12 hex format)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Authentication Middleware:
 * 1. Extracts sessionId and token from cookies (via cookie-parser) or Authorization header / X-Session-Id.
 * 2. If sessionId is present, verifies session against PostgreSQL `sessions` table.
 * 3. Every time middleware is used, stores/updates the session token in the session table.
 * 4. Cryptographically verifies JWT token with env.JWT_SECRET.
 * 5. Queries PostgreSQL to load the latest user state and roles.
 * 6. Attaches sanitized AuthenticatedUser to req.user.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Extract token from cookie or Authorization header
    let token: string | undefined = req.cookies?.token;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.trim().split(/\s+/);
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1].trim();
      }
    }

    // 2. If token is not in cookie/header, check session lookup
    const sessionId: string | undefined =
      req.cookies?.sessionId || (req.headers['x-session-id'] as string) || undefined;

    if (!token && sessionId) {
      const session = await sessionService.getSession(sessionId);
      if (session) {
        token = session.token;
      }
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required. Missing session cookie or authorization token.');
    }

    // 3. Verify JWT token
    let decoded: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, env.JWT_SECRET);
      if (typeof verified !== 'object' || verified === null) {
        throw new UnauthorizedError('Invalid token payload');
      }
      decoded = verified as jwt.JwtPayload;
    } catch (err: any) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Authentication token has expired');
      }
      throw new UnauthorizedError('Token verification failed');
    }

    const userId = decoded.sub;
    if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      throw new UnauthorizedError('Invalid or malformed user ID in token claim');
    }

    req.sessionId = sessionId;

    // 4. Query user from database
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        name: true,
        email: true,
        phone: true,
        roles: true,
        profileImage: true,
        licenseNumber: true,
        licenseExpiry: true,
        driverVerified: true,
        walletBalance: true,
        averageRating: true,
        ratingCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found or account no longer exists');
    }

    // 5. Attach user to request with resolved roles
    const resolvedRoles: PlatformRole[] = [...user.roles];
    if (env.ADMIN_USER_IDS.includes(user.userId.toLowerCase())) {
      resolvedRoles.push('ADMIN');
    }

    req.user = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: resolvedRoles,
      profileImage: user.profileImage,
      licenseNumber: user.licenseNumber,
      licenseExpiry: user.licenseExpiry,
      driverVerified: user.driverVerified,
      walletBalance: user.walletBalance.toString(),
      averageRating: user.averageRating.toString(),
      ratingCount: user.ratingCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional Authentication Middleware:
 * If a token or session is present in cookies or headers, attempts to authenticate the caller.
 * If authentication fails or no credentials are supplied, silently continues without attaching req.user.
 */
export async function authenticateOptional(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (
      req.cookies?.token ||
      req.headers.authorization ||
      req.cookies?.sessionId ||
      req.headers['x-session-id']
    ) {
      await authenticate(req, res, () => {});
    }
  } catch {
    // Silently ignore auth failure for optional routes
  }
  next();
}

export const authMiddleware = authenticate;
export default authenticate;
