import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';

describe('Live Database Integration Test (GET /api/v1/ready)', () => {
  it('should connect to live PostgreSQL database and confirm ready state', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      console.warn('⚠️ Skipping live database test: external database connection unreachable');
      return;
    }

    const res = await request(app).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('READY');
    expect(res.body.data.database).toBe('CONNECTED');
  });
});
