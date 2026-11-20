import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../src/middleware/auth.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requestIdMiddleware } from '../../src/middleware/requestId.js';

// Construct an isolated test app mounting a protected endpoint guarded by authenticate middleware
function createProtectedTestApp(): Application {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(express.json());

  // Protected route for testing middleware behavior
  app.get('/api/v1/protected', authenticate, (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: req.user,
    });
  });

  app.use(errorHandler);
  return app;
}

const testApp = createProtectedTestApp();

const validUserId = '11111111-2222-3333-4444-555555555555';

const mockDbUser = {
  userId: validUserId,
  name: 'Badal Khandelwal',
  email: 'badal@srmist.edu.in',
  phone: '+919876543210',
  roles: ['USER'],
  profileImage: null,
  licenseNumber: null,
  licenseExpiry: null,
  driverVerified: false,
  walletBalance: { toString: () => '150.00' },
  averageRating: { toString: () => '4.85' },
  ratingCount: 12,
  createdAt: new Date('2026-11-19T10:00:00.000Z'),
  updatedAt: new Date('2026-11-19T10:00:00.000Z'),
};

describe('Rydora Authentication Middleware Test Suite (Milestone 2 - Phase 2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Missing Authorization Header', () => {
    it('should return HTTP 401 UNAUTHORIZED when no Authorization header is provided', async () => {
      const res = await request(testApp).get('/api/v1/protected');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/authorization header is required/i);
    });
  });

  describe('2. Incorrect Authorization Scheme', () => {
    it('should return HTTP 401 UNAUTHORIZED when scheme is not Bearer (e.g. Basic)', async () => {
      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', 'Basic dXNlcjpwYXNzd29yZA==');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/invalid authorization scheme/i);
    });

    it('should return HTTP 401 UNAUTHORIZED when scheme is Token or malformed', async () => {
      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', 'Token some-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/invalid authorization scheme/i);
    });
  });

  describe('3. Empty Bearer Token', () => {
    it('should return HTTP 401 UNAUTHORIZED when header contains Bearer with no token', async () => {
      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer ');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/invalid authorization scheme|bearer token must not be empty/i);
    });

    it('should return HTTP 401 UNAUTHORIZED when header is just Bearer', async () => {
      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/invalid authorization scheme/i);
    });
  });

  describe('4. Invalid JWT', () => {
    it('should return HTTP 401 UNAUTHORIZED when JWT has tampered signature or invalid characters', async () => {
      const tamperedToken = jwt.sign({ sub: validUserId }, 'wrong-secret-key-that-does-not-match');

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/authentication token is invalid/i);
    });

    it('should return HTTP 401 UNAUTHORIZED when token is gibberish', async () => {
      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer this.is.not.a.valid.jwt');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/authentication token is invalid/i);
    });
  });

  describe('5. Expired JWT', () => {
    it('should return HTTP 401 UNAUTHORIZED when JWT has expired', async () => {
      // Create a token expired 1 hour ago
      const expiredToken = jwt.sign(
        { sub: validUserId, iat: Math.floor(Date.now() / 1000) - 7200 },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/token has expired/i);
    });
  });

  describe('6. JWT Missing sub Claim', () => {
    it('should return HTTP 401 UNAUTHORIZED when token payload has no sub claim', async () => {
      const tokenWithoutSub = jwt.sign(
        { email: 'badal@srmist.edu.in' },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${tokenWithoutSub}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/invalid or malformed user id/i);
    });
  });

  describe('7. JWT Containing Malformed UUID in sub Claim', () => {
    it('should return HTTP 401 UNAUTHORIZED when sub is not a valid UUID', async () => {
      const tokenWithBadUuid = jwt.sign(
        { sub: '12345-not-a-valid-uuid' },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${tokenWithBadUuid}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/invalid or malformed user id/i);
    });
  });

  describe('8. Valid JWT and Existing User', () => {
    it('should verify token, fetch user from DB, attach to req.user, and allow access (HTTP 200)', async () => {
      const validToken = jwt.sign({ sub: validUserId }, env.JWT_SECRET, { expiresIn: '24h' });

      const findSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Authentication successful');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.userId).toBe(validUserId);
      expect(res.body.user.email).toBe(mockDbUser.email);
      expect(res.body.user.name).toBe(mockDbUser.name);
      expect(res.body.user.roles).toEqual(['USER']);

      // Ensure DB query looked up by sub UUID
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: validUserId },
        })
      );
    });
  });

  describe('9. Valid JWT but Deleted / Non-Existent User', () => {
    it('should return HTTP 401 UNAUTHORIZED when token is cryptographically valid but user no longer exists in DB', async () => {
      const validToken = jwt.sign({ sub: validUserId }, env.JWT_SECRET, { expiresIn: '24h' });

      // DB returns null (e.g. user was deleted from PostgreSQL)
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/user not found or account no longer exists/i);
    });
  });

  describe('10. Database Error Handling', () => {
    it('should forward unexpected database errors to centralized errorHandler returning HTTP 500 without leaking DB internals', async () => {
      const validToken = jwt.sign({ sub: validUserId }, env.JWT_SECRET, { expiresIn: '24h' });

      // DB query throws connection error
      vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('PostgreSQL connection terminated'));

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.meta.requestId).toBeDefined();
    });
  });

  describe('11. Current Database Roles Used Over Token Claims', () => {
    it('should always use latest database roles and ignore any roles supplied in forged/stale token claims', async () => {
      // Attacker attempts to forge elevated DRIVER or ADMIN roles inside the token
      const forgedToken = jwt.sign(
        { sub: validUserId, roles: ['ADMIN', 'SUPERADMIN', 'DRIVER'] },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // In the database, the user only has the 'USER' role
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockDbUser,
        roles: ['USER'],
      } as any);

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.roles).toEqual(['USER']);
      expect(res.body.user.roles).not.toContain('ADMIN');
      expect(res.body.user.roles).not.toContain('SUPERADMIN');
      expect(res.body.user.roles).not.toContain('DRIVER');
    });

    it('should reflect elevated database roles even if token was issued prior to role update', async () => {
      // Token issued when user was just a USER
      const token = jwt.sign({ sub: validUserId }, env.JWT_SECRET, { expiresIn: '24h' });

      // Database reflects that user was subsequently verified as a DRIVER
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockDbUser,
        roles: ['USER', 'DRIVER'],
        driverVerified: true,
      } as any);

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.roles).toEqual(['USER', 'DRIVER']);
      expect(res.body.user.driverVerified).toBe(true);
    });
  });

  describe('12. Password Hash Exposure Prevention', () => {
    it('should never expose or attach passwordHash to the request user object', async () => {
      const validToken = jwt.sign({ sub: validUserId }, env.JWT_SECRET, { expiresIn: '24h' });

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const res = await request(testApp)
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();

      const rawResponseString = JSON.stringify(res.body);
      expect(rawResponseString).not.toContain('passwordHash');
      expect(rawResponseString).not.toContain('password_hash');
    });
  });
});
