import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { UserRole, BookingStatus, RideStatus } from '../../src/generated/prisma/client.js';
import { _clearSubmittedRatingsCache } from '../../src/services/rating.service.js';

describe('Milestone 10: Ratings & Reviews Foundation and Aggregation', () => {
  const mockDriverId = '11111111-2222-3333-4444-555555555555';
  const mockRiderId = '22222222-3333-4444-5555-666666666666';
  const mockStrangerId = '33333333-4444-5555-6666-777777777777';
  const mockRideId = '44444444-5555-6666-7777-888888888888';
  const mockBookingId = '55555555-6666-7777-8888-999999999999';

  const mockTimestamp = new Date('2026-11-23T10:00:00.000Z');

  const createToken = (userId: string) => {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
  };

  const riderToken = createToken(mockRiderId);
  const driverToken = createToken(mockDriverId);
  const strangerToken = createToken(mockStrangerId);

  const mockRiderUser = {
    userId: mockRiderId,
    name: 'Aarav Patel',
    email: 'aarav.rider@rydora.in',
    phone: '+919876543299',
    roles: [UserRole.USER],
    driverVerified: false,
    walletBalance: '100.00',
    averageRating: '4.50',
    ratingCount: 2,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockDriverUser = {
    userId: mockDriverId,
    name: 'Rohan Sharma',
    email: 'rohan.driver@rydora.in',
    phone: '+919876543210',
    roles: [UserRole.USER, UserRole.DRIVER],
    driverVerified: true,
    walletBalance: '250.00',
    averageRating: '4.80',
    ratingCount: 5,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockStrangerUser = {
    userId: mockStrangerId,
    name: 'Anonymous Stranger',
    email: 'stranger@rydora.in',
    phone: '+919876543219',
    roles: [UserRole.USER],
    driverVerified: false,
    walletBalance: '0.00',
    averageRating: '0.00',
    ratingCount: 0,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockCompletedBooking = {
    bookingId: mockBookingId,
    rideId: mockRideId,
    riderId: mockRiderId,
    seatsBooked: 2,
    status: BookingStatus.COMPLETED,
    totalAmount: '180.00',
    bookedAt: mockTimestamp,
    updatedAt: mockTimestamp,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    ride: {
      rideId: mockRideId,
      driverId: mockDriverId,
      status: RideStatus.COMPLETED,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    _clearSubmittedRatingsCache();

    // Mock User findUnique for authenticate middleware & services
    vi.spyOn(prisma.user, 'findUnique').mockImplementation(async ({ where }: any) => {
      if (where.userId === mockRiderId) return mockRiderUser as any;
      if (where.userId === mockDriverId) return mockDriverUser as any;
      if (where.userId === mockStrangerId) return mockStrangerUser as any;
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('M10.1 — Rating Creation API (POST /api/v1/ratings)', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/ratings')
        .send({ bookingId: mockBookingId, rating: 5 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid UUID format for bookingId with 400/422 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: 'not-a-uuid', rating: 5 });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-integer or out-of-range rating score with 400/422 validation error', async () => {
      const resZero = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: mockBookingId, rating: 0 });
      expect(resZero.status).toBe(422);

      const resSix = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: mockBookingId, rating: 6 });
      expect(resSix.status).toBe(422);

      const resDecimal = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: mockBookingId, rating: 4.5 });
      expect(resDecimal.status).toBe(422);
    });

    it('should reject review text longer than 500 characters', async () => {
      const longReview = 'a'.repeat(501);
      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: mockBookingId, rating: 5, review: longReview });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 Not Found if the booking does not exist', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: mockBookingId, rating: 5 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject rating submission if the booking is not COMPLETED (e.g. PENDING or CONFIRMED)', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockCompletedBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: mockBookingId, rating: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('completed bookings');
    });

    it('should return 403 Forbidden if requester is neither rider nor driver of the ride', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCompletedBooking as any);

      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ bookingId: mockBookingId, rating: 5 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should successfully allow rider to rate driver and update driver aggregate rating atomically', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCompletedBooking as any);

      // Driver currently has avg 4.80 from 5 ratings (sum = 24). New rating is 5 -> sum = 29, count = 6 -> avg = 4.83
      const updatedDriver = {
        userId: mockDriverId,
        name: 'Rohan Sharma',
        averageRating: '4.83',
        ratingCount: 6,
      };

      const updateSpy = vi.spyOn(prisma.user, 'update').mockResolvedValue(updatedDriver as any);

      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          bookingId: mockBookingId,
          rating: 5,
          review: 'Smooth and pleasant ride, highly recommended!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookingId).toBe(mockBookingId);
      expect(res.body.data.raterId).toBe(mockRiderId);
      expect(res.body.data.targetUserId).toBe(mockDriverId);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.review).toBe('Smooth and pleasant ride, highly recommended!');
      expect(res.body.data.targetUser.averageRating).toBe('4.83');
      expect(res.body.data.targetUser.ratingCount).toBe(6);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { userId: mockDriverId },
        data: { averageRating: 4.83, ratingCount: 6 },
        select: expect.any(Object),
      });
    });

    it('should successfully allow driver to rate passenger and update passenger aggregate rating atomically', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCompletedBooking as any);

      // Rider currently has avg 4.50 from 2 ratings (sum = 9). New rating is 4 -> sum = 13, count = 3 -> avg = 4.33
      const updatedRider = {
        userId: mockRiderId,
        name: 'Aarav Patel',
        averageRating: '4.33',
        ratingCount: 3,
      };

      const updateSpy = vi.spyOn(prisma.user, 'update').mockResolvedValue(updatedRider as any);

      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          bookingId: mockBookingId,
          rating: 4,
          review: 'Punctual passenger.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetUserId).toBe(mockRiderId);
      expect(res.body.data.targetUser.averageRating).toBe('4.33');
      expect(res.body.data.targetUser.ratingCount).toBe(3);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { userId: mockRiderId },
        data: { averageRating: 4.33, ratingCount: 3 },
        select: expect.any(Object),
      });
    });

    it('should reject duplicate rating submissions on the same booking with 409 Conflict', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCompletedBooking as any);
      vi.spyOn(prisma.user, 'update').mockResolvedValue({
        userId: mockDriverId,
        name: 'Rohan Sharma',
        averageRating: '4.83',
        ratingCount: 6,
      } as any);

      // First submission succeeds
      const firstRes = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: mockBookingId, rating: 5 });
      expect(firstRes.status).toBe(201);

      // Second submission for same booking by same rider fails
      const duplicateRes = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ bookingId: mockBookingId, rating: 4 });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error.code).toBe('CONFLICT');
      expect(duplicateRes.body.error.message).toContain('already submitted a rating');
    });

    it('should work via the booking sub-route alias POST /api/v1/bookings/:bookingId/rating', async () => {
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCompletedBooking as any);
      vi.spyOn(prisma.user, 'update').mockResolvedValue({
        userId: mockDriverId,
        name: 'Rohan Sharma',
        averageRating: '4.83',
        ratingCount: 6,
      } as any);

      const res = await request(app)
        .post(`/api/v1/bookings/${mockBookingId}/rating`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ rating: 5 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookingId).toBe(mockBookingId);
    });
  });

  describe('M10.2 — Rating Retrieval and Aggregation API', () => {
    it('should retrieve authenticated user rating profile via GET /api/v1/ratings/me', async () => {
      const res = await request(app)
        .get('/api/v1/ratings/me')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(mockDriverId);
      expect(res.body.data.averageRating).toBe('4.80');
      expect(res.body.data.ratingCount).toBe(5);
      expect(res.body.data.breakdown.summary).toBe('4.80 / 5.00 (5 ratings)');
    });

    it('should retrieve any user or driver rating profile via GET /api/v1/ratings/:userId', async () => {
      const res = await request(app)
        .get(`/api/v1/ratings/${mockDriverId}`)
        .set('Authorization', `Bearer ${riderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(mockDriverId);
      expect(res.body.data.averageRating).toBe('4.80');
      expect(res.body.data.ratingCount).toBe(5);
    });

    it('should retrieve rating profile via GET /api/v1/users/:userId/ratings', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${mockDriverId}/ratings`)
        .set('Authorization', `Bearer ${riderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(mockDriverId);
    });

    it('should handle users with zero ratings gracefully', async () => {
      const res = await request(app)
        .get(`/api/v1/ratings/${mockStrangerId}`)
        .set('Authorization', `Bearer ${riderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.averageRating).toBe('0.00');
      expect(res.body.data.ratingCount).toBe(0);
      expect(res.body.data.breakdown.summary).toBe('No ratings received yet');
    });

    it('should return 404 Not Found if target user does not exist', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';
      const res = await request(app)
        .get(`/api/v1/ratings/${nonExistentId}`)
        .set('Authorization', `Bearer ${riderToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
