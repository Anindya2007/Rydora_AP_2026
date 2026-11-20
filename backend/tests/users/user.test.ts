import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import jwt from 'jsonwebtoken';
import { authRouter } from '../../src/routes/auth.routes.js';
import { userRouter } from '../../src/routes/user.routes.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requestIdMiddleware } from '../../src/middleware/requestId.js';

// Construct isolated test app mounting authRouter and userRouter
function createTestApp(): Application {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', userRouter);
  app.use(errorHandler);
  return app;
}

const testApp = createTestApp();

const mockUserId = '22222222-3333-4444-5555-666666666666';

const mockDbUser = {
  userId: mockUserId,
  name: 'Badal Khandelwal',
  email: 'badal@srmist.edu.in',
  phone: '+919876543210',
  roles: ['USER'],
  profileImage: 'https://cdn.rydora.com/avatars/default.png',
  licenseNumber: null,
  licenseExpiry: null,
  driverVerified: false,
  walletBalance: { toString: () => '250.00' },
  averageRating: { toString: () => '4.90' },
  ratingCount: 15,
  createdAt: new Date('2026-11-19T10:00:00.000Z'),
  updatedAt: new Date('2026-11-19T10:00:00.000Z'),
};

function generateValidToken(userId: string = mockUserId): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
}

describe('Rydora User Profile Management Test Suite (Milestone 2 - Phase 3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/auth/me', () => {
    it('1. should return HTTP 401 when Authorization header is missing', async () => {
      const res = await request(testApp).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('2. should return HTTP 200 with standard success envelope when valid token is provided', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/current user retrieved/i);
      expect(res.body.data.user).toBeDefined();
    });

    it('3. should return the correct authenticated user corresponding to the token subject', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.userId).toBe(mockUserId);
      expect(res.body.data.user.email).toBe(mockDbUser.email);
      expect(res.body.data.user.name).toBe(mockDbUser.name);
      expect(res.body.data.user.roles).toEqual(['USER']);
      expect(res.body.data.user.driverVerified).toBe(false);
    });

    it('4. should never return passwordHash in GET /api/v1/auth/me response', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();

      const rawJson = JSON.stringify(res.body);
      expect(rawJson).not.toContain('passwordHash');
      expect(rawJson).not.toContain('password_hash');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('5. should return HTTP 401 when Authorization header is missing', async () => {
      const res = await request(testApp).patch('/api/v1/users/me').send({
        name: 'Updated Name',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('6. should successfully update user name and return HTTP 200 with sanitized profile', async () => {
      // 1. authenticate middleware findUnique
      vi.spyOn(prisma.user, 'findUnique')
        .mockResolvedValueOnce(mockDbUser as any) // auth middleware
        .mockResolvedValueOnce({ userId: mockUserId, phone: mockDbUser.phone } as any); // userService existence check

      const updatedRecord = { ...mockDbUser, name: 'Badal Khandelwal Updated' };
      const updateSpy = vi.spyOn(prisma.user, 'update').mockResolvedValueOnce(updatedRecord as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Badal Khandelwal Updated',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Badal Khandelwal Updated');
      expect(res.body.data.user.passwordHash).toBeUndefined();

      expect(updateSpy).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: { name: 'Badal Khandelwal Updated' },
      });
    });

    it('7. should successfully update user phone number and return HTTP 200', async () => {
      vi.spyOn(prisma.user, 'findUnique')
        .mockResolvedValueOnce(mockDbUser as any)
        .mockResolvedValueOnce({ userId: mockUserId, phone: mockDbUser.phone } as any);

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce(null); // No duplicate phone

      const updatedRecord = { ...mockDbUser, phone: '+919988776655' };
      vi.spyOn(prisma.user, 'update').mockResolvedValueOnce(updatedRecord as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          phone: '+919988776655',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.phone).toBe('+919988776655');
    });

    it('8. should successfully update profileImage URL and return HTTP 200', async () => {
      vi.spyOn(prisma.user, 'findUnique')
        .mockResolvedValueOnce(mockDbUser as any)
        .mockResolvedValueOnce({ userId: mockUserId, phone: mockDbUser.phone } as any);

      const newImageUrl = 'https://cdn.rydora.com/avatars/new-profile.png';
      const updatedRecord = { ...mockDbUser, profileImage: newImageUrl };
      vi.spyOn(prisma.user, 'update').mockResolvedValueOnce(updatedRecord as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          profileImage: newImageUrl,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.profileImage).toBe(newImageUrl);
    });

    it('9. should return HTTP 409 CONFLICT when phone number already belongs to another user', async () => {
      vi.spyOn(prisma.user, 'findUnique')
        .mockResolvedValueOnce(mockDbUser as any)
        .mockResolvedValueOnce({ userId: mockUserId, phone: mockDbUser.phone } as any);

      // Duplicate phone found for another user
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce({ userId: 'other-user-uuid' } as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          phone: '+919876543299',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/phone number already exists/i);
    });

    it('10. should return HTTP 422 UNPROCESSABLE_ENTITY when phone format is invalid', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          phone: 'invalid-phone-abc',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('11. should return HTTP 422 UNPROCESSABLE_ENTITY when profileImage is not a valid URL', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          profileImage: 'not-a-valid-url-format',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('12. should return HTTP 422 UNPROCESSABLE_ENTITY when client attempts to modify roles', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          roles: ['DRIVER'],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('13. should return HTTP 422 UNPROCESSABLE_ENTITY when client attempts to modify driverVerified', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          driverVerified: true,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('14. should return HTTP 422 UNPROCESSABLE_ENTITY when client attempts to modify walletBalance', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletBalance: 999999,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('15. should return HTTP 422 UNPROCESSABLE_ENTITY when client attempts to modify userId or email', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: '33333333-4444-5555-6666-777777777777',
          email: 'hacked@srmist.edu.in',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('16. should return HTTP 422 UNPROCESSABLE_ENTITY when update payload is empty', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.message).toBe('Validation failed');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringMatching(/at least one field/i),
          }),
        ])
      );
    });

    it('17. should ensure user cannot update another user profile by injecting an ID', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

      const token = generateValidToken(mockUserId);
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: '00000000-0000-0000-0000-000000000000',
          name: 'Targeted Name',
        });

      // Strict validation rejects userId injection with 422
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('18. should handle Prisma/database errors safely without leaking internal details', async () => {
      vi.spyOn(prisma.user, 'findUnique')
        .mockResolvedValueOnce(mockDbUser as any)
        .mockResolvedValueOnce({ userId: mockUserId, phone: mockDbUser.phone } as any);

      vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('PostgreSQL connection drop'));

      const token = generateValidToken();
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Name',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.meta.requestId).toBeDefined();
    });
  });
});
