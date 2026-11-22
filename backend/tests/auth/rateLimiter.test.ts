import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import { createAuthRateLimiter, authRateLimiter } from '../../src/middleware/rateLimiter.js';
import { requestIdMiddleware } from '../../src/middleware/requestId.js';

describe('Authentication Rate Limiter Middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should skip rate limiting when NODE_ENV is test (default authRateLimiter)', async () => {
    const app: Application = express();
    app.use(requestIdMiddleware);
    app.use(authRateLimiter);
    app.post('/test-login', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // Send 15 requests consecutively (default limit is 10)
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/test-login');
      expect(res.status).toBe(200);
    }
  });

  it('2. should enforce rate limits and respond with standard 429 ApiErrorResponse when limit is breached', async () => {
    const strictLimiter = createAuthRateLimiter({
      limit: 3,
      windowMs: 60 * 1000,
      skip: () => false, // explicitly enable enforcement
    });

    const app: Application = express();
    app.use(requestIdMiddleware);
    app.post('/test-auth', strictLimiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // First 3 requests must succeed
    for (let i = 1; i <= 3; i++) {
      const res = await request(app).post('/test-auth');
      expect(res.status).toBe(200);
    }

    // 4th request must be rate-limited with HTTP 429
    const blockedRes = await request(app).post('/test-auth');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body).toEqual({
      success: false,
      statusCode: 429,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
        details: null,
      },
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it('3. should include standard draft-8 rate limit headers', async () => {
    const strictLimiter = createAuthRateLimiter({
      limit: 5,
      windowMs: 60 * 1000,
      skip: () => false,
    });

    const app: Application = express();
    app.use(requestIdMiddleware);
    app.post('/test-headers', strictLimiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app).post('/test-headers');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit']).toBeDefined();
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });
});
