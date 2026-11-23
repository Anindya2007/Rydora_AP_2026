import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { UserRole } from '../../src/generated/prisma/client.js';

describe('Milestone 8.1: Emergency Contact Management API (/api/v1/emergency-contacts)', () => {
  const mockUserId = '11111111-2222-3333-4444-555555555555';
  const mockOtherUserId = '22222222-3333-4444-5555-666666666666';
  const mockContactId = '33333333-4444-5555-6666-777777777777';
  const mockOtherContactId = '44444444-5555-6666-7777-888888888888';

  const mockTimestamp = new Date('2026-11-23T10:00:00.000Z');

  const mockDbUser = {
    userId: mockUserId,
    name: 'Aarav Patel',
    email: 'aarav@rydora.in',
    phone: '+919876543210',
    roles: [UserRole.USER],
    profileImage: null,
    licenseNumber: null,
    licenseExpiry: null,
    driverVerified: false,
    walletBalance: '500.00',
    averageRating: '4.80',
    ratingCount: 5,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockOtherDbUser = {
    userId: mockOtherUserId,
    name: 'Sneha Rao',
    email: 'sneha@rydora.in',
    phone: '+919876543222',
    roles: [UserRole.USER],
    profileImage: null,
    licenseNumber: null,
    licenseExpiry: null,
    driverVerified: false,
    walletBalance: '0.00',
    averageRating: '5.00',
    ratingCount: 0,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockContact = {
    contactId: mockContactId,
    userId: mockUserId,
    name: 'Rajesh Patel',
    phone: '+919876500001',
    relationship: 'Father',
    isPrimary: true,
    createdAt: mockTimestamp,
  };

  const generateToken = (userId: string): string => {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return Promise.all(callback);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ADD EMERGENCY CONTACT (POST /api/v1/emergency-contacts)
  // =========================================================================
  describe('POST /api/v1/emergency-contacts', () => {
    it('should successfully add an emergency contact (201 Created)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.emergencyContact, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.emergencyContact, 'updateMany').mockResolvedValue({ count: 0 });
      vi.spyOn(prisma.emergencyContact, 'create').mockResolvedValue(mockContact as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rajesh Patel',
          phone: '+919876500001',
          relationship: 'Father',
          isPrimary: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Emergency contact added successfully');
      expect(res.body.data.contact).toEqual({
        contactId: mockContactId,
        userId: mockUserId,
        name: 'Rajesh Patel',
        phone: '+919876500001',
        relationship: 'Father',
        isPrimary: true,
        createdAt: mockTimestamp.toISOString(),
      });
    });

    it('should automatically set isPrimary: true for the users first contact when unspecified (201 Created)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.emergencyContact, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.emergencyContact, 'updateMany').mockResolvedValue({ count: 0 });
      const createSpy = vi.spyOn(prisma.emergencyContact, 'create').mockResolvedValue(mockContact as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rajesh Patel',
          phone: '+919876500001',
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPrimary: true,
          }),
        })
      );
    });

    it('should demote existing primary contact when adding a new contact with isPrimary: true', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.emergencyContact, 'findFirst').mockResolvedValue(null);
      const updateManySpy = vi
        .spyOn(prisma.emergencyContact, 'updateMany')
        .mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.emergencyContact, 'create').mockResolvedValue(mockContact as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rajesh Patel',
          phone: '+919876500001',
          isPrimary: true,
        });

      expect(res.status).toBe(201);
      expect(updateManySpy).toHaveBeenCalledWith({
        where: { userId: mockUserId, isPrimary: true },
        data: { isPrimary: false },
      });
    });

    it('should acquire row-level lock on owning user row via $queryRaw during contact creation to serialize requests', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.emergencyContact, 'findFirst').mockResolvedValue(null);
      const queryRawSpy = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);
      vi.spyOn(prisma.emergencyContact, 'create').mockResolvedValue(mockContact as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Serialized Contact',
          phone: '+919876500099',
        });

      expect(res.status).toBe(201);
      expect(queryRawSpy).toHaveBeenCalled();
    });

    it('should reject creation when maximum limit of 5 contacts is reached (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'count').mockResolvedValue(5);
      const createSpy = vi.spyOn(prisma.emergencyContact, 'create');

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sixth Contact',
          phone: '+919876500006',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot add more than 5 emergency contacts');
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should reject creation when a contact with the same phone already exists for user (409 Conflict)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.emergencyContact, 'findFirst').mockResolvedValue(mockContact as any);
      const createSpy = vi.spyOn(prisma.emergencyContact, 'create');

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Duplicate Phone Contact',
          phone: '+919876500001',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('phone number already exists');
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should handle Prisma P2002 unique constraint error on creation (409 Conflict)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.emergencyContact, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.emergencyContact, 'create').mockRejectedValue({
        code: 'P2002',
        meta: { target: ['user_id', 'phone'] },
      });

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Concurrent Duplicate Contact',
          phone: '+919876500001',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should reject missing required fields with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid phone format with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Invalid Phone',
          phone: 'abc1234',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject client attempts to inject unauthorized fields via strict schema (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Injected Contact',
          phone: '+919876500001',
          userId: mockOtherUserId, // attempt to assign to another user
          contactId: mockContactId,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/emergency-contacts')
        .send({
          name: 'Rajesh Patel',
          phone: '+919876500001',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 2. LIST EMERGENCY CONTACTS (GET /api/v1/emergency-contacts)
  // =========================================================================
  describe('GET /api/v1/emergency-contacts', () => {
    it('should retrieve list of emergency contacts for authenticated user (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockContact] as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Emergency contacts retrieved successfully');
      expect(res.body.data.contacts).toHaveLength(1);
      expect(res.body.data.contacts[0].contactId).toBe(mockContactId);
      expect(res.body.data.contacts[0].name).toBe('Rajesh Patel');
    });

    it('should return empty list when user has no emergency contacts (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/emergency-contacts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.contacts).toEqual([]);
    });

    it('should reject unauthenticated list request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/emergency-contacts');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 3. GET SINGLE EMERGENCY CONTACT (GET /api/v1/emergency-contacts/:contactId)
  // =========================================================================
  describe('GET /api/v1/emergency-contacts/:contactId', () => {
    it('should retrieve a single emergency contact by ID (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(mockContact as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.contact.contactId).toBe(mockContactId);
      expect(res.body.data.contact.name).toBe('Rajesh Patel');
    });

    it('should return 404 Not Found when contact does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject unauthorized user attempting to access another users contact (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(mockContact as any); // belongs to mockUserId

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('not authorized to access');
    });

    it('should reject invalid UUID format with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/emergency-contacts/invalid-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });

  // =========================================================================
  // 4. UPDATE EMERGENCY CONTACT (PATCH & PUT /api/v1/emergency-contacts/:contactId)
  // =========================================================================
  describe('PATCH & PUT /api/v1/emergency-contacts/:contactId', () => {
    const mockUpdatedContact = {
      ...mockContact,
      name: 'Rajesh K. Patel',
      relationship: 'Guardian',
    };

    it('should successfully update an emergency contact (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(mockContact as any);
      vi.spyOn(prisma.emergencyContact, 'update').mockResolvedValue(mockUpdatedContact as any);
      const queryRawSpy = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rajesh K. Patel',
          relationship: 'Guardian',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Emergency contact updated successfully');
      expect(res.body.data.contact.name).toBe('Rajesh K. Patel');
      expect(res.body.data.contact.relationship).toBe('Guardian');
      expect(queryRawSpy).toHaveBeenCalled();
    });

    it('should support PUT as an alias for updating an emergency contact (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(mockContact as any);
      vi.spyOn(prisma.emergencyContact, 'update').mockResolvedValue(mockUpdatedContact as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .put(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rajesh K. Patel',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Emergency contact updated successfully');
    });

    it('should demote other primary contacts when updating isPrimary to true (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue({
        ...mockContact,
        isPrimary: false,
      } as any);
      const updateManySpy = vi
        .spyOn(prisma.emergencyContact, 'updateMany')
        .mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.emergencyContact, 'update').mockResolvedValue({
        ...mockContact,
        isPrimary: true,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          isPrimary: true,
        });

      expect(res.status).toBe(200);
      expect(updateManySpy).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isPrimary: true,
          NOT: { contactId: mockContactId },
        },
        data: {
          isPrimary: false,
        },
      });
    });

    it('should reject unsetting isPrimary to false on currently primary contact (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue({
        ...mockContact,
        isPrimary: true,
      } as any);
      const updateSpy = vi.spyOn(prisma.emergencyContact, 'update');

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          isPrimary: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot unset primary contact');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should allow setting isPrimary to false on a contact that is already secondary (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue({
        ...mockContact,
        isPrimary: false,
      } as any);
      vi.spyOn(prisma.emergencyContact, 'update').mockResolvedValue({
        ...mockContact,
        isPrimary: false,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          isPrimary: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject updating phone to a number already held by another contact (409 Conflict)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(mockContact as any);
      vi.spyOn(prisma.emergencyContact, 'findFirst').mockResolvedValue({
        contactId: mockOtherContactId,
        userId: mockUserId,
        phone: '+919876500002',
      } as any);
      const updateSpy = vi.spyOn(prisma.emergencyContact, 'update');

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          phone: '+919876500002',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('phone number already exists');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should reject empty update body with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return 404 Not Found when updating a nonexistent contact', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject unauthorized user attempting to update another users contact (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(mockContact as any); // belongs to mockUserId

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .patch(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 5. DELETE EMERGENCY CONTACT (DELETE /api/v1/emergency-contacts/:contactId)
  // =========================================================================
  describe('DELETE /api/v1/emergency-contacts/:contactId', () => {
    it('should successfully delete an emergency contact (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue({
        ...mockContact,
        isPrimary: false,
      } as any);
      const deleteSpy = vi.spyOn(prisma.emergencyContact, 'delete').mockResolvedValue(mockContact as any);
      const queryRawSpy = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .delete(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Emergency contact deleted successfully');
      expect(deleteSpy).toHaveBeenCalledWith({
        where: { contactId: mockContactId },
      });
      expect(queryRawSpy).toHaveBeenCalled();
    });

    it('should promote the oldest remaining contact to primary when primary contact is deleted (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue({
        ...mockContact,
        isPrimary: true,
      } as any);
      vi.spyOn(prisma.emergencyContact, 'delete').mockResolvedValue(mockContact as any);
      vi.spyOn(prisma.emergencyContact, 'findFirst').mockResolvedValue({
        contactId: mockOtherContactId,
        userId: mockUserId,
        name: 'Second Contact',
        isPrimary: false,
        createdAt: mockTimestamp,
      } as any);
      const updateSpy = vi.spyOn(prisma.emergencyContact, 'update').mockResolvedValue({} as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .delete(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { contactId: mockOtherContactId },
        data: { isPrimary: true },
      });
    });

    it('should return 404 Not Found when deleting a nonexistent contact', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .delete(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject unauthorized user attempting to delete another users contact (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherDbUser as any);
      vi.spyOn(prisma.emergencyContact, 'findUnique').mockResolvedValue(mockContact as any); // belongs to mockUserId
      const deleteSpy = vi.spyOn(prisma.emergencyContact, 'delete');

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .delete(`/api/v1/emergency-contacts/${mockContactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated delete request with 401 Unauthorized', async () => {
      const res = await request(app).delete(`/api/v1/emergency-contacts/${mockContactId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
