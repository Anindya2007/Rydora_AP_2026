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

  describe('Milestone 7B: Single Booking Retrieval (GET /api/v1/bookings/:bookingId)', () => {
    const mockAdminId = '99999999-aaaa-bbbb-cccc-dddddddddddd';
    const mockAdminDbUser = {
      userId: mockAdminId,
      name: 'System Admin',
      email: 'admin@rydora.in',
      phone: '+919999999999',
      roles: [UserRole.USER, 'ADMIN'],
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

    const mockBookingDetails = {
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

    it('should allow authorized passenger to retrieve their own booking (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBookingDetails as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Booking retrieved successfully');
      expect(res.body.data.booking.bookingId).toBe(mockBookingId);
      expect(res.body.data.booking.riderId).toBe(mockRiderId);
      expect(res.body.data.booking.totalAmount).toBe('300.00');
      expect(res.body.data.booking.ride.source).toBe('SRM University Main Gate');
    });

    it('should allow authorized ride driver to retrieve booking for their ride (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBookingDetails as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.bookingId).toBe(mockBookingId);
      expect(res.body.data.booking.ride.driverId).toBe(mockDriverId);
    });

    it('should allow platform admin to retrieve any booking (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdminDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBookingDetails as any);

      const token = generateToken(mockAdminId);
      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.bookingId).toBe(mockBookingId);
    });

    it('should reject unrelated user attempting to view another passenger booking (403 Forbidden)', async () => {
      const mockUnrelatedUser = {
        userId: mockOtherRiderId,
        name: 'Sneha Rao',
        email: 'sneha@rydora.in',
        phone: '+919876543222',
        roles: [UserRole.USER],
        profileImage: null,
        licenseNumber: null,
        licenseExpiry: null,
        driverVerified: false,
        walletBalance: '100.00',
        averageRating: '5.00',
        ratingCount: 1,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUnrelatedUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBookingDetails as any);

      const token = generateToken(mockOtherRiderId);
      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('You are not authorized to view this booking');
    });

    it('should reject unauthenticated request when Authorization header is missing (401 Unauthorized)', async () => {
      const res = await request(app).get(`/api/v1/bookings/${mockBookingId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 Not Found when booking does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('Booking not found');
    });

    it('should reject invalid UUID format for bookingId (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get('/api/v1/bookings/invalid-uuid-format')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should never expose sensitive credentials, password hashes or wallet data in booking retrieval', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBookingDetails as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const booking = res.body.data.booking;
      expect(booking.rider.passwordHash).toBeUndefined();
      expect(booking.rider.walletBalance).toBeUndefined();
      expect(booking.rider.licenseNumber).toBeUndefined();
      expect(booking.ride.driver?.passwordHash).toBeUndefined();
    });
  });

  describe('Milestone 7B: Passenger Booking History (GET /api/v1/bookings/me)', () => {
    const mockBookingsList = [
      {
        bookingId: mockBookingId,
        rideId: mockRideId,
        riderId: mockRiderId,
        seatsBooked: 2,
        status: BookingStatus.PENDING,
        totalAmount: { toString: () => '300.00' },
        bookedAt: new Date('2026-11-23T10:00:00.000Z'),
        updatedAt: new Date('2026-11-23T10:00:00.000Z'),
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
      },
      {
        bookingId: '77777777-8888-9999-0000-222222222222',
        rideId: '88888888-9999-0000-1111-333333333333',
        riderId: mockRiderId,
        seatsBooked: 1,
        status: BookingStatus.CONFIRMED,
        totalAmount: { toString: () => '100.00' },
        bookedAt: new Date('2026-11-22T09:00:00.000Z'),
        updatedAt: new Date('2026-11-22T09:00:00.000Z'),
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
          rideId: '88888888-9999-0000-1111-333333333333',
          driverId: mockDriverId,
          source: 'SRM Tech Park',
          destination: 'Airport Terminal 1',
          departureTime: futureDepartureTime,
          farePerSeat: { toString: () => '100.00' },
          status: RideStatus.SCHEDULED,
        },
      },
    ];

    it('should successfully retrieve passenger booking history with pagination (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(2);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue(mockBookingsList as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get('/api/v1/bookings/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Passenger bookings retrieved successfully');
      expect(res.body.data.bookings).toHaveLength(2);
      expect(res.body.meta.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should return empty list and valid pagination metadata when rider has no bookings', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get('/api/v1/bookings/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookings).toHaveLength(0);
      expect(res.body.meta.pagination.total).toBe(0);
      expect(res.body.meta.pagination.totalPages).toBe(0);
      expect(res.body.meta.pagination.hasNext).toBe(false);
      expect(res.body.meta.pagination.hasPrev).toBe(false);
    });

    it('should correctly support bounded pagination with page and limit queries', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(25);
      const findManySpy = vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([mockBookingsList[0]] as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get('/api/v1/bookings/me?page=2&limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          where: expect.objectContaining({ riderId: mockRiderId }),
        })
      );
      expect(res.body.meta.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 25,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should filter by valid BookingStatus enum (e.g. status=PENDING)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(1);
      const findManySpy = vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([mockBookingsList[0]] as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get('/api/v1/bookings/me?status=PENDING')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            riderId: mockRiderId,
            status: 'PENDING',
          },
        })
      );
    });

    it('should reject invalid status filter parameter (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get('/api/v1/bookings/me?status=INVALID_STATUS')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject attempts to inject riderId or userId query parameters via strict schema (422 Unprocessable Entity)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get(`/api/v1/bookings/me?riderId=${mockOtherRiderId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should apply deterministic ordering (bookedAt: desc, bookingId: asc)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(2);
      const findManySpy = vi.spyOn(prisma.booking, 'findMany').mockResolvedValue(mockBookingsList as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get('/api/v1/bookings/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ bookedAt: 'desc' }, { bookingId: 'asc' }],
        })
      );
    });

    it('should reject unauthenticated request to /me when Authorization header is missing (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/bookings/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Milestone 7C: Driver Passenger Manifest (GET /api/v1/rides/:rideId/bookings)', () => {
    const mockAdminId = '99999999-aaaa-bbbb-cccc-dddddddddddd';
    const mockAdminDbUser = {
      userId: mockAdminId,
      name: 'System Admin',
      email: 'admin@rydora.in',
      phone: '+919999999999',
      roles: [UserRole.USER, 'ADMIN'],
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

    const mockManifestBookings = [
      {
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
      },
    ];

    it('should allow ride owner to retrieve passenger manifest (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue(mockManifestBookings as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}/bookings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Ride passenger manifest retrieved successfully');
      expect(res.body.data.bookings).toHaveLength(1);
      expect(res.body.data.bookings[0].bookingId).toBe(mockBookingId);
      expect(res.body.data.bookings[0].rider.name).toBe('Aarav Patel');
      expect(res.body.meta.pagination.total).toBe(1);
    });

    it('should allow platform admin to retrieve passenger manifest for any ride (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdminDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue(mockManifestBookings as any);

      const token = generateToken(mockAdminId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}/bookings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookings).toHaveLength(1);
    });

    it('should reject unrelated user attempting to view passenger manifest (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRiderDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}/bookings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('You are not authorized to view the passenger manifest');
    });

    it('should reject unauthenticated request when Authorization header is missing (401 Unauthorized)', async () => {
      const res = await request(app).get(`/api/v1/rides/${mockRideId}/bookings`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 Not Found when target ride does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}/bookings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('Ride not found');
    });

    it('should return empty list and valid pagination metadata when ride has no bookings (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(0);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}/bookings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookings).toHaveLength(0);
      expect(res.body.meta.pagination.total).toBe(0);
    });

    it('should support bounded pagination and status filtering on manifest (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(10);
      const findManySpy = vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([mockManifestBookings[0]] as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}/bookings?page=2&limit=5&status=CONFIRMED`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          where: {
            rideId: mockRideId,
            status: 'CONFIRMED',
          },
        })
      );
      expect(res.body.meta.pagination.page).toBe(2);
      expect(res.body.meta.pagination.limit).toBe(5);
    });

    it('should never expose sensitive passenger passwords, hashes, emails, or wallet data in manifest', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.ride, 'findUnique').mockResolvedValue(mockRide as any);
      vi.spyOn(prisma.booking, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.booking, 'findMany').mockResolvedValue(mockManifestBookings as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/rides/${mockRideId}/bookings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const passenger = res.body.data.bookings[0].rider;
      expect(passenger.name).toBe('Aarav Patel');
      expect(passenger.email).toBeUndefined();
      expect(passenger.passwordHash).toBeUndefined();
      expect(passenger.walletBalance).toBeUndefined();
      expect(passenger.licenseNumber).toBeUndefined();
      expect(passenger.phone).toBeUndefined();
    });
  });

  describe('Milestone 7C: Driver Approval (PATCH /api/v1/bookings/:bookingId/approve)', () => {
    const mockOtherDriverId = '55555555-4444-3333-2222-111111111111';
    const mockPendingBookingForApproval = {
      bookingId: mockBookingId,
      rideId: mockRideId,
      riderId: mockRiderId,
      seatsBooked: 2,
      status: BookingStatus.PENDING,
      ride: {
        rideId: mockRideId,
        driverId: mockDriverId,
        status: RideStatus.SCHEDULED,
        departureTime: futureDepartureTime,
      },
    };

    const mockApprovedBookingResult = {
      bookingId: mockBookingId,
      rideId: mockRideId,
      riderId: mockRiderId,
      seatsBooked: 2,
      status: BookingStatus.CONFIRMED,
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

    it('should successfully approve a pending booking (200 OK) without modifying availableSeats', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockPendingBookingForApproval as any)
        .mockResolvedValueOnce(mockApprovedBookingResult as any);
      const updateManySpy = vi.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 1 });
      const rideUpdateSpy = vi.spyOn(prisma.ride, 'update');
      const rideUpdateManySpy = vi.spyOn(prisma.ride, 'updateMany');

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Booking approved successfully');
      expect(res.body.data.booking.status).toBe(BookingStatus.CONFIRMED);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId: mockBookingId, status: BookingStatus.PENDING },
          data: { status: BookingStatus.CONFIRMED },
        })
      );
      // Confirms availableSeats was NOT decremented again during approval
      expect(rideUpdateSpy).not.toHaveBeenCalled();
      expect(rideUpdateManySpy).not.toHaveBeenCalled();
    });

    it('should reject approval when requester is not the driver of the ride (403 Forbidden)', async () => {
      const mockUnauthorizedDriver = {
        ...mockDriverDbUser,
        userId: mockOtherDriverId,
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUnauthorizedDriver as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockPendingBookingForApproval as any);

      const token = generateToken(mockOtherDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Only the driver who published this ride can approve');
    });

    it('should reject unauthenticated approval request (401 Unauthorized)', async () => {
      const res = await request(app).patch(`/api/v1/bookings/${mockBookingId}/approve`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 Not Found when booking does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject approval of an already confirmed booking (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForApproval,
        status: BookingStatus.CONFIRMED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Booking has already been approved');
    });

    it('should reject approval of a cancelled booking (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForApproval,
        status: BookingStatus.CANCELLED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot approve a cancelled booking');
    });

    it('should reject approval of a completed booking (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForApproval,
        status: BookingStatus.COMPLETED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot approve a completed booking');
    });

    it('should reject concurrent approval when atomic updateMany returns count 0 (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockPendingBookingForApproval as any);
      // Simulate concurrent transition by returning count: 0
      vi.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 0 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Booking status transition conflict');
    });
  });

  describe('Milestone 7C: Driver Rejection (PATCH /api/v1/bookings/:bookingId/reject)', () => {
    const mockOtherDriverId = '55555555-4444-3333-2222-111111111111';
    const mockPendingBookingForRejection = {
      bookingId: mockBookingId,
      rideId: mockRideId,
      riderId: mockRiderId,
      seatsBooked: 2,
      status: BookingStatus.PENDING,
      ride: {
        rideId: mockRideId,
        driverId: mockDriverId,
        status: RideStatus.SCHEDULED,
        totalSeats: 4,
        availableSeats: 2, // 2 seats available, 2 seats being returned
        departureTime: futureDepartureTime,
      },
    };

    const mockRejectedBookingResult = {
      bookingId: mockBookingId,
      rideId: mockRideId,
      riderId: mockRiderId,
      seatsBooked: 2,
      status: BookingStatus.CANCELLED,
      totalAmount: { toString: () => '300.00' },
      bookedAt: mockTimestamp,
      updatedAt: mockTimestamp,
      cancelledAt: mockTimestamp,
      cancelledById: mockDriverId,
      cancellationReason: '[REJECTED_BY_DRIVER] Vehicle trunk full of luggage',
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

    it('should successfully reject a pending booking, set CANCELLED status, and restore seats (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockPendingBookingForRejection as any)
        .mockResolvedValueOnce(mockRejectedBookingResult as any);
      const bookingUpdateManySpy = vi.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 1 });
      const rideUpdateManySpy = vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 1 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Vehicle trunk full of luggage' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Booking rejected successfully');
      expect(res.body.data.booking.status).toBe(BookingStatus.CANCELLED);
      expect(res.body.data.booking.cancellationReason).toContain('[REJECTED_BY_DRIVER]');
      expect(bookingUpdateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId: mockBookingId, status: BookingStatus.PENDING },
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            cancelledById: mockDriverId,
          }),
        })
      );
      expect(rideUpdateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            rideId: mockRideId,
            availableSeats: { lte: 4 - 2 },
          },
          data: {
            availableSeats: { increment: 2 },
          },
        })
      );
    });

    it('should reject rejection when requester is not the driver of the ride (403 Forbidden)', async () => {
      const mockUnauthorizedDriver = {
        ...mockDriverDbUser,
        userId: mockOtherDriverId,
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUnauthorizedDriver as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockPendingBookingForRejection as any);

      const token = generateToken(mockOtherDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject rejection of an already confirmed booking (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForRejection,
        status: BookingStatus.CONFIRMED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Cannot reject a booking that has already been confirmed');
    });

    it('should reject repeated rejection of an already cancelled/rejected booking (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForRejection,
        status: BookingStatus.CANCELLED,
      } as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Booking has already been rejected or cancelled');
    });

    it('should abort transaction and throw ConflictError if seat restoration would exceed totalSeats (no silent concealment)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockPendingBookingForRejection as any);
      vi.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 1 });
      // Simulate over-restoration guard (updateMany returns count 0)
      vi.spyOn(prisma.ride, 'updateMany').mockResolvedValue({ count: 0 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Seat restoration failed: available seats on the ride cannot exceed total vehicle capacity');
    });

    it('should reject concurrent rejection when atomic updateMany returns count 0 (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockPendingBookingForRejection as any);
      vi.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 0 });

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Booking status transition conflict');
    });

    it('should rollback transaction and return 500 when unexpected database failure occurs', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockPendingBookingForRejection as any);
      vi.spyOn(prisma.booking, 'updateMany').mockRejectedValue(new Error('Database disk error'));

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should reject rejection when ride status is CANCELLED (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForRejection,
        ride: {
          ...mockPendingBookingForRejection.ride,
          status: RideStatus.CANCELLED,
        },
      } as any);
      const bookingUpdateSpy = vi.spyOn(prisma.booking, 'updateMany');
      const rideUpdateSpy = vi.spyOn(prisma.ride, 'updateMany');

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Only SCHEDULED rides can be managed');
      expect(bookingUpdateSpy).not.toHaveBeenCalled();
      expect(rideUpdateSpy).not.toHaveBeenCalled();
    });

    it('should reject rejection when ride status is COMPLETED (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForRejection,
        ride: {
          ...mockPendingBookingForRejection.ride,
          status: RideStatus.COMPLETED,
        },
      } as any);
      const bookingUpdateSpy = vi.spyOn(prisma.booking, 'updateMany');
      const rideUpdateSpy = vi.spyOn(prisma.ride, 'updateMany');

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Only SCHEDULED rides can be managed');
      expect(bookingUpdateSpy).not.toHaveBeenCalled();
      expect(rideUpdateSpy).not.toHaveBeenCalled();
    });

    it('should reject rejection when ride status is IN_PROGRESS (400 Bad Request)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForRejection,
        ride: {
          ...mockPendingBookingForRejection.ride,
          status: RideStatus.IN_PROGRESS,
        },
      } as any);
      const bookingUpdateSpy = vi.spyOn(prisma.booking, 'updateMany');
      const rideUpdateSpy = vi.spyOn(prisma.ride, 'updateMany');

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Only SCHEDULED rides can be managed');
      expect(bookingUpdateSpy).not.toHaveBeenCalled();
      expect(rideUpdateSpy).not.toHaveBeenCalled();
    });

    it('should reject rejection when ride departure time has already passed (400 Bad Request)', async () => {
      const pastDepartureTime = new Date(Date.now() - 3600 * 1000);
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriverDbUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockPendingBookingForRejection,
        ride: {
          ...mockPendingBookingForRejection.ride,
          departureTime: pastDepartureTime,
        },
      } as any);
      const bookingUpdateSpy = vi.spyOn(prisma.booking, 'updateMany');
      const rideUpdateSpy = vi.spyOn(prisma.ride, 'updateMany');

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .patch(`/api/v1/bookings/${mockBookingId}/reject`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('departure time has already passed');
      expect(bookingUpdateSpy).not.toHaveBeenCalled();
      expect(rideUpdateSpy).not.toHaveBeenCalled();
    });
  });
});
