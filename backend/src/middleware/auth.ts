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
    // 1. Extract sessionId from cookie or header
    const sessionId: string | undefined =
      req.cookies?.sessionId || (req.headers['x-session-id'] as string) || undefined;

    // 2. Extract JWT token from cookie or Authorization header
    let token: string | undefined = req.cookies?.token;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.trim().split(/\s+/);
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1].trim();
      }
    }

    let targetUserId: string;
    let verifiedToken: string;

    // 3. Verify using session ID and sessions table if sessionId is provided
    if (sessionId) {
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw new UnauthorizedError('Session expired or invalid. Please log in again.');
      }

      verifiedToken = token || session.token;

      // Throttled update: only update session token in database if not updated recently
      if (!session.updatedAt || Date.now() - new Date(session.updatedAt).getTime() > 5 * 60 * 1000) {
        await sessionService.storeSessionToken(sessionId, verifiedToken, session.userId);
      }

      // Verify token signature with JWT_SECRET
      let decoded: jwt.JwtPayload;
      try {
        const verified = jwt.verify(verifiedToken, env.JWT_SECRET);
        if (typeof verified !== 'object' || verified === null) {
          throw new UnauthorizedError('Invalid token payload');
        }
        decoded = verified as jwt.JwtPayload;
      } catch (err: any) {
        if (err instanceof UnauthorizedError) throw err;
        if (err instanceof jwt.TokenExpiredError) {
          await sessionService.deleteSession(sessionId);
          throw new UnauthorizedError('Authentication session token has expired');
        }
        throw new UnauthorizedError('Token verification failed');
      }

      const sub = decoded.sub;
      if (!sub || typeof sub !== 'string' || !UUID_REGEX.test(sub)) {
        throw new UnauthorizedError('Invalid or malformed user ID in token claim');
      }

      targetUserId = session.userId;
      req.sessionId = sessionId;
    } else if (token) {
      // 4. Token provided without sessionId: verify token, then store in session table
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

      const sub = decoded.sub;
      if (!sub || typeof sub !== 'string' || !UUID_REGEX.test(sub)) {
        throw new UnauthorizedError('Invalid or malformed user ID in token claim');
      }

      targetUserId = sub;

      // Create or update session in sessions table
      const activeSessionId = await sessionService.getOrCreateSessionForToken(sub, token);
      req.sessionId = activeSessionId;

      // Attach cookies for subsequent requests
      res.cookie('sessionId', activeSessionId, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.cookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
    } else {
      throw new UnauthorizedError('Authentication required. Missing session cookie or authorization token.');
    }

    // 5. Query user details directly from PostgreSQL
    const user = await prisma.user.findUnique({
      where: { userId: targetUserId },
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

    // Resolve application-level roles
    const resolvedRoles: PlatformRole[] = [...user.roles];
    if (env.ADMIN_USER_IDS.includes(user.userId.toLowerCase())) {
      resolvedRoles.push('ADMIN');
    }

    // Attach sanitized user to request
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
      walletBalance:
        typeof user.walletBalance === 'object' && user.walletBalance !== null && 'toString' in user.walletBalance
          ? user.walletBalance.toString()
          : String(user.walletBalance ?? '0.00'),
      averageRating:
        typeof user.averageRating === 'object' && user.averageRating !== null && 'toString' in user.averageRating
          ? user.averageRating.toString()
          : String(user.averageRating ?? '0.00'),
      ratingCount: user.ratingCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export const authMiddleware = authenticate;
export default authenticate;
