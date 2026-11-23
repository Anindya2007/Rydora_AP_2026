import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import jwt from 'jsonwebtoken';
import { userRouter } from '../../src/routes/user.routes.js';
import { authRouter } from '../../src/routes/auth.routes.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requestIdMiddleware } from '../../src/middleware/requestId.js';
import { UserRole } from '../../src/generated/prisma/client.js';

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

const mockUserId = '11111111-2222-3333-4444-555555555555';
const mockAdminId = '99999999-8888-7777-6666-555555555555';
const mockDriverId = '33333333-4444-5555-6666-777777777777';
const mockTargetUserId = '44444444-5555-6666-7777-888888888888';

const mockRegularUser = {
  userId: mockUserId,
  name: 'Regular User',
  email: 'user@example.com',
  phone: '+919876543210',
  roles: [UserRole.USER],
  profileImage: null,
  licenseNumber: null,
  licenseExpiry: null,
  driverVerified: false,
  walletBalance: { toString: () => '0.00' },
  averageRating: { toString: () => '5.00' },
  ratingCount: 0,
  createdAt: new Date('2026-11-20T10:00:00.000Z'),
  updatedAt: new Date('2026-11-20T10:00:00.000Z'),
};

const mockAdminUser = {
  userId: mockAdminId,
  name: 'Admin User',
  email: 'admin@rydora.com',
  phone: '+919876543299',
  roles: [UserRole.USER], // Persisted in DB as USER; ADMIN role derived dynamically via ADMIN_USER_IDS
  profileImage: null,
  licenseNumber: null,
  licenseExpiry: null,
  driverVerified: false,
  walletBalance: { toString: () => '0.00' },
  averageRating: { toString: () => '5.00' },
  ratingCount: 0,
  createdAt: new Date('2026-11-20T10:00:00.000Z'),
  updatedAt: new Date('2026-11-20T10:00:00.000Z'),
};

const mockDriverUser = {
  userId: mockDriverId,
  name: 'Driver User',
  email: 'driver@rydora.com',
  phone: '+919876543288',
  roles: [UserRole.USER, UserRole.DRIVER],
  profileImage: null,
  licenseNumber: 'DL-9876543210123',
  licenseExpiry: new Date('2028-12-31T00:00:00.000Z'),
  driverVerified: true,
  walletBalance: { toString: () => '0.00' },
  averageRating: { toString: () => '5.00' },
  ratingCount: 0,
  createdAt: new Date('2026-11-20T10:00:00.000Z'),
  updatedAt: new Date('2026-11-20T10:00:00.000Z'),
};

function generateToken(userId: string, extraClaims: Record<string, any> = {}): string {
  return jwt.sign({ sub: userId, ...extraClaims }, env.JWT_SECRET, { expiresIn: '24h' });
}

describe('Rydora Driver Verification & Admin Approval Test Suite (Milestone 5.10 & M5.10.2.1)', () => {
  let originalAdminUserIds: string[];

  beforeEach(() => {
    originalAdminUserIds = [...env.ADMIN_USER_IDS];
    env.ADMIN_USER_IDS = [mockAdminId];
  });

  afterEach(() => {
    env.ADMIN_USER_IDS = originalAdminUserIds;
    vi.restoreAllMocks();
  });

  describe('1. Driver Licence Verification Submission (POST /api/v1/users/driver-verification)', () => {
    const validSubmissionPayload = {
      licenseNumber: 'DL-0420110012345',
      licenseExpiry: '2028-12-31T23:59:59.000Z',
    };

    it('should reject unauthenticated request when token is missing (401)', async () => {
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .send(validSubmissionPayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should successfully submit driving licence, set driverVerified=false, and NOT grant DRIVER role (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce(null); // No duplicate license
      vi.spyOn(prisma.user, 'update').mockResolvedValueOnce({
        userId: mockUserId,
        licenseNumber: 'DL-0420110012345',
        licenseExpiry: new Date(validSubmissionPayload.licenseExpiry),
        driverVerified: false,
        updatedAt: new Date(),
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send(validSubmissionPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/awaiting administrative review/i);
      expect(res.body.data.verification.licenseNumber).toBe('DL-0420110012345');
      expect(res.body.data.verification.driverVerified).toBe(false);
      // Ensure caller roles in session were not elevated
      expect(mockRegularUser.roles).toEqual([UserRole.USER]);
    });

    it('should normalize licence number to uppercase and trim whitespace', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce(null);
      const updateSpy = vi.spyOn(prisma.user, 'update').mockResolvedValueOnce({
        userId: mockUserId,
        licenseNumber: 'DL-0420110012345',
        licenseExpiry: new Date(validSubmissionPayload.licenseExpiry),
        driverVerified: false,
        updatedAt: new Date(),
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send({
          licenseNumber: '  dl-0420110012345  ',
          licenseExpiry: validSubmissionPayload.licenseExpiry,
        });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            licenseNumber: 'DL-0420110012345',
          }),
        })
      );
    });

    it('should reject submission when licenseNumber is missing (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send({ licenseExpiry: validSubmissionPayload.licenseExpiry });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject submission when licenseNumber is too short (< 5 chars) (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send({
          licenseNumber: 'DL1',
          licenseExpiry: validSubmissionPayload.licenseExpiry,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject submission when licenseExpiry is in the past (expired licence) (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send({
          licenseNumber: validSubmissionPayload.licenseNumber,
          licenseExpiry: '2020-01-01T00:00:00.000Z',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.message).toMatch(/validation failed/i);
    });

    it('should reject submission when licence number is already registered by another user (409 Conflict)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce({
        userId: 'some-other-user-uuid',
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send(validSubmissionPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/already registered in the system/i);
    });

    it('should reject submission when user is already verified as a driver (409 Conflict)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send(validSubmissionPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/already a verified driver/i);
    });

    it('should reject repeated submission when user already has a pending verification request (409 Conflict)', async () => {
      const pendingUser = {
        ...mockRegularUser,
        licenseNumber: 'DL-PENDING-001',
        licenseExpiry: new Date('2029-01-01'),
        driverVerified: false,
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(pendingUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send(validSubmissionPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/already pending review/i);
    });

    it('should reject unauthorized extra injected fields via strict schema (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .post('/api/v1/users/driver-verification')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validSubmissionPayload,
          driverVerified: true,
          roles: ['DRIVER'],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });

  describe('2. Admin Pending Verification List (GET /api/v1/users/driver-verification/pending)', () => {
    it('should reject unauthenticated caller (401)', async () => {
      const res = await request(testApp).get('/api/v1/users/driver-verification/pending');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject regular USER from accessing pending verifications (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .get('/api/v1/users/driver-verification/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject DRIVER from accessing pending verifications (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(testApp)
        .get('/api/v1/users/driver-verification/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow ADMIN to retrieve pending applications with pagination (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);
      vi.spyOn(prisma.user, 'count').mockResolvedValueOnce(1);
      vi.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([
        {
          userId: mockTargetUserId,
          name: 'Applicant User',
          email: 'applicant@example.com',
          phone: '+919876543200',
          licenseNumber: 'DL-PENDING-12345',
          licenseExpiry: new Date('2028-12-31'),
          driverVerified: false,
          createdAt: new Date('2026-11-20T10:00:00.000Z'),
          updatedAt: new Date('2026-11-20T12:00:00.000Z'),
        },
      ] as any);

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .get('/api/v1/users/driver-verification/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pendingVerifications).toHaveLength(1);
      expect(res.body.data.pendingVerifications[0].userId).toBe(mockTargetUserId);
      expect(res.body.data.pendingVerifications[0].driverVerified).toBe(false);
      expect(res.body.meta.pagination).toBeDefined();
      expect(res.body.meta.pagination.total).toBe(1);
    });

    it('should never expose password hashes or sensitive internal fields in pending verifications response', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);
      vi.spyOn(prisma.user, 'count').mockResolvedValueOnce(1);
      vi.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([
        {
          userId: mockTargetUserId,
          name: 'Applicant User',
          email: 'applicant@example.com',
          phone: '+919876543200',
          licenseNumber: 'DL-PENDING-12345',
          licenseExpiry: new Date('2028-12-31'),
          driverVerified: false,
          createdAt: new Date('2026-11-20T10:00:00.000Z'),
          updatedAt: new Date('2026-11-20T12:00:00.000Z'),
        },
      ] as any);

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .get('/api/v1/users/driver-verification/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const firstRecord = res.body.data.pendingVerifications[0];
      expect(firstRecord.passwordHash).toBeUndefined();
      expect(firstRecord.walletBalance).toBeUndefined();
    });

    it('should dynamically resolve ADMIN role for users in ADMIN_USER_IDS allowlist (M5.10.2)', async () => {
      // In PostgreSQL, mockAdminUser has roles: [USER]. Dynamically receives ADMIN.
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);
      vi.spyOn(prisma.user, 'count').mockResolvedValueOnce(0);
      vi.spyOn(prisma.user, 'findMany').mockResolvedValueOnce([]);

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .get('/api/v1/users/driver-verification/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should prevent token forgery: client-supplied roles claim in JWT cannot bypass allowlist check (M5.10.2)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      // Client crafts a token with forged roles: ['ADMIN']
      const forgedToken = generateToken(mockUserId, { roles: ['ADMIN'] });

      const res = await request(testApp)
        .get('/api/v1/users/driver-verification/pending')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Admin Driver Approval (PATCH /api/v1/users/:userId/driver-verification/approve)', () => {
    it('should reject unauthenticated request (401)', async () => {
      const res = await request(testApp).patch(
        `/api/v1/users/${mockTargetUserId}/driver-verification/approve`
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject regular USER from approving applications (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject DRIVER from approving applications (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject approval when target userId is not a valid UUID (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch('/api/v1/users/not-a-valid-uuid/driver-verification/approve')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return 404 when target user does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        });
      });

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when target user has not submitted licence details', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            findUnique: vi.fn().mockResolvedValue({
              userId: mockTargetUserId,
              name: 'No Licence User',
              email: 'nolicence@example.com',
              roles: [UserRole.USER],
              licenseNumber: null,
              licenseExpiry: null,
              driverVerified: false,
            }),
          },
        });
      });

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/not submitted driving licence details/i);
    });

    it('should return 400 when target user licence has expired at time of approval', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            findUnique: vi.fn().mockResolvedValue({
              userId: mockTargetUserId,
              name: 'Expired Licence User',
              email: 'expired@example.com',
              roles: [UserRole.USER],
              licenseNumber: 'DL-EXPIRED-12345',
              licenseExpiry: new Date('2020-01-01T00:00:00.000Z'),
              driverVerified: false,
            }),
          },
        });
      });

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/driving licence has expired/i);
    });

    it('should return 409 Conflict when target user is already verified (repeated approval)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            findUnique: vi.fn().mockResolvedValue({
              userId: mockTargetUserId,
              name: 'Already Verified User',
              email: 'verified@example.com',
              roles: [UserRole.USER, UserRole.DRIVER],
              licenseNumber: 'DL-ALREADY-12345',
              licenseExpiry: new Date('2028-12-31T00:00:00.000Z'),
              driverVerified: true,
            }),
          },
        });
      });

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/already a verified driver/i);
    });

    it('should atomically approve application, set driverVerified=true, add DRIVER, and preserve existing USER role (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);

      const targetPendingUser = {
        userId: mockTargetUserId,
        name: 'Applicant User',
        email: 'applicant@example.com',
        phone: '+919876543200',
        roles: [UserRole.USER],
        licenseNumber: 'DL-VALID-12345',
        licenseExpiry: new Date('2028-12-31T00:00:00.000Z'),
        driverVerified: false,
      };

      const updatedUserMock = {
        ...targetPendingUser,
        roles: [UserRole.USER, UserRole.DRIVER],
        driverVerified: true,
        updatedAt: new Date(),
      };

      const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
      const findUniqueMock = vi
        .fn()
        .mockResolvedValueOnce(targetPendingUser)
        .mockResolvedValueOnce(updatedUserMock);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            findUnique: findUniqueMock,
            updateMany: updateManyMock,
          },
        });
      });

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/driver verification approved successfully/i);
      expect(res.body.data.user.driverVerified).toBe(true);
      expect(res.body.data.user.roles).toContain(UserRole.USER);
      expect(res.body.data.user.roles).toContain(UserRole.DRIVER);

      // Verify transaction updateMany call checks driverVerified and roles equality
      expect(updateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockTargetUserId,
            driverVerified: false,
            licenseNumber: { not: null },
            roles: { equals: targetPendingUser.roles },
          }),
          data: expect.objectContaining({
            driverVerified: true,
            roles: { set: [UserRole.USER, UserRole.DRIVER] },
          }),
        })
      );
    });

    it('should preserve all existing roles when promoting an admin user to driver', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);

      const targetAdminUser = {
        userId: mockTargetUserId,
        name: 'Co-Admin User',
        email: 'coadmin@rydora.com',
        phone: '+919876543201',
        roles: [UserRole.USER],
        licenseNumber: 'DL-ADMIN-12345',
        licenseExpiry: new Date('2028-12-31T00:00:00.000Z'),
        driverVerified: false,
      };

      const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
      const findUniqueMock = vi
        .fn()
        .mockResolvedValueOnce(targetAdminUser)
        .mockResolvedValueOnce({
          ...targetAdminUser,
          roles: [UserRole.USER, UserRole.DRIVER],
          driverVerified: true,
          updatedAt: new Date(),
        });

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            findUnique: findUniqueMock,
            updateMany: updateManyMock,
          },
        });
      });

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toEqual(
        expect.arrayContaining([UserRole.USER, UserRole.DRIVER])
      );
      expect(updateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockTargetUserId,
            driverVerified: false,
            roles: { equals: targetAdminUser.roles },
          }),
          data: expect.objectContaining({
            roles: { set: [UserRole.USER, UserRole.DRIVER] },
          }),
        })
      );
    });

    it('should reject concurrent approval race condition with HTTP 409 Conflict (M5.10.2)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);

      const targetPendingUser = {
        userId: mockTargetUserId,
        name: 'Applicant User',
        email: 'applicant@example.com',
        phone: '+919876543200',
        roles: [UserRole.USER],
        licenseNumber: 'DL-VALID-12345',
        licenseExpiry: new Date('2028-12-31T00:00:00.000Z'),
        driverVerified: false,
      };

      // updateMany returns { count: 0 } indicating concurrent approval won the race
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            findUnique: vi.fn().mockResolvedValue(targetPendingUser),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        });
      });

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(
        /Driver verification conflict: User was already verified by another session or verification state changed/i
      );
    });

    it('should reject concurrent role modification race condition with HTTP 409 Conflict (M5.10.2.1)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockAdminUser as any);

      const targetPendingUser = {
        userId: mockTargetUserId,
        name: 'Applicant User',
        email: 'applicant@example.com',
        phone: '+919876543200',
        roles: [UserRole.USER],
        licenseNumber: 'DL-VALID-12345',
        licenseExpiry: new Date('2028-12-31T00:00:00.000Z'),
        driverVerified: false,
      };

      // Concurrent role update caused roles condition to fail -> updateMany returns 0
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            findUnique: vi.fn().mockResolvedValue(targetPendingUser),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        });
      });

      const token = generateToken(mockAdminId);
      const res = await request(testApp)
        .patch(`/api/v1/users/${mockTargetUserId}/driver-verification/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(
        /Driver verification conflict: User was already verified by another session or verification state changed/i
      );
    });
  });

  describe('4. Privacy & Authorization Invariants', () => {
    it('should ensure licence details are never returned in public/me profile endpoints', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockRegularUser,
        licenseNumber: 'DL-SECRET-999',
        licenseExpiry: new Date('2028-12-31'),
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.licenseNumber).toBeUndefined();
      expect(res.body.data.user.licenseExpiry).toBeUndefined();
    });

    it('should reject attempts to update driverVerified via PATCH /api/v1/users/me (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ driverVerified: true });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject attempts to add DRIVER to roles via PATCH /api/v1/users/me (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockUserId);
      const res = await request(testApp)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ roles: [UserRole.DRIVER] });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });
});
