import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import {
  UserRole,
  RideStatus,
  BookingStatus,
  TransactionType,
  TransactionStatus,
  Prisma,
} from '../../src/generated/prisma/client.js';

describe('Milestone 9.3.1: Driver Earnings Summary & Financial History', () => {
  const mockDriverId = '22222222-2222-2222-2222-222222222222';
  const mockOtherDriverId = '33333333-3333-3333-3333-333333333333';
  const mockPassengerId = '11111111-1111-1111-1111-111111111111';
  const mockAdminId = '99999999-9999-9999-9999-999999999999';
  const mockNonDriverUserId = '88888888-8888-8888-8888-888888888888';

  const mockRideId1 = '55555555-5555-5555-5555-555555555551';
  const mockRideId2 = '55555555-5555-5555-5555-555555555552';
  const mockBookingId1 = '44444444-4444-4444-4444-444444444441';
  const mockBookingId2 = '44444444-4444-4444-4444-444444444442';

  const now = new Date('2026-11-23T12:00:00.000Z');
  const pastHour = new Date('2026-11-23T11:00:00.000Z');
  const yesterday = new Date('2026-11-22T10:00:00.000Z');

  const generateToken = (userId: string): string => {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
  };

  const driverUserRecord = {
    userId: mockDriverId,
    name: 'Vikram Singh',
    email: 'vikram@rydora.in',
    roles: [UserRole.DRIVER],
  };

  const otherDriverUserRecord = {
    userId: mockOtherDriverId,
    name: 'Amit Verma',
    email: 'amit@rydora.in',
    roles: [UserRole.DRIVER],
  };

  const passengerUserRecord = {
    userId: mockPassengerId,
    name: 'Rohan Sharma',
    email: 'rohan@rydora.in',
    roles: [UserRole.USER],
  };

  const adminUserRecord = {
    userId: mockAdminId,
    name: 'System Admin',
    email: 'admin@rydora.in',
    roles: [UserRole.USER, 'ADMIN'],
  };

  const nonDriverUserRecord = {
    userId: mockNonDriverUserId,
    name: 'Pooja Patel',
    email: 'pooja@rydora.in',
    roles: [UserRole.USER],
  };

  let originalAdminUserIds: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    originalAdminUserIds = [...env.ADMIN_USER_IDS];
    env.ADMIN_USER_IDS = [mockAdminId];

    // Mock prisma.user.findUnique to return appropriate role objects
    vi.spyOn(prisma.user, 'findUnique').mockImplementation(async (args: any) => {
      const id = args?.where?.userId;
      if (id === mockDriverId) return driverUserRecord as any;
      if (id === mockOtherDriverId) return otherDriverUserRecord as any;
      if (id === mockPassengerId) return passengerUserRecord as any;
      if (id === mockAdminId) return adminUserRecord as any;
      if (id === mockNonDriverUserId) return nonDriverUserRecord as any;
      return null;
    });
  });

  afterEach(() => {
    env.ADMIN_USER_IDS = originalAdminUserIds;
  });

  // =========================================================================
  // 1. Zero Transactions & Empty State
  // =========================================================================
  it('should return zero earnings summary and empty history for driver with no transactions (200 OK)', async () => {
    const token = generateToken(mockDriverId);

    vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      return {
        _sum: { amount: null },
        _count: { transactionId: 0 },
      } as any;
    });
    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toEqual({
      driverId: mockDriverId,
      currency: 'INR',
      totalGrossEarnings: '0.00',
      totalRefundsDeducted: '0.00',
      totalPlatformFees: '0.00',
      totalNetEarnings: '0.00',
      completedPaymentsCount: 0,
      refundedTransactionsCount: 0,
    });
    expect(res.body.data.history).toEqual([]);
    expect(res.body.meta.pagination).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  // =========================================================================
  // 2. Completed Payments Only
  // =========================================================================
  it('should correctly sum completed payments and calculate gross = net earnings when no refunds exist', async () => {
    const token = generateToken(mockDriverId);

    const mockCompletedPayment = {
      transactionId: '11111111-2222-3333-4444-555555555555',
      bookingId: mockBookingId1,
      senderId: mockPassengerId,
      receiverId: mockDriverId,
      amount: new Prisma.Decimal('700.00'),
      currency: 'INR',
      type: TransactionType.BOOKING_PAYMENT,
      status: TransactionStatus.COMPLETED,
      paymentMethod: 'UPI',
      providerReference: 'prov_ref_123',
      referenceTransactionId: null,
      description: 'Ride booking payment',
      createdAt: pastHour,
      updatedAt: pastHour,
      completedAt: pastHour,
      booking: {
        bookingId: mockBookingId1,
        rideId: mockRideId1,
        seatsBooked: 2,
        status: BookingStatus.CONFIRMED,
        totalAmount: new Prisma.Decimal('700.00'),
        rider: {
          userId: mockPassengerId,
          name: 'Rohan Sharma',
        },
        ride: {
          rideId: mockRideId1,
          source: 'Indiranagar',
          destination: 'Whitefield',
          departureTime: now,
          status: RideStatus.SCHEDULED,
        },
      },
    };

    vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      if (args.where?.type === TransactionType.BOOKING_PAYMENT) {
        return {
          _sum: { amount: new Prisma.Decimal('700.00') },
          _count: { transactionId: 1 },
        } as any;
      }
      return {
        _sum: { amount: null },
        _count: { transactionId: 0 },
      } as any;
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(1);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([mockCompletedPayment as any]);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalGrossEarnings).toBe('700.00');
    expect(res.body.data.summary.totalRefundsDeducted).toBe('0.00');
    expect(res.body.data.summary.totalPlatformFees).toBe('0.00');
    expect(res.body.data.summary.totalNetEarnings).toBe('700.00');
    expect(res.body.data.summary.completedPaymentsCount).toBe(1);
    expect(res.body.data.summary.refundedTransactionsCount).toBe(0);

    expect(res.body.data.history).toHaveLength(1);
    expect(res.body.data.history[0].amount).toBe('700.00');
    expect(res.body.data.history[0].type).toBe(TransactionType.BOOKING_PAYMENT);
    expect(res.body.data.history[0].booking.rider.name).toBe('Rohan Sharma');
    expect(res.body.data.history[0].ride.source).toBe('Indiranagar');
  });

  // =========================================================================
  // 3. PENDING, FAILED and REVERSED Exclusions
  // =========================================================================
  it('should strictly query TransactionStatus.COMPLETED and exclude PENDING, FAILED, and REVERSED transactions', async () => {
    const token = generateToken(mockDriverId);

    const aggregateSpy = vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      // Invariant: Both paymentWhere and refundWhere must strictly require status: COMPLETED
      expect(args.where.status).toBe(TransactionStatus.COMPLETED);
      return {
        _sum: { amount: new Prisma.Decimal('300.00') },
        _count: { transactionId: 1 },
      } as any;
    });

    const findManySpy = vi.spyOn(prisma.transaction, 'findMany').mockImplementation(async (args: any) => {
      // Invariant: The history query must enforce COMPLETED status across all OR branches
      args.where.OR.forEach((branch: any) => {
        expect(branch.status).toBe(TransactionStatus.COMPLETED);
      });
      return [];
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(aggregateSpy).toHaveBeenCalled();
    expect(findManySpy).toHaveBeenCalled();
  });

  // =========================================================================
  // 4. Full and Partial Refunds
  // =========================================================================
  it('should correctly deduct 50% partial refund and retain driver compensation in net earnings', async () => {
    const token = generateToken(mockDriverId);

    // Initial payment: 500.00, late cancel refund: 250.00 -> Net: 250.00
    vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      if (args.where?.type === TransactionType.BOOKING_PAYMENT) {
        return {
          _sum: { amount: new Prisma.Decimal('500.00') },
          _count: { transactionId: 1 },
        } as any;
      }
      if (args.where?.type === TransactionType.REFUND) {
        return {
          _sum: { amount: new Prisma.Decimal('250.00') },
          _count: { transactionId: 1 },
        } as any;
      }
      return { _sum: { amount: null }, _count: { transactionId: 0 } } as any;
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(2);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalGrossEarnings).toBe('500.00');
    expect(res.body.data.summary.totalRefundsDeducted).toBe('250.00');
    expect(res.body.data.summary.totalNetEarnings).toBe('250.00');
    expect(res.body.data.summary.completedPaymentsCount).toBe(1);
    expect(res.body.data.summary.refundedTransactionsCount).toBe(1);
  });

  it('should yield 0.00 net earnings when a booking is 100% fully refunded', async () => {
    const token = generateToken(mockDriverId);

    vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      if (args.where?.type === TransactionType.BOOKING_PAYMENT) {
        return {
          _sum: { amount: new Prisma.Decimal('400.00') },
          _count: { transactionId: 1 },
        } as any;
      }
      if (args.where?.type === TransactionType.REFUND) {
        return {
          _sum: { amount: new Prisma.Decimal('400.00') },
          _count: { transactionId: 1 },
        } as any;
      }
      return { _sum: { amount: null }, _count: { transactionId: 0 } } as any;
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(2);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalGrossEarnings).toBe('400.00');
    expect(res.body.data.summary.totalRefundsDeducted).toBe('400.00');
    expect(res.body.data.summary.totalNetEarnings).toBe('0.00');
  });

  // =========================================================================
  // 5. Refund Reference Ownership & Invariant Verification
  // =========================================================================
  it('should enforce referenceTransaction receiver matching target driver in refund aggregation', async () => {
    const token = generateToken(mockDriverId);

    const aggregateSpy = vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      if (args.where?.type === TransactionType.REFUND) {
        expect(args.where.senderId).toBe(mockDriverId);
        expect(args.where.referenceTransaction).toEqual({
          receiverId: mockDriverId,
          type: TransactionType.BOOKING_PAYMENT,
        });
      }
      return { _sum: { amount: null }, _count: { transactionId: 0 } } as any;
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(aggregateSpy).toHaveBeenCalled();
  });

  // =========================================================================
  // 6. Decimal Precision Without Floating Point Inaccuracies
  // =========================================================================
  it('should maintain exact Decimal precision with odd cents (e.g. 199.99 + 149.50 - 49.50 = 299.99)', async () => {
    const token = generateToken(mockDriverId);

    vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      if (args.where?.type === TransactionType.BOOKING_PAYMENT) {
        return {
          _sum: { amount: new Prisma.Decimal('349.49') },
          _count: { transactionId: 2 },
        } as any;
      }
      if (args.where?.type === TransactionType.REFUND) {
        return {
          _sum: { amount: new Prisma.Decimal('49.50') },
          _count: { transactionId: 1 },
        } as any;
      }
      return { _sum: { amount: null }, _count: { transactionId: 0 } } as any;
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(3);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalGrossEarnings).toBe('349.49');
    expect(res.body.data.summary.totalRefundsDeducted).toBe('49.50');
    expect(res.body.data.summary.totalNetEarnings).toBe('299.99');
  });

  // =========================================================================
  // 7. Date Boundaries & Date Range Validation
  // =========================================================================
  it('should apply inclusive completedAt date boundaries to summary and history queries', async () => {
    const token = generateToken(mockDriverId);

    const aggregateSpy = vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      expect(args.where.completedAt.gte).toEqual(new Date('2026-11-01T00:00:00.000Z'));
      expect(args.where.completedAt.lte).toEqual(new Date('2026-11-20T23:59:59.999Z'));
      return { _sum: { amount: null }, _count: { transactionId: 0 } } as any;
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings?startDate=2026-11-01&endDate=2026-11-20')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(aggregateSpy).toHaveBeenCalled();
  });

  it('should reject invalid startDate format with 422 Unprocessable Entity', async () => {
    const token = generateToken(mockDriverId);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings?startDate=invalid-date')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('should reject when startDate is later than endDate with 422 Unprocessable Entity', async () => {
    const token = generateToken(mockDriverId);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings?startDate=2026-11-20&endDate=2026-11-10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    const detailMsg = res.body.error.details
      ? JSON.stringify(res.body.error.details)
      : res.body.error.message;
    expect(detailMsg).toContain('startDate cannot be later than endDate');
  });

  // =========================================================================
  // 8. Ride ID Filtering
  // =========================================================================
  it('should apply rideId filter to booking relation for payments and refunds', async () => {
    const token = generateToken(mockDriverId);

    const aggregateSpy = vi.spyOn(prisma.transaction, 'aggregate').mockImplementation(async (args: any) => {
      expect(args.where.booking).toEqual({ rideId: mockRideId1 });
      return { _sum: { amount: null }, _count: { transactionId: 0 } } as any;
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/v1/payments/driver/earnings?rideId=${mockRideId1}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(aggregateSpy).toHaveBeenCalled();
  });

  // =========================================================================
  // 9. Pagination
  // =========================================================================
  it('should respect page and limit query parameters and return pagination metadata', async () => {
    const token = generateToken(mockDriverId);

    vi.spyOn(prisma.transaction, 'aggregate').mockResolvedValue({
      _sum: { amount: null },
      _count: { transactionId: 0 },
    } as any);

    const findManySpy = vi.spyOn(prisma.transaction, 'findMany').mockImplementation(async (args: any) => {
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
      return [];
    });

    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(25);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings?page=3&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalled();
    expect(res.body.meta.pagination).toEqual({
      total: 25,
      page: 3,
      limit: 10,
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
  });

  // =========================================================================
  // 10. Authorization & Security Boundary
  // =========================================================================
  it('should reject unauthenticated request with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/payments/driver/earnings');
    expect(res.status).toBe(401);
  });

  it('should reject regular non-driver passenger user with 403 Forbidden', async () => {
    const token = generateToken(mockPassengerId);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should reject driver attempt to query another driver earnings with 403 Forbidden', async () => {
    const token = generateToken(mockDriverId);

    const res = await request(app)
      .get(`/api/v1/payments/driver/earnings?driverId=${mockOtherDriverId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Drivers can only view their own earnings');
  });

  it('should allow platform ADMIN to view earnings of a specified driver', async () => {
    const token = generateToken(mockAdminId);

    vi.spyOn(prisma.transaction, 'aggregate').mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('1000.00') },
      _count: { transactionId: 2 },
    } as any);
    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(2);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/v1/payments/driver/earnings?driverId=${mockDriverId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.driverId).toBe(mockDriverId);
  });

  it('should return 404 Not Found when admin queries non-existent driver', async () => {
    const token = generateToken(mockAdminId);
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .get(`/api/v1/payments/driver/earnings?driverId=${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('Driver not found');
  });

  it('should return 400 Bad Request when admin queries user who does not have DRIVER role', async () => {
    const token = generateToken(mockAdminId);

    const res = await request(app)
      .get(`/api/v1/payments/driver/earnings?driverId=${mockNonDriverUserId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Specified user is not a driver');
  });

  // =========================================================================
  // 11. Safe Response Projection & Credential Privacy
  // =========================================================================
  it('should not leak passwords, license details, or private driver fields in response', async () => {
    const token = generateToken(mockDriverId);

    const mockItem = {
      transactionId: '11111111-2222-3333-4444-555555555555',
      bookingId: mockBookingId1,
      senderId: mockPassengerId,
      receiverId: mockDriverId,
      amount: new Prisma.Decimal('200.00'),
      currency: 'INR',
      type: TransactionType.BOOKING_PAYMENT,
      status: TransactionStatus.COMPLETED,
      paymentMethod: 'UPI',
      providerReference: 'prov_ref_safe',
      referenceTransactionId: null,
      description: 'Clean description',
      createdAt: pastHour,
      updatedAt: pastHour,
      completedAt: pastHour,
      booking: {
        bookingId: mockBookingId1,
        rideId: mockRideId1,
        seatsBooked: 1,
        status: BookingStatus.CONFIRMED,
        totalAmount: new Prisma.Decimal('200.00'),
        rider: {
          userId: mockPassengerId,
          name: 'Rohan Sharma',
        },
        ride: {
          rideId: mockRideId1,
          source: 'City A',
          destination: 'City B',
          departureTime: now,
          status: RideStatus.SCHEDULED,
        },
      },
    };

    vi.spyOn(prisma.transaction, 'aggregate').mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('200.00') },
      _count: { transactionId: 1 },
    } as any);
    vi.spyOn(prisma.transaction, 'count').mockResolvedValue(1);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([mockItem as any]);

    const res = await request(app)
      .get('/api/v1/payments/driver/earnings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('license');
    expect(bodyStr).not.toContain('walletBalance');
  });
});
