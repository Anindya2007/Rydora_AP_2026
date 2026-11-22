import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { UserRole } from '../generated/prisma/client.js';

export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
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
    }
  }
}

// UUID validation regex (case-insensitive 8-4-4-4-12 hex format)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Authentication Middleware:
 * 1. Extracts the Bearer token from the Authorization header.
 * 2. Cryptographically verifies the JWT signature against env.JWT_SECRET.
 * 3. Validates that the 'sub' claim is a well-formed UUID.
 * 4. Queries PostgreSQL via Prisma to fetch the latest user state and roles.
 * 5. Attaches a sanitized AuthenticatedUser to req.user (excluding passwordHash).
 * 6. Forwards operational and unexpected errors to the centralized error handler.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedError('Authorization header is required');
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedError('Invalid authorization scheme. Format: Bearer <token>');
    }

    const token = parts[1].trim();
    if (!token) {
      throw new UnauthorizedError('Bearer token must not be empty');
    }

    // Cryptographic verification
    let decoded: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, env.JWT_SECRET);
      if (typeof verified !== 'object' || verified === null) {
        throw new UnauthorizedError('Invalid token payload');
      }
      decoded = verified as jwt.JwtPayload;
    } catch (err: any) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Authentication token has expired');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Authentication token is invalid');
      }
      throw new UnauthorizedError('Token verification failed');
    }

    const sub = decoded.sub;
    if (!sub || typeof sub !== 'string' || !UUID_REGEX.test(sub)) {
      throw new UnauthorizedError('Invalid or malformed user ID in token claim');
    }

    // Fetch latest user details and roles directly from PostgreSQL (never trust token claims for roles)
    const user = await prisma.user.findUnique({
      where: { userId: sub },
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

    // Attach sanitized user to Request object
    req.user = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      profileImage: user.profileImage,
      licenseNumber: user.licenseNumber,
      licenseExpiry: user.licenseExpiry,
      driverVerified: user.driverVerified,
      walletBalance: typeof user.walletBalance === 'object' && user.walletBalance !== null && 'toString' in user.walletBalance
        ? user.walletBalance.toString()
        : String(user.walletBalance ?? '0.00'),
      averageRating: typeof user.averageRating === 'object' && user.averageRating !== null && 'toString' in user.averageRating
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
