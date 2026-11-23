import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { UserRole, RideStatus, CommunityStatus, MembershipStatus, BookingStatus } from '../../src/generated/prisma/client.js';

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

  describe('Milestone 6.3: Ride Listing, Pagination and Filtering (GET /api/v1/rides)', () => {
    const sampleRide = {
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

    it('should list rides with default parameters when no filters are provided (200 OK)', async () => {
      const countSpy = vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);

      const res = await request(app).get('/api/v1/rides');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(countSpy).toHaveBeenCalledWith({ where: {} });
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 20,
          orderBy: [
            { departureTime: 'asc' },
            { rideId: 'asc' },
          ],
        })
      );
      expect(res.body.data.rides).toHaveLength(1);
      expect(res.body.data.rides[0].rideId).toBe(mockRideId);
      expect(res.body.meta.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should allow public access to /api/v1/rides/search alias without authentication (200 OK)', async () => {
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(0);
      vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([]);

      const res = await request(app).get('/api/v1/rides/search');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rides).toEqual([]);
    });

    it('should allow authenticated users to list rides with Bearer token (200 OK)', async () => {
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);
      vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get('/api/v1/rides')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rides).toHaveLength(1);
    });

    it('should filter rides by source location with case-insensitive partial match', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/v1/rides?source=srm');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source: {
              contains: 'srm',
              mode: 'insensitive',
            },
          }),
        })
      );
    });

    it('should filter rides by destination location with case-insensitive partial match', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/v1/rides?destination=central');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            destination: {
              contains: 'central',
              mode: 'insensitive',
            },
          }),
        })
      );
    });

    it('should filter rides by communityId', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get(`/api/v1/rides?communityId=${mockCommunityId}`);

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            communityId: mockCommunityId,
          }),
        })
      );
    });

    it('should filter rides by status (SCHEDULED)', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/v1/rides?status=SCHEDULED');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SCHEDULED',
          }),
        })
      );
    });

    it('should filter rides by availableSeats (greater than or equal to)', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/v1/rides?availableSeats=3');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            availableSeats: { gte: 3 },
          }),
        })
      );
    });

    it('should filter rides by minSeats query parameter (alias for availableSeats)', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/v1/rides?minSeats=2');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            availableSeats: { gte: 2 },
          }),
        })
      );
    });

    it('should filter rides by vehicleType via vehicle relation', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/v1/rides?vehicleType=SEDAN');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vehicle: {
              vehicleType: {
                equals: 'SEDAN',
                mode: 'insensitive',
              },
            },
          }),
        })
      );
    });

    it('should filter rides by single calendar date (YYYY-MM-DD)', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/v1/rides?date=2026-11-23');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departureTime: {
              gte: new Date('2026-11-23T00:00:00.000Z'),
              lte: new Date('2026-11-23T23:59:59.999Z'),
            },
          }),
        })
      );
    });

    it('should filter rides by date range (startDate and endDate)', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get(
        '/api/v1/rides?startDate=2026-11-23T00:00:00.000Z&endDate=2026-11-24T23:59:59.999Z'
      );

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departureTime: {
              gte: new Date('2026-11-23T00:00:00.000Z'),
              lte: new Date('2026-11-24T23:59:59.999Z'),
            },
          }),
        })
      );
    });

    it('should combine multiple query filters simultaneously', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      const countSpy = vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get(
        `/api/v1/rides?communityId=${mockCommunityId}&source=SRM&destination=Central&status=SCHEDULED&availableSeats=2&vehicleType=SEDAN&date=2026-11-23`
      );

      expect(res.status).toBe(200);
      expect(countSpy).toHaveBeenCalledWith({
        where: {
          communityId: mockCommunityId,
          source: { contains: 'SRM', mode: 'insensitive' },
          destination: { contains: 'Central', mode: 'insensitive' },
          status: 'SCHEDULED',
          availableSeats: { gte: 2 },
          vehicle: { vehicleType: { equals: 'SEDAN', mode: 'insensitive' } },
          departureTime: {
            gte: new Date('2026-11-23T00:00:00.000Z'),
            lte: new Date('2026-11-23T23:59:59.999Z'),
          },
        },
      });
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            communityId: mockCommunityId,
            source: { contains: 'SRM', mode: 'insensitive' },
            destination: { contains: 'Central', mode: 'insensitive' },
            status: 'SCHEDULED',
            availableSeats: { gte: 2 },
            vehicle: { vehicleType: { equals: 'SEDAN', mode: 'insensitive' } },
            departureTime: {
              gte: new Date('2026-11-23T00:00:00.000Z'),
              lte: new Date('2026-11-23T23:59:59.999Z'),
            },
          },
        })
      );
    });

    it('should sort rides deterministically by custom sortBy and sortOrder', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);

      const res = await request(app).get('/api/v1/rides?sortBy=farePerSeat&sortOrder=desc');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { farePerSeat: 'desc' },
            { rideId: 'asc' },
          ],
        })
      );
    });

    it('should handle custom pagination (page=2, limit=10)', async () => {
      const findManySpy = vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(25);

      const res = await request(app).get('/api/v1/rides?page=2&limit=10');

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(res.body.meta.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should return empty results when no rides match criteria (200 OK)', async () => {
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(0);
      vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([]);

      const res = await request(app).get('/api/v1/rides?source=NonexistentPlace');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rides).toEqual([]);
      expect(res.body.meta.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should accept boundary conditions (limit=1, limit=100, availableSeats=1, availableSeats=8)', async () => {
      vi.spyOn(prisma.ride, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.ride, 'findMany').mockResolvedValue([]);

      const resMin = await request(app).get('/api/v1/rides?limit=1&availableSeats=1');
      expect(resMin.status).toBe(200);

      const resMax = await request(app).get('/api/v1/rides?limit=100&availableSeats=8');
      expect(resMax.status).toBe(200);
    });

    it('should reject invalid communityId format (422 Unprocessable Entity)', async () => {
      const res = await request(app).get('/api/v1/rides?communityId=not-a-valid-uuid');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid status enum (422 Unprocessable Entity)', async () => {
      const res = await request(app).get('/api/v1/rides?status=EXPLODED');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid date format (422 Unprocessable Entity)', async () => {
      const res = await request(app).get('/api/v1/rides?date=23-11-2026');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid date range where startDate is after endDate (422 Unprocessable Entity)', async () => {
      const res = await request(app).get(
        '/api/v1/rides?startDate=2026-11-25T00:00:00.000Z&endDate=2026-11-24T00:00:00.000Z'
      );

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject out-of-bound limit such as limit=0 or limit=101 (422 Unprocessable Entity)', async () => {
      const resZero = await request(app).get('/api/v1/rides?limit=0');
      expect(resZero.status).toBe(422);
      expect(resZero.body.error.code).toBe('UNPROCESSABLE_ENTITY');

      const resOver = await request(app).get('/api/v1/rides?limit=101');
      expect(resOver.status).toBe(422);
      expect(resOver.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid page numbers such as page=0 or negative page (422 Unprocessable Entity)', async () => {
      const res = await request(app).get('/api/v1/rides?page=0');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid sortBy field (422 Unprocessable Entity)', async () => {
      const res = await request(app).get('/api/v1/rides?sortBy=passwordHash');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid sortOrder (422 Unprocessable Entity)', async () => {
      const res = await request(app).get('/api/v1/rides?sortOrder=diagonal');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject unexpected query parameters due to strict schema (422 Unprocessable Entity)', async () => {
      const res = await request(app).get('/api/v1/rides?maliciousInject=dropTable');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should strictly prevent exposure of driver credentials and sensitive profile fields', async () => {
      vi.spyOn(prisma.ride, 'count').mockResolvedValueOnce(1);
      vi.spyOn(prisma.ride, 'findMany').mockResolvedValueOnce([sampleRide as any]);

      const res = await request(app).get('/api/v1/rides');

      expect(res.status).toBe(200);
      const ride = res.body.data.rides[0];
      expect(ride.driver).toBeDefined();
      expect(ride.driver.userId).toBe(mockDriverId);
      expect(ride.driver.name).toBe('Rohan Sharma');
      expect(ride.driver.email).toBe('rohan.driver@rydora.in');
      expect(ride.driver.averageRating).toBe('5.00');
      expect(ride.driver.ratingCount).toBe(10);

      // Verify strict omission of sensitive credentials
      expect(ride.driver.passwordHash).toBeUndefined();
      expect(ride.driver.walletBalance).toBeUndefined();
      expect(ride.driver.licenseNumber).toBeUndefined();
      expect(ride.driver.licenseExpiry).toBeUndefined();
      expect(ride.driver.phone).toBeUndefined();
    });
  });

  describe('Milestone 6.4: Ride Update API and Validation (PATCH /api/v1/rides/:rideId)', () => {
    const futureTimePlus48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const mockExistingRide = {
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
        driverId: mockDriverId,
        seatCapacity: 4,
        isActive: true,
      },
    };

    const mockUpdatedRideWithRelations = {
      ...mockExistingRide,
      source: 'SRM Tech Park',
      farePerSeat: { toString: () => '180.00' },
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

    it('should reject unauthenticated request when Authorization header is missing (401 Unauthorized)', async () => {
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .send({ source: 'New Gate' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request from non-driver user with HTTP 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'New Gate' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject invalid UUID format for rideId parameter (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch('/api/v1/rides/invalid-uuid-format')
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'New Gate' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject empty update body with HTTP 422 Unprocessable Entity', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject client attempts to modify protected field: rideId (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: '123e4567-e89b-12d3-a456-426614174000' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject client attempts to modify protected field: driverId (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ driverId: mockOtherUserId });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject client attempts to modify protected field: communityId (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ communityId: mockCommunityId });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject client attempts to modify protected field: status (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject client attempts to modify protected field: availableSeats (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ availableSeats: 5 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return 404 Not Found when ride does not exist in database', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'New Gate' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject update from a driver who is NOT the ride owner with HTTP 403 Forbidden (Unauthorized owner)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        ...mockDriverDbUser,
        userId: mockOtherUserId,
        roles: [UserRole.USER, UserRole.DRIVER],
      } as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'Unauthorized Update' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should successfully perform a partial update on source and farePerSeat (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);
      const updateSpy = vi.spyOn(prisma.ride, 'update').mockResolvedValue(mockUpdatedRideWithRelations as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          source: 'SRM Tech Park',
          farePerSeat: 180.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rideId: mockRideId },
          data: {
            source: 'SRM Tech Park',
            farePerSeat: 180.0,
          },
        })
      );
      expect(res.body.data.ride.source).toBe('SRM Tech Park');
      expect(res.body.data.ride.farePerSeat).toBe('180.00');
    });

    it('should successfully update vehicleId when new vehicle belongs to driver and is active (200 OK)', async () => {
      const mockNewVehicle = {
        vehicleId: mockOtherVehicleId,
        driverId: mockDriverId,
        seatCapacity: 5,
        isActive: true,
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValue(mockNewVehicle as any);
      vi.spyOn(prisma.ride, 'findFirst').mockResolvedValue(null); // No scheduling conflict
      const updateSpy = vi.spyOn(prisma.ride, 'update').mockResolvedValue({
        ...mockUpdatedRideWithRelations,
        vehicleId: mockOtherVehicleId,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: mockOtherVehicleId });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vehicleId: mockOtherVehicleId,
          }),
        })
      );
    });

    it('should successfully update departureTime when new future time has no conflicts (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);
      vi.spyOn(prisma.ride, 'findFirst').mockResolvedValue(null); // No scheduling conflict
      const updateSpy = vi.spyOn(prisma.ride, 'update').mockResolvedValue({
        ...mockUpdatedRideWithRelations,
        departureTime: futureTimePlus48h,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departureTime: futureTimePlus48h.toISOString() });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            departureTime: expect.any(Date),
          }),
        })
      );
    });

    it('should successfully update totalSeats and recompute availableSeats proportionally (200 OK)', async () => {
      // 1 seat booked: totalSeats: 3, availableSeats: 2 -> bookedSeats = 1
      const rideWithBooking = {
        ...mockExistingRide,
        totalSeats: 3,
        availableSeats: 2,
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(rideWithBooking as any);
      const updateSpy = vi.spyOn(prisma.ride, 'update').mockResolvedValue({
        ...mockUpdatedRideWithRelations,
        totalSeats: 4,
        availableSeats: 3,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalSeats: 4 });

      expect(res.status).toBe(200);
      // New totalSeats: 4, new availableSeats = 4 - 1 = 3
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalSeats: 4,
            availableSeats: 3,
          }),
        })
      );
    });

    it('should reject departureTime set in the past (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departureTime: '2020-01-01T00:00:00.000Z' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject totalSeats < 1 or > 8 (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const resZero = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalSeats: 0 });
      expect(resZero.status).toBe(422);

      const resNine = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalSeats: 9 });
      expect(resNine.status).toBe(422);
    });

    it('should reject negative farePerSeat (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ farePerSeat: -50 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject update when source and destination are identical in payload (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          source: 'Same Place',
          destination: 'Same Place',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject update when updating source to match existing destination (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'Chennai Central Railway Station' }); // Same as existing destination

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Source and destination cannot be identical');
    });

    it('should reject update when updating destination to match existing source (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ destination: 'SRM University Main Gate' }); // Same as existing source

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Source and destination cannot be identical');
    });

    it('should reject update when selected vehicle does not exist or does not belong to driver (404 Not Found)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValue(null);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: mockOtherVehicleId });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject update when selected vehicle is inactive (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValue({
        vehicleId: mockOtherVehicleId,
        driverId: mockDriverId,
        seatCapacity: 4,
        isActive: false, // Inactive vehicle
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: mockOtherVehicleId });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Selected vehicle is inactive');
    });

    it('should reject update when totalSeats exceeds vehicle passenger seat capacity (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any); // Capacity: 4

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalSeats: 5 }); // Exceeds capacity 4

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('exceeds vehicle seat capacity');
    });

    it('should reject reducing totalSeats below already-booked seats count (400 Bad Request)', async () => {
      // 2 seats booked: totalSeats: 3, availableSeats: 1 -> bookedSeats = 2
      const rideWithTwoBookings = {
        ...mockExistingRide,
        totalSeats: 3,
        availableSeats: 1,
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(rideWithTwoBookings as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalSeats: 1 }); // Less than 2 booked seats!

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot reduce total seats to 1; 2 seats are already booked');
    });

    it('should reject updating a ride that is already COMPLETED (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockExistingRide,
        status: RideStatus.COMPLETED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'New Gate' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot update ride with status COMPLETED');
    });

    it('should reject updating a ride that is already CANCELLED (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockExistingRide,
        status: RideStatus.CANCELLED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'New Gate' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot update ride with status CANCELLED');
    });

    it('should reject updating a ride that is IN_PROGRESS (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockExistingRide,
        status: RideStatus.IN_PROGRESS,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'New Gate' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot update ride with status IN_PROGRESS');
    });

    it('should reject updating a ride whose scheduled departure time has already elapsed (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockExistingRide,
        departureTime: new Date(Date.now() - 60 * 1000), // 1 minute in past
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'New Gate' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('departure time has passed');
    });

    it('should reject updating departureTime when another ride is already scheduled at the same time (409 Conflict)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);
      vi.spyOn(prisma.ride, 'findFirst').mockResolvedValue({
        rideId: '88888888-9999-0000-1111-222222222222',
      } as any); // Conflicting ride found

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departureTime: futureTimePlus48h.toISOString() });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('A ride is already scheduled');
    });

    it('should preserve existing omitted fields and return safe sanitized response without private credentials', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockExistingRide as any);
      const updateSpy = vi.spyOn(prisma.ride, 'update').mockResolvedValue(mockUpdatedRideWithRelations as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ farePerSeat: 180.0 });

      expect(res.status).toBe(200);
      // Verify only farePerSeat was in update data
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { farePerSeat: 180.0 },
        })
      );
      // Verify returned sanitized object
      const ride = res.body.data.ride;
      expect(ride.rideId).toBe(mockRideId);
      expect(ride.driver.passwordHash).toBeUndefined();
      expect(ride.driver.walletBalance).toBeUndefined();
      expect(ride.driver.licenseNumber).toBeUndefined();
      expect(ride.driver.licenseExpiry).toBeUndefined();
    });
  });

  describe('Milestone 6.5: Ride Cancellation and Lifecycle Consistency (POST/PATCH /api/v1/rides/:rideId/cancel)', () => {
    const mockScheduledRide = {
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
    };

    const mockCancelledRideWithRelations = {
      ...mockScheduledRide,
      status: RideStatus.CANCELLED,
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

    beforeEach(() => {
      // Configure default transaction implementation
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback);
      });
      vi.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 0 } as any);
    });

    it('should reject unauthenticated request when Authorization header is missing (401 Unauthorized)', async () => {
      const res = await request(app).post(`/api/v1/rides/${mockRideId}/cancel`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request from non-driver user with HTTP 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRegularUser as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject invalid UUID format for rideId parameter (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/rides/invalid-uuid-format/cancel')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return 404 Not Found when ride does not exist in database', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject cancellation from a driver who is NOT the ride owner with HTTP 403 Forbidden (Unauthorized owner)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        ...mockDriverDbUser,
        userId: mockOtherUserId,
        roles: [UserRole.USER, UserRole.DRIVER],
      } as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockScheduledRide as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('not authorized to cancel this ride');
    });

    it('should successfully cancel a SCHEDULED ride (POST /api/v1/rides/:rideId/cancel) (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique')
        .mockResolvedValueOnce(mockScheduledRide as any)
        .mockResolvedValueOnce(mockCancelledRideWithRelations as any);
      const updateManySpy = vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Ride cancelled successfully');
      expect(res.body.data.ride.status).toBe(RideStatus.CANCELLED);
      expect(updateManySpy).toHaveBeenCalledWith({
        where: {
          rideId: mockRideId,
          driverId: mockDriverId,
          status: RideStatus.SCHEDULED,
        },
        data: {
          status: RideStatus.CANCELLED,
        },
      });
    });

    it('should successfully cancel a ride using PATCH /api/v1/rides/:rideId/cancel (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique')
        .mockResolvedValueOnce(mockScheduledRide as any)
        .mockResolvedValueOnce(mockCancelledRideWithRelations as any);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ride.status).toBe(RideStatus.CANCELLED);
    });

    it('should successfully cancel a ride using DELETE /api/v1/rides/:rideId (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique')
        .mockResolvedValueOnce(mockScheduledRide as any)
        .mockResolvedValueOnce(mockCancelledRideWithRelations as any);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .delete(`/api/v1/rides/${mockRideId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ride.status).toBe(RideStatus.CANCELLED);
    });

    it('should reject cancellation when ride is already CANCELLED (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockScheduledRide,
        status: RideStatus.CANCELLED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Ride is already cancelled');
    });

    it('should reject cancellation when ride is already COMPLETED (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockScheduledRide,
        status: RideStatus.COMPLETED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot cancel a completed ride');
    });

    it('should reject cancellation when ride is IN_PROGRESS (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockScheduledRide,
        status: RideStatus.IN_PROGRESS,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot cancel a ride that is currently in progress');
    });

    it('should handle concurrent cancellation attempts safely via atomic conditional update (409 Conflict)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockScheduledRide as any);
      // Simulate concurrent race condition where count is 0 because status was flipped
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 0 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Ride cancellation conflict');
    });

    it('should propagate unexpected database transaction failures cleanly with HTTP 500', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('PostgreSQL deadlock error'));

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should verify zero credential leakage in cancelled ride output', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique')
        .mockResolvedValueOnce(mockScheduledRide as any)
        .mockResolvedValueOnce(mockCancelledRideWithRelations as any);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ride = res.body.data.ride;
      expect(ride.status).toBe(RideStatus.CANCELLED);
      expect(ride.driver.passwordHash).toBeUndefined();
      expect(ride.driver.walletBalance).toBeUndefined();
      expect(ride.driver.licenseNumber).toBeUndefined();
      expect(ride.driver.licenseExpiry).toBeUndefined();
      expect(ride.driver.phone).toBeUndefined();
    });

    it('should atomically propagate cancellation to eligible active bookings (PENDING, CONFIRMED) with driver attribution', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique')
        .mockResolvedValueOnce(mockScheduledRide as any)
        .mockResolvedValueOnce(mockCancelledRideWithRelations as any);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });
      const bookingUpdateManySpy = vi.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 2 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(bookingUpdateManySpy).toHaveBeenCalledWith({
        where: {
          rideId: mockRideId,
          status: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          },
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: expect.any(Date),
          cancelledById: mockDriverId,
          cancellationReason: '[CANCELLED_BY_DRIVER] Ride cancelled by driver',
        },
      });
    });

    it('should never modify already CANCELLED bookings when ride is cancelled by driver', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique')
        .mockResolvedValueOnce(mockScheduledRide as any)
        .mockResolvedValueOnce(mockCancelledRideWithRelations as any);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });
      const bookingUpdateManySpy = vi.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 0 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const callArg = bookingUpdateManySpy.mock.calls[0][0];
      expect(callArg.where.status.in).not.toContain(BookingStatus.CANCELLED);
    });

    it('should rollback both ride and booking cancellations if an error occurs during booking update', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockScheduledRide as any);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.booking, 'updateMany').mockRejectedValue(new Error('Database write failure during booking propagation'));

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .post(`/api/v1/rides/${mockRideId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
