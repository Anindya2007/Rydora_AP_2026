import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRouter } from '../../src/routes/auth.routes.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requestIdMiddleware } from '../../src/middleware/requestId.js';

// Construct isolated test application mounting authRouter and foundation middleware
function createTestApp(): Application {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  app.use(errorHandler);
  return app;
}

const testApp = createTestApp();

const mockUser = {
  userId: '11111111-2222-3333-4444-555555555555',
  name: 'Badal Khandelwal',
  email: 'badal@srmist.edu.in',
  phone: '+919876543210',
  passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF1234567890abcdefghijklm', // valid placeholder bcrypt
  roles: ['USER'],
  profileImage: null,
  driverVerified: false,
  licenseNumber: null,
  licenseExpiry: null,
  walletBalance: { toString: () => '0.00' },
  averageRating: { toString: () => '0.00' },
  ratingCount: 0,
  createdAt: new Date('2026-11-19T10:00:00.000Z'),
  updatedAt: new Date('2026-11-19T10:00:00.000Z'),
};

describe('Rydora Authentication & User Management Test Suite (Milestone 2 - Phase 1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Successful Signup (POST /api/v1/auth/signup)', () => {
    it('should register a new user, return HTTP 201, sanitized user and a 24h JWT', async () => {
      // Mock duplicate check returning null
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      // Mock user creation in Prisma
      vi.spyOn(prisma.user, 'create').mockResolvedValueOnce(mockUser as any);

      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Badal Khandelwal',
        email: 'badal@srmist.edu.in',
        password: 'SecurePassword123!',
        phone: '+919876543210',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.userId).toBe(mockUser.userId);
      expect(res.body.data.user.email).toBe(mockUser.email);
      expect(res.body.data.user.roles).toEqual(['USER']);
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe('string');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('2. Email Normalization', () => {
    it('should trim and lowercase email before checking uniqueness and storing in database', async () => {
      const findSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const createSpy = vi.spyOn(prisma.user, 'create').mockResolvedValueOnce(mockUser as any);

      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Badal Khandelwal',
        email: '  BADAL.K@SRMIST.EDU.IN   ',
        password: 'SecurePassword123!',
      });

      expect(res.status).toBe(201);

      // Verify email checked for duplicates was normalized
      expect(findSpy).toHaveBeenCalledWith({
        where: { email: 'badal.k@srmist.edu.in' },
        select: { userId: true },
      });

      // Verify email persisted in Prisma was normalized
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'badal.k@srmist.edu.in',
          }),
        })
      );
    });
  });

  describe('3. Duplicate Email Rejection', () => {
    it('should return HTTP 409 Conflict when the email is already registered', async () => {
      // Mock existing user found by email
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: 'existing-user-uuid',
      } as any);

      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Another User',
        email: 'badal@srmist.edu.in',
        password: 'Password123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/email already exists/i);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email', message: expect.any(String) }),
        ])
      );
    });
  });

  describe('4. Duplicate Phone Rejection', () => {
    it('should return HTTP 409 Conflict when the phone number is already registered', async () => {
      // First check (email): not found; Second check (phone): found
      vi.spyOn(prisma.user, 'findUnique')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: 'existing-phone-uuid' } as any);

      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Another User',
        email: 'newemail@srmist.edu.in',
        password: 'Password123!',
        phone: '+919876543210',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/phone number already exists/i);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'phone', message: expect.any(String) }),
        ])
      );
    });
  });

  describe('5. Password Hashing (bcryptjs with 10 salt rounds)', () => {
    it('should hash the password with bcryptjs and never persist plaintext password', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const createSpy = vi.spyOn(prisma.user, 'create').mockResolvedValueOnce(mockUser as any);

      const plainPassword = 'SuperSecretPassword2026!';

      await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Badal Khandelwal',
        email: 'badal@srmist.edu.in',
        password: plainPassword,
      });

      const createCall = createSpy.mock.calls[0][0];
      const storedHash = createCall.data.passwordHash;

      // Stored value must not equal plain password
      expect(storedHash).not.toBe(plainPassword);
      // Valid bcrypt hash format
      expect(storedHash).toMatch(/^\$2[aby]\$10\$/);
      // bcrypt.compare must verify the plain password against the stored hash
      const isValid = await bcrypt.compare(plainPassword, storedHash);
      expect(isValid).toBe(true);
    });
  });

  describe('6. Successful Login (POST /api/v1/auth/login)', () => {
    it('should authenticate user with valid credentials, return HTTP 200, sanitized user and a JWT', async () => {
      const rawPassword = 'ValidLoginPassword123!';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockUser,
        passwordHash: hashedPassword,
      } as any);

      const res = await request(testApp).post('/api/v1/auth/login').send({
        email: 'BADAL@srmist.edu.in',
        password: rawPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.userId).toBe(mockUser.userId);
      expect(res.body.data.token).toBeDefined();
    });
  });

  describe('7. Invalid Email/Password Generic Error', () => {
    it('should return identical HTTP 401 UNAUTHORIZED message when email is not found', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

      const res = await request(testApp).post('/api/v1/auth/login').send({
        email: 'nonexistent@srmist.edu.in',
        password: 'SomePassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should return identical HTTP 401 UNAUTHORIZED message when password is wrong', async () => {
      const validHash = await bcrypt.hash('CorrectPassword123!', 10);

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockUser,
        passwordHash: validHash,
      } as any);

      const res = await request(testApp).post('/api/v1/auth/login').send({
        email: 'badal@srmist.edu.in',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('8. JWT Subject (sub) and 24-Hour Expiration', () => {
    it('should sign a JWT with sub equal to userId and an expiration duration of 24 hours', async () => {
      const rawPassword = 'ValidLoginPassword123!';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockUser,
        passwordHash: hashedPassword,
      } as any);

      const res = await request(testApp).post('/api/v1/auth/login').send({
        email: 'badal@srmist.edu.in',
        password: rawPassword,
      });

      const token = res.body.data.token;
      expect(token).toBeDefined();

      // Verify signature with secret
      const verified = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;

      // Subject must be the user ID
      expect(verified.sub).toBe(mockUser.userId);
      expect(verified.email).toBe(mockUser.email);
      expect(verified.roles).toEqual(['USER']);

      // 24 hours in seconds = 86400 seconds
      expect(verified.exp).toBeDefined();
      expect(verified.iat).toBeDefined();
      const durationSeconds = verified.exp! - verified.iat!;
      expect(durationSeconds).toBe(86400); // exactly 24 hours
    });
  });

  describe('9. Password Hash Exposure Prevention (Signup)', () => {
    it('should never expose passwordHash or password in signup response payload', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.user, 'create').mockResolvedValueOnce(mockUser as any);

      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Badal Khandelwal',
        email: 'badal@srmist.edu.in',
        password: 'SecurePassword123!',
      });

      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();

      const rawResponseString = JSON.stringify(res.body);
      expect(rawResponseString).not.toContain('passwordHash');
      expect(rawResponseString).not.toContain('password_hash');
    });
  });

  describe('10. Password Hash Exposure Prevention (Login)', () => {
    it('should never expose passwordHash or password in login response payload', async () => {
      const rawPassword = 'ValidLoginPassword123!';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockUser,
        passwordHash: hashedPassword,
      } as any);

      const res = await request(testApp).post('/api/v1/auth/login').send({
        email: 'badal@srmist.edu.in',
        password: rawPassword,
      });

      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();

      const rawResponseString = JSON.stringify(res.body);
      expect(rawResponseString).not.toContain('passwordHash');
      expect(rawResponseString).not.toContain('password_hash');
    });
  });

  describe('11. Missing, Invalid, and Disallowed Request Fields', () => {
    it('should return HTTP 422 UNPROCESSABLE_ENTITY when email is missing', async () => {
      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Badal Khandelwal',
        password: 'SecurePassword123!',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return HTTP 422 UNPROCESSABLE_ENTITY when email format is invalid', async () => {
      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Badal Khandelwal',
        email: 'not-an-email',
        password: 'SecurePassword123!',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return HTTP 422 UNPROCESSABLE_ENTITY when password is shorter than 8 characters', async () => {
      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Badal Khandelwal',
        email: 'badal@srmist.edu.in',
        password: 'short',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return HTTP 422 UNPROCESSABLE_ENTITY when client attempts privilege escalation via disallowed fields', async () => {
      const res = await request(testApp).post('/api/v1/auth/signup').send({
        name: 'Badal Khandelwal',
        email: 'badal@srmist.edu.in',
        password: 'SecurePassword123!',
        roles: ['DRIVER'], // Disallowed!
        driverVerified: true, // Disallowed!
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return HTTP 422 UNPROCESSABLE_ENTITY when login password is missing', async () => {
      const res = await request(testApp).post('/api/v1/auth/login').send({
        email: 'badal@srmist.edu.in',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });
});
