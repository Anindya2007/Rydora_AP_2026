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
} from '../../src/generated/prisma/client.js';
import { paymentService } from '../../src/services/payment.service.js';
import {
  SimulatedPaymentProvider,
  defaultPaymentProvider,
  type PaymentProvider,
} from '../../src/services/payment-provider.js';

describe('Milestone 9.2: Refund Processing & Booking Financial Lifecycle', () => {
  const mockRiderId = '11111111-1111-1111-1111-111111111111';
  const mockDriverId = '22222222-2222-2222-2222-222222222222';
  const mockOtherUserId = '33333333-3333-3333-3333-333333333333';
  const mockAdminId = '99999999-9999-9999-9999-999999999999';

  const mockBookingId = '44444444-4444-4444-4444-444444444444';
  const mockRideId = '55555555-5555-5555-5555-555555555555';
  const mockPaymentTransactionId = '66666666-6666-6666-6666-666666666666';
  const mockRefundTransactionId = '77777777-7777-7777-7777-777777777777';

  const now = new Date();
  // Departure 4 hours from now (eligible for 100% full refund)
  const departureIn4Hours = new Date(Date.now() + 4 * 60 * 60 * 1000);
  // Departure 1 hour from now (eligible for 50% late cancel refund)
  const departureIn1Hour = new Date(Date.now() + 1 * 60 * 60 * 1000);

  const mockRider = {
    userId: mockRiderId,
    name: 'Rohan Sharma',
    email: 'rohan@rydora.in',
    phone: '+919876500001',
    roles: [UserRole.USER],
  };

  const mockOtherUser = {
    userId: mockOtherUserId,
    name: 'Sneha Rao',
    email: 'sneha@rydora.in',
    phone: '+919876500003',
    roles: [UserRole.USER],
  };

  const mockAdmin = {
    userId: mockAdminId,
    name: 'System Admin',
    email: 'admin@rydora.in',
    phone: '+919876599999',
    roles: ['ADMIN'],
  };

  const mockCancelledBookingFull = {
    bookingId: mockBookingId,
    rideId: mockRideId,
    riderId: mockRiderId,
    seatsBooked: 2,
    totalAmount: '400.00',
    status: BookingStatus.CANCELLED,
    cancelledAt: now,
    cancelledById: mockRiderId,
    cancellationReason: '[CANCELLED_BY_RIDER: FULL_REFUND] (> 2 hours prior to departure; 100% refund policy)',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: now,
    ride: {
      rideId: mockRideId,
      driverId: mockDriverId,
      status: RideStatus.SCHEDULED,
      departureTime: departureIn4Hours,
    },
  };

  const mockCancelledBooking50 = {
    bookingId: mockBookingId,
    rideId: mockRideId,
    riderId: mockRiderId,
    seatsBooked: 2,
    totalAmount: '400.00',
    status: BookingStatus.CANCELLED,
    cancelledAt: now,
    cancelledById: mockRiderId,
    cancellationReason: '[CANCELLED_BY_RIDER: LATE_CANCEL_50_PERCENT] (< 2 hours prior to departure; 50% refund policy applies)',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: now,
    ride: {
      rideId: mockRideId,
      driverId: mockDriverId,
      status: RideStatus.SCHEDULED,
      departureTime: departureIn1Hour,
    },
  };

  const mockOriginalPayment = {
    transactionId: mockPaymentTransactionId,
    bookingId: mockBookingId,
    senderId: mockRiderId,
    receiverId: mockDriverId,
    amount: '400.00',
    currency: 'INR',
    type: TransactionType.BOOKING_PAYMENT,
    status: TransactionStatus.COMPLETED,
    paymentMethod: 'UPI',
    providerReference: 'sim_pay_orig_123',
    referenceTransactionId: null,
    description: 'Original booking payment',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 3600000),
  };

  const mockRefundRecord = {
    transactionId: mockRefundTransactionId,
    bookingId: mockBookingId,
    senderId: mockDriverId, // Reversal
    receiverId: mockRiderId, // Reversal
    amount: '400.00',
    currency: 'INR',
    type: TransactionType.REFUND,
    status: TransactionStatus.COMPLETED,
    paymentMethod: 'UPI',
    providerReference: 'sim_rf_789',
    referenceTransactionId: mockPaymentTransactionId,
    description: '[IDEMPOTENCY:rf_key_1] [POLICY:100%_FULL_REFUND]',
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  };

  const generateToken = (userId: string): string => {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
  };

  let originalAdminUserIds: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    originalAdminUserIds = [...env.ADMIN_USER_IDS];
    env.ADMIN_USER_IDS = [mockAdminId];
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);
    vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockRefundRecord as any);
    vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return Promise.all(callback);
    });
  });

  afterEach(() => {
    env.ADMIN_USER_IDS = originalAdminUserIds;
    vi.restoreAllMocks();
    (defaultPaymentProvider as any).clearProcessed?.();
  });

  // =========================================================================
  // 1. REFUND ELIGIBILITY & CALCULATION (100% vs 50%)
  // =========================================================================
  describe('Refund Eligibility & Policy Calculation', () => {
    it('1. should process a 100% FULL REFUND when cancelled >= 120 minutes prior to departure', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]); // No existing refunds

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          reason: 'Trip plans cancelled well in advance',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.type).toBe('REFUND');
      expect(res.body.data.transaction.status).toBe('COMPLETED');
      expect(res.body.data.transaction.amount).toBe('400.00'); // 100% of 400
      expect(res.body.data.transaction.referenceTransactionId).toBe(mockPaymentTransactionId);
      expect(res.body.data.transaction.senderId).toBe(mockDriverId);
      expect(res.body.data.transaction.receiverId).toBe(mockRiderId);
    });

    it('2. should process a 50% LATE CANCELLATION REFUND when cancelled < 120 minutes prior to departure', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBooking50 as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]); // No existing refunds

      const halfRefundRecord = {
        ...mockRefundRecord,
        amount: '200.00',
      };
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(halfRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post(`/api/v1/bookings/${mockBookingId}/refund`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: 'Late cancellation',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('200.00'); // 50% of 400
      expect(res.body.data.transaction.referenceTransactionId).toBe(mockPaymentTransactionId);
    });

    it('3. should reject refund request with 400 Bad Request if booking is NOT cancelled (e.g. still CONFIRMED)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockCancelledBookingFull,
        status: BookingStatus.CONFIRMED,
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Booking must be CANCELLED');
    });

    it('4. should reject refund request with 400 Bad Request if no completed payment exists for the booking', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null); // No completed payment

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('No completed payment found');
    });
  });

  // =========================================================================
  // 2. CONCURRENCY, DUPLICATES & CUMULATIVE CAPS
  // =========================================================================
  describe('Duplicate Refund and Concurrency Protection', () => {
    it('5. should replay idempotently with 200 OK when same refund idempotency key is submitted', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);

      const existingRefund = {
        ...mockRefundRecord,
        description: '[IDEMPOTENCY:rf_duplicate_key_1] [POLICY:100%_FULL_REFUND]',
      };
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([existingRefund as any]);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'rf_duplicate_key_1',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.duplicateSuppressed).toBe(true);
      expect(res.body.data.transaction.transactionId).toBe(mockRefundTransactionId);
    });

    it('6. should reject new refund request with 409 Conflict if an unresolved PENDING refund already exists', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);

      const existingPendingRefund = {
        ...mockRefundRecord,
        status: TransactionStatus.PENDING,
        description: '[IDEMPOTENCY:rf_pending_attempt_1]',
      };
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([existingPendingRefund as any]);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'new_competing_key_2',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('currently pending and unresolved');
    });

    it('7. should reject refund request with 409 Conflict if booking has already been fully refunded', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);

      // Already refunded full 400.00
      const existingCompletedRefund = {
        ...mockRefundRecord,
        status: TransactionStatus.COMPLETED,
        amount: '400.00',
        description: '[IDEMPOTENCY:previous_rf_key]',
      };
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([existingCompletedRefund as any]);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'fresh_attempt_after_full_refund',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already been fully refunded');
    });
  });

  // =========================================================================
  // 3. TWO-PHASE RELIABILITY & OUTCOME HANDLING
  // =========================================================================
  describe('Refund Provider Reliability & Error Isolation', () => {
    it('8. should record FAILED refund transaction when provider rejects refund', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const failedRefundRecord = {
        ...mockRefundRecord,
        status: TransactionStatus.FAILED,
        completedAt: null,
      };
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(failedRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          reason: 'SIMULATE_FAILURE: Gateway card rejection',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('FAILED');
      expect(res.body.data.transaction.completedAt).toBeNull();
    });

    it('9. should preserve PENDING refund intent when provider times out or returns ambiguous outcome', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const pendingRefundRecord = {
        ...mockRefundRecord,
        status: TransactionStatus.PENDING,
        completedAt: null,
      };
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(pendingRefundRecord as any);

      const timeoutProvider: PaymentProvider = {
        async processPayment() {
          throw new Error('Not implemented');
        },
        async processRefund() {
          throw new Error('Connection timeout while waiting for refund gateway');
        },
      };

      const result = await paymentService.processBookingRefund(
        mockRiderId,
        {
          bookingId: mockBookingId,
          reason: 'Testing timeout',
        },
        timeoutProvider
      );

      expect(result.transaction.status).toBe('PENDING');
      expect(result.transaction.completedAt).toBeNull();
    });

    it('10. should log critical reconciliation error and retain PENDING intent when provider succeeds but database update fails', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const intentRecord = {
        ...mockRefundRecord,
        status: TransactionStatus.PENDING,
        providerReference: 'intent_rf_orphan_test',
        completedAt: null,
      };
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(intentRecord as any);

      let callCount = 0;
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        callCount++;
        if (callCount === 1) {
          return callback(prisma); // Phase 1 succeeds
        }
        throw new Error('Database connection dropped during Phase 3 refund persistence');
      });

      const successfulProvider: PaymentProvider = {
        async processPayment() {
          throw new Error('Not implemented');
        },
        async processRefund() {
          return {
            success: true,
            status: 'COMPLETED',
            providerReference: 'sim_rf_confirmed_success_888',
            isSimulated: true,
          };
        },
      };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await paymentService.processBookingRefund(
        mockRiderId,
        {
          bookingId: mockBookingId,
          reason: 'Test orphan scenario',
        },
        successfulProvider
      );

      expect(result.transaction.status).toBe('PENDING');
      expect(result.transaction.providerReference).toBe('sim_rf_confirmed_success_888');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL_REFUND_RECONCILIATION_REQUIRED]')
      );
      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // 4. AUTHORIZATION & ACCESS CONTROL
  // =========================================================================
  describe('Authorization and Access Control', () => {
    it('11. should reject third-party user from refunding another user booking with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('12. should allow platform ADMIN to process refund on behalf of rider (201 Created)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdmin as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockAdminId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          reason: 'Admin-initiated refund',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.type).toBe('REFUND');
    });
  });

  // =========================================================================
  // 5. M9.2.1 POLICY INTEGRITY, TRUST BOUNDARY & PRECISION TESTS
  // =========================================================================
  describe('Milestone 9.2.1: Targeted Policy Integrity, Trust Boundary & Precision', () => {
    it('13. [SEC-1] should strictly enforce 50% late cancellation policy even if user cancellation reason contains FULL_REFUND', async () => {
      // Setup: Late cancellation (< 120 mins) where passenger injected "FULL_REFUND" into their cancellation reason
      const injectedBooking = {
        ...mockCancelledBooking50,
        cancellationReason:
          '[CANCELLED_BY_RIDER: LATE_CANCEL_50_PERCENT] Please give me a FULL_REFUND immediately due to urgent reasons',
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(injectedBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const halfRefundRecord = {
        ...mockRefundRecord,
        amount: '200.00',
        description: '[IDEMPOTENCY:rf_sec_1] [POLICY:50%_LATE_CANCEL]',
      };
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(halfRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          reason: 'I want a FULL_REFUND',
          idempotencyKey: 'rf_sec_1',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Under SEC-1, the untrusted reason text must be completely ignored; strictly 50% of 400.00 = 200.00
      expect(res.body.data.transaction.amount).toBe('200.00');
    });

    it('14. [BIZ-1] should grant 100% full refund when booking was rejected by driver < 120 mins before departure', async () => {
      // Driver rejected 1 hour before departure (diff < 120 mins). Passenger must NOT be penalized.
      const driverRejectedBooking = {
        ...mockCancelledBooking50,
        cancelledById: mockDriverId, // Cancelled by driver
        cancellationReason: '[REJECTED_BY_DRIVER] Driver vehicle breakdown',
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(driverRejectedBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Passenger receives full 100% refund (400.00) because cancellation was initiated by the driver
      expect(res.body.data.transaction.amount).toBe('400.00');
    });

    it('15. [BIZ-1] should grant 100% full refund when booking was rejected by driver > 120 mins before departure', async () => {
      // Driver rejected 4 hours before departure
      const driverRejectedBookingEarly = {
        ...mockCancelledBookingFull,
        cancelledById: mockDriverId,
        cancellationReason: '[REJECTED_BY_DRIVER] Driver schedule changed',
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(driverRejectedBookingEarly as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('400.00');
    });

    it('16. [BIZ-1] should grant 100% full refund when booking was cancelled by platform admin', async () => {
      // Admin cancelled for safety/moderation within 1 hour of departure
      const adminCancelledBooking = {
        ...mockCancelledBooking50,
        cancelledById: mockAdminId, // Cancelled by platform admin
        cancellationReason: '[CANCELLED_BY_ADMIN] Safety incident reported on route',
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(adminCancelledBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('400.00');
    });

    it('17. [TIME-1] should fail safely with 400 Bad Request when cancelledAt is missing, even after scheduled departure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Ride scheduled departure was in the past (e.g. 2 hours ago), cancelledAt is null
      const pastDeparture = new Date(Date.now() - 7200 * 1000);
      const missingCancelledAtBooking = {
        ...mockCancelledBooking50,
        cancelledAt: null, // Missing cancelledAt
        ride: {
          ...mockCancelledBooking50.ride,
          departureTime: pastDeparture,
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(missingCancelledAtBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      // Must fail safely with clear domain error, not silently downgrade or grant full refund
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('cancellation timestamp (cancelledAt) is missing');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[REFUND_ERROR]'));
      consoleErrorSpy.mockRestore();
    });

    it('18. [FIN-1] should verify Decimal ROUND_DOWN arithmetic across representative amounts under 50% policy', async () => {
      const testCases = [
        { original: '100.00', expectedRefund: '50.00', expectError: false },
        { original: '99.99', expectedRefund: '49.99', expectError: false },
        { original: '10.01', expectedRefund: '5.00', expectError: false },
        { original: '123.45', expectedRefund: '61.72', expectError: false },
        { original: '0.01', expectedRefund: '0.00', expectError: true },
      ];

      for (const tc of testCases) {
        const paymentRecord = {
          ...mockOriginalPayment,
          amount: tc.original,
        };
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
        vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBooking50 as any);
        vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(paymentRecord as any);
        vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

        if (!tc.expectError) {
          const dynamicRefund = {
            ...mockRefundRecord,
            amount: tc.expectedRefund,
          };
          vi.spyOn(prisma.transaction, 'update').mockResolvedValue(dynamicRefund as any);
        }

        const token = generateToken(mockRiderId);
        const res = await request(app)
          .post('/api/v1/payments/refund')
          .set('Authorization', `Bearer ${token}`)
          .send({
            bookingId: mockBookingId,
            idempotencyKey: `rf_fin_${tc.original}`,
          });

        if (tc.expectError) {
          expect(res.status).toBe(400);
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('No refundable amount available');
        } else {
          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);
          expect(res.body.data.transaction.amount).toBe(tc.expectedRefund);
        }
      }
    });

    it('19. [FIN-1 & CONCURRENCY] should correctly calculate remaining refundable amount for cumulative partial refunds', async () => {
      // Original payment: 400.00. 100% policy (eligible: 400.00).
      // Existing completed refund: 150.00.
      // Remaining eligible: 400.00 - 150.00 = 250.00.
      const existingPartialRefund = {
        ...mockRefundRecord,
        transactionId: '77777777-7777-7777-7777-777777777777',
        amount: '150.00',
        status: TransactionStatus.COMPLETED,
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockCancelledBookingFull as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([existingPartialRefund as any]);

      const secondPartialRefund = {
        ...mockRefundRecord,
        amount: '250.00',
      };
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(secondPartialRefund as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          reason: 'Second partial refund',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('250.00');
    });

    it('20. [M9.2.3 Regression Case 1] should fail safely with 400 Bad Request when cancellation actor is an unknown third party even if ride is CANCELLED', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Booking was cancelled with cancelledById = mockOtherUserId (not rider, not driver, not in env.ADMIN_USER_IDS)
      // and ride is CANCELLED. Must NOT infer driver identity or grant 100% refund.
      const unverifiedActorCancelledRideBooking = {
        ...mockCancelledBooking50,
        cancelledById: mockOtherUserId,
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.CANCELLED,
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(unverifiedActorCancelledRideBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      // Must fail closed with 400 Bad Request
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Cancellation actor could not be verified');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[REFUND_ERROR]'));
      consoleErrorSpy.mockRestore();
    });

    it('21. [M9.2.3 Regression Case 2] should fail safely with 400 Bad Request when cancelledById is null even if ride is CANCELLED', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const nullActorCancelledRideBooking = {
        ...mockCancelledBooking50,
        cancelledById: null,
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.CANCELLED,
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(nullActorCancelledRideBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Cancellation actor could not be verified');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[REFUND_ERROR]'));
      consoleErrorSpy.mockRestore();
    });

    it('22. [M9.2.3 Regression Case 3] should grant 100% full refund when cancelledById is the driver ID on a CANCELLED ride', async () => {
      const driverCancelledRideBooking = {
        ...mockCancelledBooking50,
        cancelledById: mockDriverId,
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.CANCELLED,
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(driverCancelledRideBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('400.00');
    });

    it('23. [M9.2.3 Regression Case 4] should grant 100% full refund when cancelledById is driver ID and ride is SCHEDULED (driver rejection)', async () => {
      const driverRejectedBooking = {
        ...mockCancelledBooking50,
        cancelledById: mockDriverId,
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.SCHEDULED,
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(driverRejectedBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('400.00');
    });

    it('24. [M9.2.3 Regression Case 5] should grant 100% full refund when cancelledById is an administrator ID regardless of ride status', async () => {
      const adminCancelledBooking = {
        ...mockCancelledBooking50,
        cancelledById: mockAdminId,
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.CANCELLED,
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(adminCancelledBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('400.00');
    });

    it('25. [M9.2.3 Regression Case 6] should strictly retain 50% late-cancellation policy for a voluntary passenger late cancellation even if ride is subsequently cancelled', async () => {
      // Passenger voluntarily cancelled <120 mins before departure.
      // Driver subsequently cancelled the ride (ride.status = CANCELLED).
      // Booking cancellation actor remains riderId -> must follow passenger late cancellation (50%), NOT upgraded to 100%.
      const voluntaryLateThenRideCancelledBooking = {
        ...mockCancelledBooking50,
        cancelledById: mockRiderId, // Cancelled by passenger
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.CANCELLED, // Driver subsequently cancelled the scheduled ride
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(voluntaryLateThenRideCancelledBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const halfRefundRecord = {
        ...mockRefundRecord,
        amount: '200.00',
        description: '[IDEMPOTENCY:rf_voluntary_50] [POLICY:50%_LATE_CANCEL]',
      };
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(halfRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'rf_voluntary_50',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Strictly 50% of 400.00 = 200.00
      expect(res.body.data.transaction.amount).toBe('200.00');
    });

    it('26. [M9.2.3 Regression Case 7] should match and grant 100% full refund when env.ADMIN_USER_IDS has mixed case and cancelledById has uppercase', async () => {
      const mixedCaseAdminId = '99999999-9999-9999-9999-99999999999A';
      const uppercaseCancelledById = '99999999-9999-9999-9999-99999999999a'.toUpperCase();

      env.ADMIN_USER_IDS = [mixedCaseAdminId]; // mixed case / containing letters

      const adminCancelledBooking = {
        ...mockCancelledBooking50,
        cancelledById: uppercaseCancelledById,
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.SCHEDULED,
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(adminCancelledBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('400.00');
    });

    it('27. [M9.2.5 Lifecycle Propagation] should grant 100% full refund to passenger whose CONFIRMED booking was cancelled by driver ride cancellation', async () => {
      // Driver cancelled ride; booking was propagated to CANCELLED with cancelledById = driverId
      const driverCancelledBooking = {
        ...mockCancelledBooking50,
        status: BookingStatus.CANCELLED,
        cancelledById: mockDriverId, // Set to driver ID by cancelRide()
        cancellationReason: '[CANCELLED_BY_DRIVER] Ride cancelled by driver',
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.CANCELLED,
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(driverCancelledBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('400.00');
    });

    it('28. [M9.2.5 Financial Invariant] should strictly retain 50% late-cancellation policy for passenger who voluntarily cancelled late, even after driver cancelled the ride', async () => {
      // Passenger voluntarily cancelled <120 mins before departure: cancelledById = riderId
      // Driver subsequently cancelled the ride: booking was already CANCELLED, so cancelledById remained riderId
      const voluntaryLateBooking = {
        ...mockCancelledBooking50,
        status: BookingStatus.CANCELLED,
        cancelledById: mockRiderId, // Preserved as rider ID
        cancellationReason: '[CANCELLED_BY_RIDER: LATE_CANCEL_50_PERCENT] Passenger late cancel',
        ride: {
          ...mockCancelledBooking50.ride,
          status: RideStatus.CANCELLED, // Driver subsequently cancelled the ride
        },
      };
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(voluntaryLateBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockOriginalPayment as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const halfRefundRecord = {
        ...mockRefundRecord,
        amount: '200.00',
        description: '[IDEMPOTENCY:rf_voluntary_50] [POLICY:50%_LATE_CANCEL]',
      };
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(halfRefundRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'rf_voluntary_50',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe('200.00');
    });
  });
});
