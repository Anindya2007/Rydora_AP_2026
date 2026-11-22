import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireRoles } from '../../src/middleware/rbac.js';
import { authenticate } from '../../src/middleware/auth.js';
import { UserRole } from '../../src/generated/prisma/client.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requestIdMiddleware } from '../../src/middleware/requestId.js';
import { UnauthorizedError, ForbiddenError } from '../../src/utils/errors.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import type { AuthenticatedUser } from '../../src/middleware/auth.js';

/**
 * Helper to build an AuthenticatedUser mock.
 */
function createMockUser(roles: UserRole[]): AuthenticatedUser {
  return {
    userId: '11111111-2222-3333-4444-555555555555',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+919876543210',
    roles,
    profileImage: null,
    licenseNumber: null,
    licenseExpiry: null,
    driverVerified: false,
    walletBalance: '0.00',
    averageRating: '5.00',
    ratingCount: 0,
    createdAt: new Date('2026-11-20T10:00:00.000Z'),
    updatedAt: new Date('2026-11-20T10:00:00.000Z'),
  };
}

/**
 * Builds an isolated Express test application with routes guarded by requireRoles.
 */
function createRbacTestApp(): Application {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(express.json());

  // 1. DRIVER-only route
  app.get(
    '/api/v1/driver-only',
    requireRoles(UserRole.DRIVER),
    (_req: Request, res: Response) => {
      res.status(200).json({ success: true, message: 'Driver access granted' });
    }
  );

  // 2. USER-or-DRIVER multi-role route
  app.get(
    '/api/v1/multi-role',
    requireRoles(UserRole.USER, UserRole.DRIVER),
    (_req: Request, res: Response) => {
      res.status(200).json({ success: true, message: 'Multi-role access granted' });
    }
  );

  // 3. Misconfigured empty allowedRoles route (fail safe test)
  app.get(
    '/api/v1/misconfigured',
    requireRoles(),
    (_req: Request, res: Response) => {
      res.status(200).json({ success: true, message: 'Should never reach here' });
    }
  );

  app.use(errorHandler);
  return app;
}

describe('Rydora RBAC Middleware Test Suite (Milestone 4.2 & 4.4)', () => {
  const app = createRbacTestApp();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Missing Authentication Context (req.user is undefined)', () => {
    it('should return HTTP 401 UNAUTHORIZED when req.user is missing', async () => {
      // Simulates calling a route where authenticate middleware was not executed first
      const res = await request(app).get('/api/v1/driver-only');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Authentication required');
    });
  });

  describe('2. Single Role Enforcement (DRIVER-only route)', () => {
    it('should return HTTP 403 FORBIDDEN when user has only USER role attempting DRIVER-only route', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      // Inject user with USER role only
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([UserRole.USER]);
        next();
      });
      mockApp.get('/api/v1/driver-only', requireRoles(UserRole.DRIVER), (_req, res) => {
        res.status(200).json({ success: true });
      });
      mockApp.use(errorHandler);

      const res = await request(mockApp).get('/api/v1/driver-only');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Forbidden: Insufficient permissions');
    });

    it('should call next() and return HTTP 200 when user has DRIVER role on DRIVER-only route', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([UserRole.DRIVER]);
        next();
      });
      mockApp.get('/api/v1/driver-only', requireRoles(UserRole.DRIVER), (_req, res) => {
        res.status(200).json({ success: true, message: 'Driver access granted' });
      });
      mockApp.use(errorHandler);

      const res = await request(mockApp).get('/api/v1/driver-only');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Driver access granted');
    });

    it('should call next() and return HTTP 200 when user has both USER and DRIVER roles', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([UserRole.USER, UserRole.DRIVER]);
        next();
      });
      mockApp.get('/api/v1/driver-only', requireRoles(UserRole.DRIVER), (_req, res) => {
        res.status(200).json({ success: true, message: 'Driver access granted' });
      });
      mockApp.use(errorHandler);

      const res = await request(mockApp).get('/api/v1/driver-only');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Driver access granted');
    });
  });

  describe('3. Multi-Role Route Access (Route allows USER or DRIVER)', () => {
    it('should allow access to a user with USER role', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([UserRole.USER]);
        next();
      });
      mockApp.get(
        '/api/v1/multi-role',
        requireRoles(UserRole.USER, UserRole.DRIVER),
        (_req, res) => {
          res.status(200).json({ success: true, message: 'Multi-role access granted' });
        }
      );
      mockApp.use(errorHandler);

      const res = await request(mockApp).get('/api/v1/multi-role');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Multi-role access granted');
    });

    it('should allow access to a user with DRIVER role', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([UserRole.DRIVER]);
        next();
      });
      mockApp.get(
        '/api/v1/multi-role',
        requireRoles(UserRole.USER, UserRole.DRIVER),
        (_req, res) => {
          res.status(200).json({ success: true, message: 'Multi-role access granted' });
        }
      );
      mockApp.use(errorHandler);

      const res = await request(mockApp).get('/api/v1/multi-role');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Multi-role access granted');
    });
  });

  describe('4. Edge Cases & Fail-Safe Behavior', () => {
    it('should return HTTP 403 FORBIDDEN when user roles array is empty', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([]);
        next();
      });
      mockApp.get('/api/v1/driver-only', requireRoles(UserRole.DRIVER), (_req, res) => {
        res.status(200).json({ success: true });
      });
      mockApp.use(errorHandler);

      const res = await request(mockApp).get('/api/v1/driver-only');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Forbidden: Insufficient permissions');
    });

    it('should fail safely with HTTP 403 FORBIDDEN when allowedRoles configuration is empty', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([UserRole.DRIVER, UserRole.USER]);
        next();
      });
      mockApp.get('/api/v1/misconfigured', requireRoles(), (_req, res) => {
        res.status(200).json({ success: true });
      });
      mockApp.use(errorHandler);

      const res = await request(mockApp).get('/api/v1/misconfigured');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Forbidden: Insufficient permissions');
    });

    it('should NOT trust spoofed roles in request body, query parameters, or headers', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([UserRole.USER]); // Authentic DB role
        next();
      });
      mockApp.post('/api/v1/driver-only', requireRoles(UserRole.DRIVER), (_req, res) => {
        res.status(200).json({ success: true });
      });
      mockApp.use(errorHandler);

      // Attempt role spoofing via body, query parameter, and custom header
      const res = await request(mockApp)
        .post('/api/v1/driver-only?role=DRIVER&roles=DRIVER')
        .set('x-role', 'DRIVER')
        .set('x-user-roles', 'DRIVER')
        .send({ role: 'DRIVER', roles: ['DRIVER'] });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Forbidden: Insufficient permissions');
    });
  });

  describe('5. Error Response Contract Conformance', () => {
    it('should strictly match the standardized API error structure on 403', async () => {
      const mockApp = express();
      mockApp.use(requestIdMiddleware);
      mockApp.use(express.json());
      mockApp.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = createMockUser([UserRole.USER]);
        next();
      });
      mockApp.get('/api/v1/driver-only', requireRoles(UserRole.DRIVER), (_req, res) => {
        res.status(200).json({ success: true });
      });
      mockApp.use(errorHandler);

      const res = await request(mockApp).get('/api/v1/driver-only');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('statusCode', 403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Forbidden: Insufficient permissions',
      });
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('requestId');
    });
  });

  describe('6. Direct Middleware Unit Invocations', () => {
    it('should pass UnauthorizedError to next() when req.user is undefined', () => {
      const middleware = requireRoles(UserRole.DRIVER);
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('UNAUTHORIZED');
    });

    it('should pass ForbiddenError to next() when user has insufficient roles', () => {
      const middleware = requireRoles(UserRole.DRIVER);
      const req = { user: createMockUser([UserRole.USER]) } as Request;
      const res = {} as Response;
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    });

    it('should call next() with no arguments when user has the required role', () => {
      const middleware = requireRoles(UserRole.DRIVER);
      const req = { user: createMockUser([UserRole.DRIVER]) } as Request;
      const res = {} as Response;
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(); // No error passed
    });

    it('should pass ForbiddenError to next() when user.roles is null or undefined', () => {
      const middleware = requireRoles(UserRole.DRIVER);
      const req = { user: { ...createMockUser([]), roles: null as any } } as Request;
      const res = {} as Response;
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    });

    it('should never invoke next() without an error when access is denied', () => {
      const middleware = requireRoles(UserRole.DRIVER);
      const req = { user: createMockUser([UserRole.USER]) } as Request;
      const res = {} as Response;
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe('7. Chained Middleware Integration (authenticate → requireRoles → controller)', () => {
    const validUserId = '22222222-3333-4444-5555-666666666666';
    const mockController = vi.fn((_req: Request, res: Response) => {
      res.status(200).json({ success: true, message: 'Driver controller reached' });
    });

    function createChainedTestApp(): Application {
      const chainedApp = express();
      chainedApp.disable('x-powered-by');
      chainedApp.use(requestIdMiddleware);
      chainedApp.use(express.json());

      // Realistic route mounting authenticate followed by requireRoles
      chainedApp.get(
        '/api/v1/driver/secure-action',
        authenticate,
        requireRoles(UserRole.DRIVER),
        mockController
      );

      chainedApp.use(errorHandler);
      return chainedApp;
    }

    const chainedApp = createChainedTestApp();

    it('should reject unauthenticated request with 401 without executing requireRoles or controller', async () => {
      mockController.mockClear();

      const res = await request(chainedApp).get('/api/v1/driver/secure-action');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(mockController).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token with 401 without executing requireRoles or controller', async () => {
      mockController.mockClear();

      const res = await request(chainedApp)
        .get('/api/v1/driver/secure-action')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(mockController).not.toHaveBeenCalled();
    });

    it('should reject authenticated USER with 403 and never reach controller', async () => {
      mockController.mockClear();
      const validToken = jwt.sign({ sub: validUserId }, env.JWT_SECRET, { expiresIn: '1h' });

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validUserId,
        name: 'Normal User',
        email: 'user@example.com',
        phone: '+919876543211',
        roles: [UserRole.USER],
        profileImage: null,
        licenseNumber: null,
        licenseExpiry: null,
        driverVerified: false,
        walletBalance: '0.00',
        averageRating: '5.00',
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(chainedApp)
        .get('/api/v1/driver/secure-action')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Forbidden: Insufficient permissions');
      expect(mockController).not.toHaveBeenCalled();
    });

    it('should allow authenticated DRIVER to reach controller and return 200', async () => {
      mockController.mockClear();
      const validToken = jwt.sign({ sub: validUserId }, env.JWT_SECRET, { expiresIn: '1h' });

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validUserId,
        name: 'Verified Driver',
        email: 'driver@example.com',
        phone: '+919876543212',
        roles: [UserRole.DRIVER],
        profileImage: null,
        licenseNumber: 'DL1234567890',
        licenseExpiry: new Date('2030-01-01'),
        driverVerified: true,
        walletBalance: '50.00',
        averageRating: '4.90',
        ratingCount: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(chainedApp)
        .get('/api/v1/driver/secure-action')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Driver controller reached');
      expect(mockController).toHaveBeenCalledTimes(1);
    });

    it('should allow authenticated dual-role user (USER + DRIVER) to reach controller and return 200', async () => {
      mockController.mockClear();
      const validToken = jwt.sign({ sub: validUserId }, env.JWT_SECRET, { expiresIn: '1h' });

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validUserId,
        name: 'Dual Role User',
        email: 'dual@example.com',
        phone: '+919876543213',
        roles: [UserRole.USER, UserRole.DRIVER],
        profileImage: null,
        licenseNumber: 'DL9876543210',
        licenseExpiry: new Date('2030-01-01'),
        driverVerified: true,
        walletBalance: '100.00',
        averageRating: '4.95',
        ratingCount: 40,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(chainedApp)
        .get('/api/v1/driver/secure-action')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Driver controller reached');
      expect(mockController).toHaveBeenCalledTimes(1);
    });
  });
});
