import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { communityService } from '../../src/services/community.service.js';
import { ConflictError } from '../../src/utils/errors.js';

const mockUserId = '11111111-2222-3333-4444-555555555555';

const mockDbUser = {
  userId: mockUserId,
  name: 'Badal Khandelwal',
  email: 'badal@srmist.edu.in',
  phone: '+919876543210',
  roles: ['USER'],
  profileImage: null,
  licenseNumber: null,
  licenseExpiry: null,
  driverVerified: false,
  walletBalance: '0.00',
  averageRating: '0.00',
  ratingCount: 0,
  createdAt: new Date('2026-11-21T10:00:00.000Z'),
  updatedAt: new Date('2026-11-21T10:00:00.000Z'),
};

function generateValidToken(userId: string = mockUserId): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
}

describe('Community Creation Controller & Route Test Suite (M3.3: POST /api/v1/communities)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validPayload = {
    name: 'SRM Institute of Science and Technology',
    domain: 'srmist.edu.in',
    description: 'Official campus carpooling community',
  };

  const mockCreatedCommunity = {
    communityId: '99999999-8888-7777-6666-555555555555',
    name: 'SRM Institute of Science and Technology',
    domain: 'srmist.edu.in',
    description: 'Official campus carpooling community',
    status: 'ACTIVE' as const,
    createdById: mockUserId,
    createdAt: new Date('2026-11-21T10:00:00.000Z'),
    updatedAt: new Date('2026-11-21T10:00:00.000Z'),
    membersCount: 1,
  };

  it('1. should return HTTP 201 with success envelope when creating a community with valid data', async () => {
    // 1. Mock authenticate middleware DB lookup
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);
    // 2. Mock service creation
    vi.spyOn(communityService, 'createCommunity').mockResolvedValueOnce(mockCreatedCommunity);

    const token = generateValidToken();
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(201);
    expect(res.body.message).toMatch(/community created successfully/i);
    expect(res.body.data.community).toBeDefined();
    expect(res.body.data.community.communityId).toBe(mockCreatedCommunity.communityId);
    expect(res.body.data.community.name).toBe(validPayload.name);
    expect(res.body.data.community.domain).toBe('srmist.edu.in');
    expect(res.body.data.community.membersCount).toBe(1);
  });

  it('2. should pass the authenticated user ID and validated data to communityService.createCommunity', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);
    const serviceSpy = vi
      .spyOn(communityService, 'createCommunity')
      .mockResolvedValueOnce(mockCreatedCommunity);

    const token = generateValidToken();
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '   SRM Institute of Science and Technology   ',
        domain: '   SRMIST.EDU.IN   ',
        description: '   Official campus carpooling community   ',
      });

    expect(res.status).toBe(201);
    expect(serviceSpy).toHaveBeenCalledWith(mockUserId, {
      name: 'SRM Institute of Science and Technology',
      domain: 'srmist.edu.in',
      description: 'Official campus carpooling community',
    });
  });

  it('3. should return HTTP 401 UNAUTHORIZED when Authorization header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/communities')
      .send(validPayload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('4. should return HTTP 401 UNAUTHORIZED when Bearer token is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', 'Bearer invalid-token-string')
      .send(validPayload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('5. should return HTTP 422 UNPROCESSABLE_ENTITY when required fields are missing', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

    const token = generateValidToken();
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'name' }),
        expect.objectContaining({ field: 'domain' }),
      ])
    );
  });

  it('6. should return HTTP 422 UNPROCESSABLE_ENTITY when domain format is invalid', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

    const token = generateValidToken();
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Invalid Domain Campus',
        domain: 'http://not-a-domain.edu/path',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(res.body.error.details[0].field).toBe('domain');
  });

  it('7. should reject request with HTTP 422 when client attempts to inject creatorUserId or userId', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);

    const token = generateValidToken();
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'SRMIST',
        domain: 'srmist.edu.in',
        createdById: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('8. should return HTTP 409 CONFLICT when communityService throws ConflictError (e.g. duplicate domain)', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);
    vi.spyOn(communityService, 'createCommunity').mockRejectedValueOnce(
      new ConflictError('A community with this email domain already exists', [
        { field: 'domain', message: 'Domain is already registered' },
      ])
    );

    const token = generateValidToken();
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  it('9. should return HTTP 500 when communityService throws an unexpected error', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDbUser as any);
    vi.spyOn(communityService, 'createCommunity').mockRejectedValueOnce(
      new Error('PostgreSQL unexpected failure')
    );

    const token = generateValidToken();
    const res = await request(app)
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.meta.requestId).toBeDefined();
  });

  it('10. should ensure existing API routes (/health, /ready, /auth/signup) continue working', async () => {
    const healthRes = await request(app).get('/api/v1/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.data.status).toBe('UP');

    const authRes = await request(app).post('/api/v1/auth/signup').send({});
    expect(authRes.status).toBe(422);
    expect(authRes.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });
});

describe('Community Listing Controller & Route Test Suite (M3.5: GET /api/v1/communities)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockCommunityDate = new Date('2026-11-21T10:00:00.000Z');

  const mockCommunityList = [
    {
      communityId: '11111111-1111-1111-1111-111111111111',
      name: 'SRM Institute of Science and Technology',
      domain: 'srmist.edu.in',
      description: 'Main campus community',
      status: 'ACTIVE' as const,
      createdById: '00000000-0000-0000-0000-000000000000',
      createdAt: mockCommunityDate,
      updatedAt: mockCommunityDate,
      membersCount: 42,
    },
    {
      communityId: '22222222-2222-2222-2222-222222222222',
      name: 'IIT Madras',
      domain: 'iitm.ac.in',
      description: 'IITM campus pool',
      status: 'ACTIVE' as const,
      createdById: '00000000-0000-0000-0000-000000000000',
      createdAt: mockCommunityDate,
      updatedAt: mockCommunityDate,
      membersCount: 15,
    },
  ];

  it('1. should return HTTP 200 with empty list and default pagination meta when no communities exist', async () => {
    vi.spyOn(communityService, 'getCommunities').mockResolvedValueOnce({
      communities: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    const res = await request(app).get('/api/v1/communities');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.message).toBe('Communities retrieved successfully');
    expect(res.body.data.communities).toEqual([]);
    expect(res.body.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('2. should return HTTP 200 with retrieved communities and pagination metadata', async () => {
    vi.spyOn(communityService, 'getCommunities').mockResolvedValueOnce({
      communities: mockCommunityList,
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const res = await request(app).get('/api/v1/communities');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.communities).toHaveLength(2);
    expect(res.body.data.communities[0].name).toBe('SRM Institute of Science and Technology');
    expect(res.body.data.communities[0].membersCount).toBe(42);
    expect(res.body.meta.pagination.total).toBe(2);
  });

  it('3. should coerce page and limit query strings to numbers and forward to service', async () => {
    const serviceSpy = vi.spyOn(communityService, 'getCommunities').mockResolvedValueOnce({
      communities: [mockCommunityList[0]],
      pagination: {
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      },
    });

    const res = await request(app).get('/api/v1/communities?page=2&limit=5');

    expect(res.status).toBe(200);
    expect(serviceSpy).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
    });
    expect(res.body.meta.pagination.page).toBe(2);
    expect(res.body.meta.pagination.limit).toBe(5);
  });

  it('4. should correctly forward domain filter query parameter', async () => {
    const serviceSpy = vi.spyOn(communityService, 'getCommunities').mockResolvedValueOnce({
      communities: [mockCommunityList[0]],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const res = await request(app).get('/api/v1/communities?domain=SRMIST.EDU.IN');

    expect(res.status).toBe(200);
    expect(serviceSpy).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      domain: 'srmist.edu.in',
    });
  });

  it('5. should correctly forward search query parameter', async () => {
    const serviceSpy = vi.spyOn(communityService, 'getCommunities').mockResolvedValueOnce({
      communities: [mockCommunityList[1]],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const res = await request(app).get('/api/v1/communities?search=Madras');

    expect(res.status).toBe(200);
    expect(serviceSpy).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      search: 'Madras',
    });
  });

  it('6. should reject invalid page <= 0 with HTTP 422', async () => {
    const res = await request(app).get('/api/v1/communities?page=0');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('7. should reject non-numeric page with HTTP 422', async () => {
    const res = await request(app).get('/api/v1/communities?page=invalid');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('8. should reject limit exceeding 100 with HTTP 422', async () => {
    const res = await request(app).get('/api/v1/communities?limit=150');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('9. should reject limit < 1 with HTTP 422', async () => {
    const res = await request(app).get('/api/v1/communities?limit=0');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('10. should reject unexpected query parameters with HTTP 422 due to strict schema', async () => {
    const res = await request(app).get('/api/v1/communities?injectedField=malicious');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('11. should return HTTP 500 when communityService throws an unexpected error', async () => {
    vi.spyOn(communityService, 'getCommunities').mockRejectedValueOnce(
      new Error('PostgreSQL unexpected disconnect')
    );

    const res = await request(app).get('/api/v1/communities');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.meta.requestId).toBeDefined();
  });

  it('12. should allow optional authentication headers on public listing endpoint', async () => {
    vi.spyOn(communityService, 'getCommunities').mockResolvedValueOnce({
      communities: mockCommunityList,
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const token = generateValidToken();
    const res = await request(app)
      .get('/api/v1/communities')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.communities).toHaveLength(2);
  });

  it('13. should ensure community listing response does not expose sensitive fields', async () => {
    vi.spyOn(communityService, 'getCommunities').mockResolvedValueOnce({
      communities: mockCommunityList,
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const res = await request(app).get('/api/v1/communities');

    expect(res.status).toBe(200);
    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toMatch(/password/i);
    expect(bodyString).not.toMatch(/hash/i);
    expect(bodyString).not.toMatch(/salt/i);
  });
});
