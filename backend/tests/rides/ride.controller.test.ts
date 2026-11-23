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
});
