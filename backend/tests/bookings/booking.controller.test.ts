import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { UserRole, RideStatus, BookingStatus, MembershipStatus } from '../../src/generated/prisma/client.js';

describe('Milestone 7A: Booking Creation API (POST /api/v1/bookings)', () => {
  const mockDriverId = '11111111-2222-3333-4444-555555555555';
  const mockRiderId = '22222222-3333-4444-5555-666666666666';
  const mockOtherRiderId = '33333333-4444-5555-6666-777777777777';
  const mockRideId = '44444444-5555-6666-7777-888888888888';
  const mockCommunityId = '55555555-6666-7777-8888-999999999999';
  const mockBookingId = '66666666-7777-8888-9999-000000000000';

  const mockTimestamp = new Date('2026-11-23T10:00:00.000Z');
  const futureDepartureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours in future

  const mockRiderDbUser = {
    userId: mockRiderId,
    name: 'Aarav Patel',
    email: 'aarav.rider@rydora.in',
    phone: '+919876543299',
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

  const mockRide = {
    rideId: mockRideId,
    driverId: mockDriverId,
    vehicleId: '77777777-8888-9999-0000-111111111111',
    communityId: mockCommunityId,
    source: 'SRM University Main Gate',
    destination: 'Chennai Central Railway Station',
    departureTime: futureDepartureTime,
    totalSeats: 3,
    availableSeats: 3,
    farePerSeat: { toString: () => '150.00' },
    status: RideStatus.SCHEDULED,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockMembership = {
    membershipId: '88888888-9999-0000-1111-222222222222',
    communityId: mockCommunityId,
    userId: mockRiderId,
    status: MembershipStatus.ACTIVE,
  };

  const mockCreatedBooking = {
    bookingId: mockBookingId,
    rideId: mockRideId,
    riderId: mockRiderId,
    seatsBooked: 2,
    status: BookingStatus.PENDING,
    totalAmount: { toString: () => '300.00' },
    bookedAt: mockTimestamp,
    updatedAt: mockTimestamp,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    rider: {
      userId: mockRiderId,
      name: 'Aarav Patel',
      email: 'aarav.rider@rydora.in',
      profileImage: null,
    },
    ride: {
      rideId: mockRideId,
      driverId: mockDriverId,
      source: 'SRM University Main Gate',
      destination: 'Chennai Central Railway Station',
      departureTime: futureDepartureTime,
      farePerSeat: { toString: () => '150.00' },
      status: RideStatus.SCHEDULED,
    },
  };

  function generateToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default interactive transaction mock
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

  describe('1. Authentication and Authorization', () => {
    it('should reject unauthenticated booking request when Authorization header is missing (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request when client attempts to inject a custom riderId via strict schema (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rideId: mockRideId,
          seatsBooked: 1,
          riderId: mockOtherRiderId, // Attempted spoof
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject a driver attempting to book their own ride (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);

      const token = generateToken(mockDriverId); // Same as ride.driverId
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Drivers cannot book seats on their own rides');
    });
  });

  describe('2. Ride Validation & Lifecycle Invariants', () => {
    it('should return 404 Not Found when requested ride does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject booking when ride is CANCELLED (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockRide,
        status: RideStatus.CANCELLED,
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Only SCHEDULED rides can be booked');
    });

    it('should reject booking when ride is COMPLETED (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockRide,
        status: RideStatus.COMPLETED,
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Only SCHEDULED rides can be booked');
    });

    it('should reject booking when ride departure time has already passed (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue({
        ...mockRide,
        departureTime: new Date(Date.now() - 60 * 1000), // 1 minute in the past
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('departure time has passed');
    });

    it('should reject invalid UUID format for rideId (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: 'not-a-valid-uuid', seatsBooked: 1 });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });

  describe('3. Seat Input & Boundary Validation', () => {
    it('should reject seatsBooked = 0 (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 0 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject negative seatsBooked (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: -2 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject seatsBooked > 4 (Decision 10 limit) (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 5 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.details[0].message).toContain('Cannot book more than 4 seats');
    });

    it('should reject non-integer seatsBooked (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 2.5 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });

  describe('4. Seat Allocation, Consistency & Concurrency', () => {
    it('should successfully create a booking and decrement availableSeats (201 Created)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(mockMembership as any);
      vi.spyOn(prisma.booking, 'findFirst').mockResolvedValue(null); // No duplicate booking
      const updateManySpy = vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });
      const createBookingSpy = vi.spyOn(prisma.booking, 'create').mockResolvedValue(mockCreatedBooking as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 2 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Booking created successfully');
      expect(res.body.data.booking.bookingId).toBe(mockBookingId);
      expect(res.body.data.booking.seatsBooked).toBe(2);
      expect(res.body.data.booking.status).toBe(BookingStatus.PENDING);
      expect(res.body.data.booking.totalAmount).toBe('300.00');

      // Verify atomic seat allocation query condition
      expect(updateManySpy).toHaveBeenCalledWith({
        where: {
          rideId: mockRideId,
          status: RideStatus.SCHEDULED,
          availableSeats: { gte: 2 },
        },
        data: {
          availableSeats: { decrement: 2 },
        },
      });

      // Verify booking insertion
      expect(createBookingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rideId: mockRideId,
            riderId: mockRiderId,
            seatsBooked: 2,
            status: BookingStatus.PENDING,
            totalAmount: '300.00',
          }),
        })
      );
    });

    it('should successfully book exactly the remaining available capacity (201 Created)', async () => {
      const rideWith1Seat = {
        ...mockRide,
        availableSeats: 1,
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(rideWith1Seat as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(mockMembership as any);
      vi.spyOn(prisma.booking, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.booking, 'create').mockResolvedValue({
        ...mockCreatedBooking,
        seatsBooked: 1,
        totalAmount: { toString: () => '150.00' },
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(201);
      expect(res.body.data.booking.seatsBooked).toBe(1);
    });

    it('should reject booking when availableSeats is insufficient (mocked concurrency & boundary guard) (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(mockMembership as any);
      vi.spyOn(prisma.booking, 'findFirst').mockResolvedValue(null);
      // Simulate race condition or insufficient capacity where count is 0
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 0 });

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 3 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Insufficient available seats');
    });

    it('should reject duplicate active booking for the same ride by the same rider (Decision 10) (409 Conflict)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(mockMembership as any);
      // Simulate existing active booking
      vi.spyOn(prisma.booking, 'findFirst').mockResolvedValue({
        bookingId: '99999999-0000-1111-2222-333333333333',
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already have an active booking');
    });

    it('should reject booking if passenger is not an active member of the community (Decision 07) (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      // No active community membership
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('active member of this community');
    });

    it('should rollback transaction and return 500 when database insertion fails unexpectedly', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(mockMembership as any);
      vi.spyOn(prisma.booking, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });
      // Insertion fails
      vi.spyOn(prisma.booking, 'create').mockRejectedValue(new Error('Database disk error'));

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 1 });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should strictly exclude private credentials and password hashes from booking response', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(mockMembership as any);
      vi.spyOn(prisma.booking, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.booking, 'create').mockResolvedValue(mockCreatedBooking as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ rideId: mockRideId, seatsBooked: 2 });

      expect(res.status).toBe(201);
      const booking = res.body.data.booking;
      expect(booking.bookingId).toBe(mockBookingId);
      expect(booking.rider.passwordHash).toBeUndefined();
      expect(booking.rider.walletBalance).toBeUndefined();
      expect(booking.rider.licenseNumber).toBeUndefined();
      expect(booking.rider.phone).toBeUndefined();
    });
  });
});
