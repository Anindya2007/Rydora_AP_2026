import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { UserRole, RideStatus, CommunityStatus, MembershipStatus } from '../../src/generated/prisma/client.js';

describe('Milestone 6.1: Ride Creation API (POST /api/v1/rides)', () => {
  const mockDriverId = '11111111-2222-3333-4444-555555555555';
  const mockOtherUserId = '22222222-3333-4444-5555-666666666666';
  const mockVehicleId = '33333333-4444-5555-6666-777777777777';
  const mockOtherVehicleId = '44444444-5555-6666-7777-888888888888';
  const mockCommunityId = '55555555-6666-7777-8888-999999999999';
  const mockRideId = '66666666-7777-8888-9999-000000000000';

  const mockTimestamp = new Date('2026-11-23T10:00:00.000Z');
  const futureDepartureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours in future

  const mockDriverDbUser = {
    userId: mockDriverId,
    name: 'Rohan Sharma',
    email: 'rohan.driver@rydora.in',
    phone: '+919876543210',
    roles: [UserRole.USER, UserRole.DRIVER],
    profileImage: null,
    licenseNumber: 'DL-04-2022-0012345',
    licenseExpiry: new Date('2030-01-01T00:00:00.000Z'),
    driverVerified: true,
    walletBalance: '0.00',
    averageRating: '5.00',
    ratingCount: 10,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockRegularUser = {
    userId: mockOtherUserId,
    name: 'Regular Rider',
    email: 'rider@rydora.in',
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

  const mockVehicle = {
    vehicleId: mockVehicleId,
    driverId: mockDriverId,
    vehicleType: 'SEDAN',
    make: 'Honda',
    model: 'City',
    registrationNumber: 'DL01AB1234',
    color: 'White',
    seatCapacity: 4,
    isActive: true,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockCommunity = {
    communityId: mockCommunityId,
    name: 'SRM University',
    domain: 'srmist.edu.in',
    description: 'SRM Campus Community',
    status: CommunityStatus.ACTIVE,
    createdById: mockDriverId,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockMembership = {
    membershipId: '77777777-8888-9999-0000-111111111111',
    communityId: mockCommunityId,
    userId: mockDriverId,
    memberRole: 'MEMBER',
    status: MembershipStatus.ACTIVE,
    joinedAt: mockTimestamp,
  };

  const validRidePayload = {
    communityId: mockCommunityId,
    vehicleId: mockVehicleId,
    source: 'SRM University Main Gate',
    destination: 'Chennai Central Railway Station',
    departureTime: futureDepartureTime.toISOString(),
    sourceLatitude: 12.823,
    sourceLongitude: 80.044,
    destinationLatitude: 13.0827,
    destinationLongitude: 80.2707,
    totalSeats: 3,
    farePerSeat: 150.0,
  };

  function generateToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Authentication and Authorization Invariants', () => {
    it('should reject unauthenticated request when Authorization header is missing (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/rides')
        .send(validRidePayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request when Bearer token is invalid or corrupted (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', 'Bearer invalid-token-string')
        .send(validRidePayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-driver user with HTTP 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockRegularUser as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/insufficient permissions/i);
    });

    it('should reject driver whose verification is not approved (driverVerified = false) with 403 Forbidden', async () => {
      const unverifiedDriver = {
        ...mockDriverDbUser,
        driverVerified: false,
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(unverifiedDriver as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/verified driver/i);
    });
  });

  describe('2. Successful Ride Creation Flow', () => {
    it('should create ride successfully with 201 Created and standard envelope', async () => {
      // 1. Auth check
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      // 2. Vehicle check
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(mockVehicle as any);
      // 3. Community check
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockCommunity as any);
      // 4. Membership check
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValueOnce(mockMembership as any);
      // 5. Conflict check
      vi.spyOn(prisma.ride, 'findFirst').mockResolvedValueOnce(null);
      // 6. Ride creation
      const createdDbRide = {
        rideId: mockRideId,
        driverId: mockDriverId,
        vehicleId: mockVehicleId,
        communityId: mockCommunityId,
        source: validRidePayload.source,
        destination: validRidePayload.destination,
        departureTime: futureDepartureTime,
        sourceLatitude: { toString: () => '12.823000' },
        sourceLongitude: { toString: () => '80.044000' },
        destinationLatitude: { toString: () => '13.082700' },
        destinationLongitude: { toString: () => '80.270700' },
        totalSeats: validRidePayload.totalSeats,
        availableSeats: validRidePayload.totalSeats,
        farePerSeat: { toString: () => '150.00' },
        status: RideStatus.SCHEDULED,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      };
      vi.spyOn(prisma.ride, 'create').mockResolvedValueOnce(createdDbRide as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/ride created successfully/i);
      expect(res.body.data.ride).toBeDefined();

      const ride = res.body.data.ride;
      expect(ride.rideId).toBe(mockRideId);
      expect(ride.driverId).toBe(mockDriverId);
      expect(ride.vehicleId).toBe(mockVehicleId);
      expect(ride.communityId).toBe(mockCommunityId);
      expect(ride.source).toBe(validRidePayload.source);
      expect(ride.destination).toBe(validRidePayload.destination);
      expect(ride.totalSeats).toBe(3);
      expect(ride.availableSeats).toBe(3);
      expect(ride.farePerSeat).toBe('150.00');
      expect(ride.status).toBe('SCHEDULED');
      expect(ride.sourceLatitude).toBe('12.823000');
    });

    it('should support zero-fare carpooling (free carpool ride)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(mockVehicle as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockCommunity as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValueOnce(mockMembership as any);
      vi.spyOn(prisma.ride, 'findFirst').mockResolvedValueOnce(null);

      const freeRideDb = {
        rideId: mockRideId,
        driverId: mockDriverId,
        vehicleId: mockVehicleId,
        communityId: mockCommunityId,
        source: validRidePayload.source,
        destination: validRidePayload.destination,
        departureTime: futureDepartureTime,
        sourceLatitude: null,
        sourceLongitude: null,
        destinationLatitude: null,
        destinationLongitude: null,
        totalSeats: 2,
        availableSeats: 2,
        farePerSeat: { toString: () => '0.00' },
        status: RideStatus.SCHEDULED,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      };
      vi.spyOn(prisma.ride, 'create').mockResolvedValueOnce(freeRideDb as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          totalSeats: 2,
          farePerSeat: 0,
          sourceLatitude: null,
          sourceLongitude: null,
          destinationLatitude: null,
          destinationLongitude: null,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ride.farePerSeat).toBe('0.00');
      expect(res.body.data.ride.availableSeats).toBe(2);
    });
  });

  describe('3. Vehicle Ownership and Capacity Invariants', () => {
    it('should return 404 Not Found if vehicle does not belong to the requesting driver (zero-knowledge)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      // findFirst returns null because vehicle is scoped by driverId
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(null);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          vehicleId: mockOtherVehicleId,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/vehicle not found/i);
    });

    it('should reject ride creation when selected vehicle is inactive (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce({
        ...mockVehicle,
        isActive: false,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/vehicle is inactive/i);
    });

    it('should reject ride when totalSeats exceeds vehicle passenger seat capacity (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      // Vehicle capacity is 4
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce({
        ...mockVehicle,
        seatCapacity: 4,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          totalSeats: 6, // Exceeds 4
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/exceeds vehicle seat capacity/i);
    });
  });

  describe('4. Community Silo and Membership Invariants (Decision 07)', () => {
    it('should return 404 Not Found if target community does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(mockVehicle as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(null);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/community not found/i);
    });

    it('should return 404 Not Found if target community is INACTIVE', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(mockVehicle as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce({
        ...mockCommunity,
        status: CommunityStatus.INACTIVE,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/community not found or is inactive/i);
    });

    it('should reject ride creation with 403 Forbidden if driver is not an active member of community', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(mockVehicle as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockCommunity as any);
      // No active membership record
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValueOnce(null);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/must be an active member of the community/i);
    });
  });

  describe('5. Scheduling Conflicts & Consistency', () => {
    it('should return 409 Conflict if driver or vehicle already has a scheduled ride at the exact same departure time', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(mockVehicle as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockCommunity as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValueOnce(mockMembership as any);
      // Conflict exists
      vi.spyOn(prisma.ride, 'findFirst').mockResolvedValueOnce({
        rideId: 'existing-ride-uuid',
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/already scheduled/i);
    });
  });

  describe('6. Input Validation & Edge Cases', () => {
    it('should reject departure time in the past (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          departureTime: '2020-01-01T08:00:00.000Z',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.message).toMatch(/validation failed/i);
    });

    it('should reject identical source and destination (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          source: 'Same Location',
          destination: '  same location  ',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.details?.[0].message).toMatch(/source and destination cannot be identical/i);
    });

    it('should reject missing required fields (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          source: 'Only Source',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid UUIDs for communityId or vehicleId (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          communityId: 'not-a-valid-uuid',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject totalSeats < 1 (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          totalSeats: 0,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject totalSeats > 8 (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          totalSeats: 9,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject negative fare per seat (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          farePerSeat: -50,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject coordinates out of valid range (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          sourceLatitude: 95.5, // > 90
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject client attempts to inject system-managed fields via strict schema (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validRidePayload,
          status: 'IN_PROGRESS',
          availableSeats: 10,
          driverId: 'hacker-uuid',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.message).toMatch(/validation failed/i);
    });
  });

  describe('7. Service and Database Failures', () => {
    it('should handle unexpected database failures cleanly with 500 Internal Server Error', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
        new Error('Database connection unexpectedly severed')
      );

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`)
        .send(validRidePayload);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('Milestone 6.2: Single Ride Retrieval (GET /api/v1/rides/:rideId)', () => {
    const mockAdminId = '99999999-8888-7777-6666-555555555555';

    const mockRideWithRelations = {
      rideId: mockRideId,
      driverId: mockDriverId,
      vehicleId: mockVehicleId,
      communityId: mockCommunityId,
      source: 'SRM University Main Gate',
      destination: 'Chennai Central Railway Station',
      departureTime: futureDepartureTime,
      sourceLatitude: { toString: () => '12.823000' },
      sourceLongitude: { toString: () => '80.044000' },
      destinationLatitude: { toString: () => '13.082700' },
      destinationLongitude: { toString: () => '80.270700' },
      totalSeats: 3,
      availableSeats: 3,
      farePerSeat: { toString: () => '150.00' },
      status: RideStatus.SCHEDULED,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      driver: {
        userId: mockDriverId,
        name: 'Rohan Sharma',
        email: 'rohan.driver@rydora.in',
        profileImage: null,
        averageRating: { toString: () => '5.00' },
        ratingCount: 10,
      },
      vehicle: {
        vehicleId: mockVehicleId,
        make: 'Honda',
        model: 'City',
        color: 'White',
        vehicleType: 'SEDAN',
        registrationNumber: 'DL01AB1234',
        seatCapacity: 4,
      },
      community: {
        communityId: mockCommunityId,
        name: 'SRM University',
        domain: 'srmist.edu.in',
        status: CommunityStatus.ACTIVE,
      },
    };

    it('should reject unauthenticated request when Authorization header is missing (401)', async () => {
      const res = await request(app).get(`/api/v1/rides/${mockRideId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid UUID format for rideId (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get('/api/v1/rides/invalid-uuid-format')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return 404 Not Found when ride does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValueOnce(null);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/ride not found/i);
    });

    it('should allow the publishing driver to retrieve their own ride (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValueOnce(mockRideWithRelations as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ride.rideId).toBe(mockRideId);
      expect(res.body.data.ride.driverId).toBe(mockDriverId);
      expect(res.body.data.ride.driver.name).toBe('Rohan Sharma');
      expect(res.body.data.ride.vehicle.model).toBe('City');
    });

    it('should allow an active community member to retrieve ride details (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValueOnce(mockRideWithRelations as any);
      // Member is active in ride's community
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValueOnce(mockMembership as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ride.rideId).toBe(mockRideId);
      expect(res.body.data.ride.community.name).toBe('SRM University');
    });

    it('should allow a platform ADMIN to retrieve any ride (200 OK)', async () => {
      const mockAdminDbUser = {
        userId: mockAdminId,
        roles: [UserRole.USER],
      };
      env.ADMIN_USER_IDS = [mockAdminId];

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdminDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValueOnce(mockRideWithRelations as any);

      const token = generateToken(mockAdminId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ride.rideId).toBe(mockRideId);
    });

    it('should reject a user who is NOT an active member of the community with HTTP 403 Forbidden', async () => {
      env.ADMIN_USER_IDS = [];
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValueOnce(mockRideWithRelations as any);
      // Non-member
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValueOnce(null);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/active member of the community/i);
    });

    it('should never expose sensitive internal fields or driver credentials in response', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValueOnce(mockRideWithRelations as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ride = res.body.data.ride;
      expect(ride.driver.passwordHash).toBeUndefined();
      expect(ride.driver.walletBalance).toBeUndefined();
      expect(ride.driver.licenseNumber).toBeUndefined();
      expect(ride.driver.licenseExpiry).toBeUndefined();
    });

    it('should successfully retrieve completed or cancelled rides with accurate status', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValueOnce({
        ...mockRideWithRelations,
        status: RideStatus.COMPLETED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ride.status).toBe('COMPLETED');
    });
  });

  describe('Milestone 6.2: Driver Rides Listing (GET /api/v1/rides/me)', () => {
    const mockDriverRidesList = [
      {
        rideId: mockRideId,
        driverId: mockDriverId,
        vehicleId: mockVehicleId,
        communityId: mockCommunityId,
        source: 'SRM University Main Gate',
        destination: 'Chennai Central Railway Station',
        departureTime: futureDepartureTime,
        sourceLatitude: { toString: () => '12.823000' },
        sourceLongitude: { toString: () => '80.044000' },
        destinationLatitude: { toString: () => '13.082700' },
        destinationLongitude: { toString: () => '80.270700' },
        totalSeats: 3,
        availableSeats: 3,
        farePerSeat: { toString: () => '150.00' },
        status: RideStatus.SCHEDULED,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        vehicle: {
          vehicleId: mockVehicleId,
          make: 'Honda',
          model: 'City',
          color: 'White',
          vehicleType: 'SEDAN',
          registrationNumber: 'DL01AB1234',
          seatCapacity: 4,
        },
        community: {
          communityId: mockCommunityId,
          name: 'SRM University',
          domain: 'srmist.edu.in',
          status: CommunityStatus.ACTIVE,
        },
      },
    ];

    it('should reject unauthenticated request when Authorization header is missing (401)', async () => {
      const res = await request(app).get('/api/v1/rides/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-driver user with HTTP 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get('/api/v1/rides/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/insufficient permissions/i);
    });

    it('should return paginated list of driver rides (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);
      vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce(mockDriverRidesList as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/rides/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rides).toHaveLength(1);
      expect(res.body.data.rides[0].rideId).toBe(mockRideId);
      expect(res.body.data.rides[0].driverId).toBe(mockDriverId);
      expect(res.body.data.rides[0].vehicle.make).toBe('Honda');
      expect(res.body.meta.pagination).toBeDefined();
      expect(res.body.meta.pagination.total).toBe(1);
      expect(res.body.meta.pagination.page).toBe(1);
    });

    it('should filter driver rides by status (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      const countSpy = vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce(mockDriverRidesList as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/rides/me?status=SCHEDULED')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(countSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            driverId: mockDriverId,
            status: 'SCHEDULED',
          }),
        })
      );
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            driverId: mockDriverId,
            status: 'SCHEDULED',
          }),
        })
      );
    });

    it('should return empty list when driver has no published rides (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(0);
      vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([]);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/rides/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rides).toEqual([]);
      expect(res.body.meta.pagination.total).toBe(0);
      expect(res.body.meta.pagination.totalPages).toBe(0);
      expect(res.body.meta.pagination.hasNext).toBe(false);
    });

    it('should respect custom pagination parameters (page and limit)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      const countSpy = vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(25);
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([]);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/rides/me?page=2&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(res.body.meta.pagination.page).toBe(2);
      expect(res.body.meta.pagination.limit).toBe(10);
      expect(res.body.meta.pagination.total).toBe(25);
      expect(res.body.meta.pagination.totalPages).toBe(3);
      expect(res.body.meta.pagination.hasNext).toBe(true);
      expect(res.body.meta.pagination.hasPrev).toBe(true);
    });

    it('should reject invalid query parameters such as limit=0 (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/rides/me?limit=0')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });
});
