import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import { z } from 'zod';
import { app } from '../src/app.js';
import { validateEnv } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { BadRequestError } from '../src/utils/errors.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requestIdMiddleware } from '../src/middleware/requestId.js';

describe('Rydora Shared Foundation Test Suite', () => {
  afterEach(() => {
    // Restore all spies and mocks after each test to ensure test isolation
    vi.restoreAllMocks();
  });

  describe('C5 & C8: Health Endpoint (GET /api/v1/health)', () => {
    it('should return HTTP 200 with standard success envelope and status UP', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: 'Service is healthy',
        data: {
          status: 'UP',
          service: 'rydora-backend',
        },
      });
      expect(typeof res.body.data.uptime).toBe('number');
      expect(typeof res.body.meta.requestId).toBe('string');
      expect(typeof res.body.meta.timestamp).toBe('string');
      expect(res.headers['x-request-id']).toBe(res.body.meta.requestId);
    });
  });

  describe('C9: Readiness Endpoint (GET /api/v1/ready) - Isolated Mock Tests', () => {
    it('should return HTTP 200 with database status CONNECTED when DB probe succeeds', async () => {
      // Mock the Prisma queryRaw query so unit tests do not depend on external database connectivity
      vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ 1: 1 }]);

      const res = await request(app).get('/api/v1/ready');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        statusCode: 200,
        data: {
          status: 'READY',
          database: 'CONNECTED',
        },
      });
      expect(res.body.meta.requestId).toBeDefined();
    });

    it('should return HTTP 503 SERVICE_UNAVAILABLE when database query fails', async () => {
      vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection refused'));

      const res = await request(app).get('/api/v1/ready');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 503,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database connection failed or is not ready',
        },
      });
      expect(res.body.meta.requestId).toBeDefined();
    });
  });

  describe('C3: Environment Validation (src/config/env.ts)', () => {
    it('should fail when required variables DATABASE_URL or JWT_SECRET are missing', () => {
      expect(() => validateEnv({})).toThrow(/Invalid environment configuration/);
    });

    it('should fail when JWT_SECRET is shorter than 32 characters', () => {
      expect(() =>
        validateEnv({
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          JWT_SECRET: 'short-secret-under-32-chars',
        })
      ).toThrow(/JWT_SECRET must be at least 32 characters long/);
    });

    it('should succeed with valid inputs and supply defaults for PORT, NODE_ENV and CORS_ORIGIN', () => {
      const config = validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'super-secure-token-12345-at-least-32-chars-long',
      });

      expect(config.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
      expect(config.JWT_SECRET).toBe('super-secure-token-12345-at-least-32-chars-long');
      expect(config.PORT).toBe(5000);
      expect(config.NODE_ENV).toBe('development');
      expect(config.CORS_ORIGIN).toBe('*');
    });
  });

  describe('Request ID Handling (src/middleware/requestId.ts)', () => {
    it('should propagate incoming x-request-id in response header and body meta', async () => {
      const customId = 'client-custom-req-id-999';
      const res = await request(app).get('/api/v1/health').set('x-request-id', customId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.body.meta.requestId).toBe(customId);
    });

    it('should generate a valid UUID when x-request-id is omitted', async () => {
      const res = await request(app).get('/api/v1/health');

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(res.headers['x-request-id']).toMatch(uuidRegex);
      expect(res.body.meta.requestId).toMatch(uuidRegex);
    });
  });

  describe('CORS Configuration (src/app.ts)', () => {
    it('should correctly configure CORS headers for incoming origin', async () => {
      const res = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(204);
      // Ensure wildcard does not return credentials header, or explicit origin does
      if (res.headers['access-control-allow-origin'] === '*') {
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      } else {
        expect(res.headers['access-control-allow-credentials']).toBe('true');
      }
    });
  });

  describe('Invalid Request Handling (404 Not Found)', () => {
    it('should return standard ApiErrorResponse with 404 for nonexistent routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent-endpoint');

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 404,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('Cannot GET /api/v1/nonexistent-endpoint'),
          details: null,
        },
      });
      expect(res.body.meta.requestId).toBeDefined();
      expect(res.body.meta.timestamp).toBeDefined();
    });
  });

  describe('C6: Centralized Error Handler (src/middleware/errorHandler.ts)', () => {
    // Dedicated isolated test application to avoid mutating the shared apiV1Router
    let testApp: Application;

    beforeEach(() => {
      testApp = express();
      testApp.use(express.json());
      testApp.use(requestIdMiddleware);

      // Route that throws an operational AppError
      testApp.get('/test-app-error', () => {
        throw new BadRequestError('Invalid query filters', [
          { field: 'seatCount', message: 'Must be greater than 0' },
        ]);
      });

      // Route that triggers a Zod schema validation error
      testApp.post('/test-zod-error', (req) => {
        const schema = z.object({
          email: z.string().email(),
          seats: z.number().min(1),
        });
        schema.parse(req.body);
      });

      // Mount error handler directly on test application
      testApp.use(errorHandler);
    });

    it('should map AppError and its details to structured error response', async () => {
      const res = await request(testApp).get('/test-app-error');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 400,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query filters',
          details: [{ field: 'seatCount', message: 'Must be greater than 0' }],
        },
      });
      expect(res.body.meta.requestId).toBeDefined();
    });

    it('should map ZodError to HTTP 422 UNPROCESSABLE_ENTITY with field details', async () => {
      const res = await request(testApp)
        .post('/test-zod-error')
        .send({ email: 'not-an-email', seats: 0 });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 422,
        error: {
          code: 'UNPROCESSABLE_ENTITY',
          message: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
            expect.objectContaining({ field: 'seats' }),
          ]),
        },
      });
      expect(res.body.meta.requestId).toBeDefined();
    });
  });
});
