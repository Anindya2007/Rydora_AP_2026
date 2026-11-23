import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import {
  UserRole,
  SOSAlertStatus,
  RideStatus,
  BookingStatus,
} from '../../src/generated/prisma/client.js';

describe('Milestone 8.2: SOS Activation & Emergency Event Lifecycle API (/api/v1/sos)', () => {
  const mockUserId = '11111111-2222-3333-4444-555555555555';
  const mockOtherUserId = '22222222-3333-4444-5555-666666666666';
  const mockAdminUserId = '99999999-9999-9999-9999-999999999999';
  const mockAlertId = '33333333-4444-5555-6666-777777777777';
  const mockRideId = '44444444-5555-6666-7777-888888888888';

  const mockTimestamp = new Date('2026-11-23T10:00:00.000Z');
  const mockResolvedTimestamp = new Date('2026-11-23T10:15:00.000Z');

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

  const mockAdminDbUser = {
    userId: mockAdminUserId,
    name: 'Admin User',
    email: 'admin@rydora.in',
    phone: '+919876500000',
    roles: ['ADMIN'],
    profileImage: null,
    licenseNumber: null,
    licenseExpiry: null,
    driverVerified: true,
    walletBalance: '1000.00',
    averageRating: '5.00',
    ratingCount: 10,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockEmergencyContacts = [
    {
      contactId: '55555555-5555-5555-5555-555555555555',
      userId: mockUserId,
      name: 'Rajesh Patel',
      phone: '+919876500001',
      relationship: 'Father',
      isPrimary: true,
      createdAt: mockTimestamp,
    },
    {
      contactId: '66666666-6666-6666-6666-666666666666',
      userId: mockUserId,
      name: 'Sunita Patel',
      phone: '+919876500002',
      relationship: 'Mother',
      isPrimary: false,
      createdAt: mockTimestamp,
    },
  ];

  const mockSOSAlert = {
    alertId: mockAlertId,
    userId: mockUserId,
    rideId: mockRideId,
    message: 'Medical emergency on highway',
    latitude: '28.613900',
    longitude: '77.209000',
    status: SOSAlertStatus.ACTIVE,
    createdAt: mockTimestamp,
    resolvedAt: null,
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
  // 1. SOS ALERT ACTIVATION (POST /api/v1/sos)
  // =========================================================================
  describe('POST /api/v1/sos', () => {
    it('should successfully activate an SOS alert with location, message and ride (201 Created)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        rideId: mockRideId,
        driverId: mockUserId,
        source: 'Connaught Place',
        destination: 'Noida Sector 62',
        status: RideStatus.SCHEDULED,
        bookings: [],
      } as any);
      vi.spyOn(prisma.sOSAlert, 'create').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue(mockEmergencyContacts as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rideId: mockRideId,
          message: 'Medical emergency on highway',
          latitude: 28.6139,
          longitude: 77.209,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('SOS alert activated successfully');
      expect(res.body.data.alert).toEqual({
        alertId: mockAlertId,
        userId: mockUserId,
        rideId: mockRideId,
        message: 'Medical emergency on highway',
        latitude: '28.613900',
        longitude: '77.209000',
        status: 'ACTIVE',
        createdAt: mockTimestamp.toISOString(),
        resolvedAt: null,
      });
      expect(res.body.data.contacts).toHaveLength(2);
      expect(res.body.data.ride).toEqual({
        rideId: mockRideId,
        source: 'Connaught Place',
        destination: 'Noida Sector 62',
        status: 'SCHEDULED',
      });
    });

    it('should successfully activate a standalone SOS alert without rideId or coordinates (201 Created)', async () => {
      const standaloneAlert = {
        alertId: mockAlertId,
        userId: mockUserId,
        rideId: null,
        message: null,
        latitude: null,
        longitude: null,
        status: SOSAlertStatus.ACTIVE,
        createdAt: mockTimestamp,
        resolvedAt: null,
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.sOSAlert, 'create').mockResolvedValue(standaloneAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.rideId).toBeNull();
      expect(res.body.data.alert.latitude).toBeNull();
      expect(res.body.data.alert.longitude).toBeNull();
      expect(res.body.data.contacts).toEqual([]);
      expect(res.body.data.ride).toBeNull();
    });

    it('should reject activation with 409 Conflict if user already has an active SOS alert', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(mockSOSAlert as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Another emergency' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('active SOS alert is already open');
    });

    it('should reject activation with 404 Not Found if specified rideId does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Ride not found');
    });

    it('should reject activation with 400 Bad Request if specified ride has CANCELLED status', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        rideId: mockRideId,
        driverId: mockUserId,
        source: 'Connaught Place',
        destination: 'Noida Sector 62',
        status: RideStatus.CANCELLED,
        bookings: [],
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('cancelled ride');
    });

    it('should reject activation with 400 Bad Request if specified ride has COMPLETED status', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        rideId: mockRideId,
        driverId: mockUserId,
        source: 'Connaught Place',
        destination: 'Noida Sector 62',
        status: RideStatus.COMPLETED,
        bookings: [],
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('completed ride');
    });

    it('should reject activation with 400 Bad Request if user is not a driver or passenger of the ride', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        rideId: mockRideId,
        driverId: mockOtherUserId, // Someone else is driver
        source: 'Connaught Place',
        destination: 'Noida Sector 62',
        status: RideStatus.SCHEDULED,
        bookings: [], // User has no bookings
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('not a participant');
    });

    it('should permit activation if user is a passenger with CONFIRMED booking on the ride', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        rideId: mockRideId,
        driverId: mockOtherUserId,
        source: 'Connaught Place',
        destination: 'Noida Sector 62',
        status: RideStatus.SCHEDULED,
        bookings: [
          {
            bookingId: '77777777-7777-7777-7777-777777777777',
            riderId: mockUserId,
            status: BookingStatus.CONFIRMED,
          },
        ],
      } as any);
      vi.spyOn(prisma.sOSAlert, 'create').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should acquire row-level lock on user row via $queryRaw during SOS activation to serialize concurrent requests', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);
      const queryRawSpy = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);
      vi.spyOn(prisma.sOSAlert, 'create').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(201);
      expect(queryRawSpy).toHaveBeenCalled();
    });

    it('should reject invalid coordinates (latitude out of range) with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ latitude: 120.5 }); // Max is 90

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid coordinates (longitude out of range) with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ longitude: -190.0 }); // Min is -180

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject malformed rideId UUID with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: 'not-a-uuid' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject messages exceeding 1000 characters with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'A'.repeat(1001) });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject unauthorized extra fields with 422 Unprocessable Entity (strict schema)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/sos')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'RESOLVED', fakeField: true });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return 401 Unauthorized if no token provided', async () => {
      const res = await request(app).post('/api/v1/sos').send({});
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. ACTIVE SOS RETRIEVAL (GET /api/v1/sos/active)
  // =========================================================================
  describe('GET /api/v1/sos/active', () => {
    it('should return the active alert and emergency contacts if active alert exists (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue({
        ...mockSOSAlert,
        ride: {
          rideId: mockRideId,
          source: 'Connaught Place',
          destination: 'Noida Sector 62',
          status: RideStatus.SCHEDULED,
        },
      } as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue(mockEmergencyContacts as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/sos/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.alertId).toBe(mockAlertId);
      expect(res.body.data.alert.status).toBe('ACTIVE');
      expect(res.body.data.contacts).toHaveLength(2);
      expect(res.body.data.ride.rideId).toBe(mockRideId);
    });

    it('should return null data if no active alert exists (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findFirst').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/sos/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('should return 401 Unauthorized if not authenticated', async () => {
      const res = await request(app).get('/api/v1/sos/active');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 3. SOS HISTORY (GET /api/v1/sos/me)
  // =========================================================================
  describe('GET /api/v1/sos/me', () => {
    it('should return paginated list of user alerts (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.sOSAlert, 'findMany').mockResolvedValue([mockSOSAlert] as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/sos/me?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alerts).toHaveLength(1);
      expect(res.body.meta.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should support filtering alerts by status', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.sOSAlert, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/sos/me?status=RESOLVED')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alerts).toEqual([]);
    });

    it('should reject invalid status filter with 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/sos/me?status=INVALID_STATUS')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });

  // =========================================================================
  // 4. GET SOS ALERT BY ID (GET /api/v1/sos/:alertId)
  // =========================================================================
  describe('GET /api/v1/sos/:alertId', () => {
    it('should allow owner to view their SOS alert (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        ...mockSOSAlert,
        ride: null,
      } as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue(mockEmergencyContacts as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get(`/api/v1/sos/${mockAlertId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.alertId).toBe(mockAlertId);
      expect(res.body.data.contacts).toHaveLength(2);
    });

    it('should allow platform ADMIN to view any SOS alert (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdminDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        ...mockSOSAlert, // Owned by mockUserId
        ride: null,
      } as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue(mockEmergencyContacts as any);

      const token = generateToken(mockAdminUserId);
      const res = await request(app)
        .get(`/api/v1/sos/${mockAlertId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.alertId).toBe(mockAlertId);
    });

    it('should reject unauthorized user from viewing another users alert with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        ...mockSOSAlert, // Owned by mockUserId
        ride: null,
      } as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get(`/api/v1/sos/${mockAlertId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('permission');
    });

    it('should return 404 Not Found if alert does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get(`/api/v1/sos/${mockAlertId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 422 Unprocessable Entity for malformed alertId UUID', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/sos/not-a-valid-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });

  // =========================================================================
  // 5. RESOLVE SOS ALERT (PATCH /api/v1/sos/:alertId/resolve)
  // =========================================================================
  describe('PATCH /api/v1/sos/:alertId/resolve', () => {
    it('should allow owner to resolve active alert (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique')
        .mockResolvedValueOnce(mockSOSAlert as any)
        .mockResolvedValueOnce({
          ...mockSOSAlert,
          status: SOSAlertStatus.RESOLVED,
          resolvedAt: mockResolvedTimestamp,
        } as any);
      vi.spyOn(prisma.sOSAlert, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Police assistance arrived and situation safely handled' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.status).toBe('RESOLVED');
      expect(res.body.data.alert.resolvedAt).toBe(mockResolvedTimestamp.toISOString());
    });

    it('should allow platform ADMIN to resolve active alert (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdminDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique')
        .mockResolvedValueOnce(mockSOSAlert as any)
        .mockResolvedValueOnce({
          ...mockSOSAlert,
          status: SOSAlertStatus.RESOLVED,
          resolvedAt: mockResolvedTimestamp,
        } as any);
      vi.spyOn(prisma.sOSAlert, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockAdminUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.status).toBe('RESOLVED');
    });

    it('should reject resolving an already RESOLVED alert with 400 Bad Request', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        ...mockSOSAlert,
        status: SOSAlertStatus.RESOLVED,
        resolvedAt: mockResolvedTimestamp,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Only ACTIVE alerts can be resolved');
    });

    it('should reject resolving an already CANCELLED alert with 400 Bad Request', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        ...mockSOSAlert,
        status: SOSAlertStatus.CANCELLED,
        resolvedAt: mockResolvedTimestamp,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Only ACTIVE alerts can be resolved');
    });

    it('should reject resolution if concurrent transition occurs (updateMany count is 0)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.sOSAlert, 'updateMany').mockResolvedValue({ count: 0 });

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('no longer active');
    });

    it('should reject resolution by non-owner, non-admin with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 Not Found if alert does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 6. CANCEL SOS ALERT (PATCH /api/v1/sos/:alertId/cancel)
  // =========================================================================
  describe('PATCH /api/v1/sos/:alertId/cancel', () => {
    it('should allow owner to cancel active alert as false alarm (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique')
        .mockResolvedValueOnce(mockSOSAlert as any)
        .mockResolvedValueOnce({
          ...mockSOSAlert,
          status: SOSAlertStatus.CANCELLED,
          resolvedAt: mockResolvedTimestamp,
        } as any);
      vi.spyOn(prisma.sOSAlert, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.status).toBe('CANCELLED');
      expect(res.body.data.alert.resolvedAt).toBe(mockResolvedTimestamp.toISOString());
    });

    it('should allow platform ADMIN to cancel active alert (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdminDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique')
        .mockResolvedValueOnce(mockSOSAlert as any)
        .mockResolvedValueOnce({
          ...mockSOSAlert,
          status: SOSAlertStatus.CANCELLED,
          resolvedAt: mockResolvedTimestamp,
        } as any);
      vi.spyOn(prisma.sOSAlert, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockAdminUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.status).toBe('CANCELLED');
    });

    it('should reject cancelling an already CANCELLED alert with 400 Bad Request', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        ...mockSOSAlert,
        status: SOSAlertStatus.CANCELLED,
        resolvedAt: mockResolvedTimestamp,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Only ACTIVE alerts can be cancelled');
    });

    it('should reject cancelling an already RESOLVED alert with 400 Bad Request', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        ...mockSOSAlert,
        status: SOSAlertStatus.RESOLVED,
        resolvedAt: mockResolvedTimestamp,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Only ACTIVE alerts can be cancelled');
    });

    it('should reject cancellation if concurrent transition occurs (updateMany count is 0)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.sOSAlert, 'updateMany').mockResolvedValue({ count: 0 });

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('no longer active');
    });

    it('should reject cancellation by non-owner, non-admin with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 Not Found if alert does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .patch(`/api/v1/sos/${mockAlertId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
