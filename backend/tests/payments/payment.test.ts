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
import {
  paymentService,
} from '../../src/services/payment.service.js';
import {
  SimulatedPaymentProvider,
  defaultPaymentProvider,
  type PaymentProvider,
} from '../../src/services/payment-provider.js';

describe('Milestone 9.1: Financial Transaction Foundation & Payment Architecture', () => {
  const mockRiderId = '11111111-1111-1111-1111-111111111111';
  const mockDriverId = '22222222-2222-2222-2222-222222222222';
  const mockOtherUserId = '33333333-3333-3333-3333-333333333333';
  const mockAdminId = '99999999-9999-9999-9999-999999999999';

  const mockBookingId = "44444444-4444-4444-4444-444444444444";
  const mockRideId = '55555555-5555-5555-5555-555555555555';
  const mockTransactionId = '66666666-6666-6666-6666-666666666666';

  const mockTimestamp = new Date('2026-11-23T10:00:00.000Z');

  const mockRider = {
    userId: mockRiderId,
    name: 'Rohan Sharma',
    email: 'rohan@rydora.in',
    phone: '+919876500001',
    roles: [UserRole.USER],
    walletBalance: '1000.00',
  };

  const mockDriver = {
    userId: mockDriverId,
    name: 'Priya Singh',
    email: 'priya@rydora.in',
    phone: '+919876500002',
    roles: [UserRole.DRIVER],
    walletBalance: '500.00',
  };

  const mockOtherUser = {
    userId: mockOtherUserId,
    name: 'Sneha Rao',
    email: 'sneha@rydora.in',
    phone: '+919876500003',
    roles: [UserRole.USER],
    walletBalance: '0.00',
  };

  const mockAdmin = {
    userId: mockAdminId,
    name: 'Platform Admin',
    email: 'admin@rydora.in',
    phone: '+919876500099',
    roles: ['ADMIN'],
    walletBalance: '0.00',
  };

  const mockRide = {
    rideId: mockRideId,
    driverId: mockDriverId,
    source: 'Koramangala, Bengaluru',
    destination: 'Whitefield, Bengaluru',
    departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    status: RideStatus.SCHEDULED,
    farePerSeat: '150.00',
    totalSeats: 4,
    availableSeats: 2,
  };

  const mockBooking = {
    bookingId: mockBookingId,
    rideId: mockRideId,
    riderId: mockRiderId,
    seatsBooked: 2,
    status: BookingStatus.PENDING,
    totalAmount: '300.00',
    bookedAt: mockTimestamp,
    updatedAt: mockTimestamp,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    ride: mockRide,
  };

  const mockTransactionRecord = {
    transactionId: mockTransactionId,
    bookingId: mockBookingId,
    senderId: mockRiderId,
    receiverId: mockDriverId,
    amount: '300.00',
    currency: 'INR',
    type: TransactionType.BOOKING_PAYMENT,
    status: TransactionStatus.COMPLETED,
    paymentMethod: 'SIMULATED',
    providerReference: 'sim_pay_test_ref_123',
    referenceTransactionId: null,
    description: 'Booking payment via simulated provider',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    completedAt: mockTimestamp,
    booking: {
      bookingId: mockBookingId,
      rideId: mockRideId,
      status: BookingStatus.CONFIRMED,
      seatsBooked: 2,
      totalAmount: '300.00',
    },
  };

  const generateToken = (userId: string): string => {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);
    vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
    vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return Promise.all(callback);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (defaultPaymentProvider as any).clearProcessed?.();
  });

  // =========================================================================
  // 1. PAYMENT PROCESSING (POST /api/v1/payments)
  // =========================================================================
  describe('POST /api/v1/payments - Payment Processing', () => {
    it('should successfully process a simulated payment for a PENDING booking, record COMPLETED transaction, and confirm booking (201 Created)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);
      const updateBookingSpy = vi.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          paymentMethod: 'SIMULATED',
          amount: '300.00',
          currency: 'INR',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction).toBeDefined();
      expect(res.body.data.transaction.transactionId).toBe(mockTransactionId);
      expect(res.body.data.transaction.status).toBe('COMPLETED');
      expect(res.body.data.transaction.amount).toBe('300.00');
      expect(res.body.data.transaction.currency).toBe('INR');
      expect(res.body.data.transaction.isSimulated).toBe(true);
      expect(res.body.data.transaction.providerReference).toBe('sim_pay_test_ref_123');

      // Verify booking status transitioned to CONFIRMED
      expect(updateBookingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId: mockBookingId },
          data: { status: BookingStatus.CONFIRMED },
        })
      );
    });

    it('should support booking-scoped URL: POST /api/v1/bookings/:bookingId/payments', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post(`/api/v1/bookings/${mockBookingId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentMethod: 'WALLET',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.bookingId).toBe(mockBookingId);
    });

    it('should reject payment by unauthorized user with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow platform ADMIN to process payment on behalf of a user (201 Created)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdmin as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      const token = generateToken(mockAdminId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          amount: '300.00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject payment with 409 Conflict if a completed payment already exists for the booking', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);
      // Already has a COMPLETED transaction
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockTransactionRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already exists for this booking');
    });

    it('should replay idempotently with 200 OK when same idempotency key is submitted for a completed payment', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      // Existing transaction contains idempotency key in description
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({
        ...mockTransactionRecord,
        description: '[IDEMPOTENCY:req_order_12345] Booking payment',
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'req_order_12345')
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.duplicateSuppressed).toBe(true);
      expect(res.body.data.transaction.transactionId).toBe(mockTransactionId);
    });

    it('should reject payment with 400 Bad Request if booking is CANCELLED', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Cannot process payment for a cancelled booking');
    });

    it('should reject payment with 400 Bad Request if booking is COMPLETED', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.COMPLETED,
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Cannot process payment for an already completed booking');
    });

    it('should reject payment with 400 Bad Request if payment amount does not match booking totalAmount', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          amount: '100.00', // Booking total is 300.00
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('does not match booking total');
    });

    it('should record FAILED transaction and keep booking in PENDING state when provider rejects payment', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

      const failedTransactionRecord = {
        ...mockTransactionRecord,
        status: TransactionStatus.FAILED,
        completedAt: null,
        description: '[FAILURE: Simulated payment declined: Insufficient funds or card network rejection]',
      };
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(failedTransactionRecord as any);
      const updateBookingSpy = vi.spyOn(prisma.booking, 'update');

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          paymentMethod: 'INVALID_CARD_FAIL', // Trigger simulated failure
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('FAILED');
      expect(res.body.data.transaction.completedAt).toBeNull();

      // Booking must NOT be updated to CONFIRMED
      expect(updateBookingSpy).not.toHaveBeenCalled();
    });

    it('should record PENDING transaction when provider returns PENDING status', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

      const pendingTransactionRecord = {
        ...mockTransactionRecord,
        status: TransactionStatus.PENDING,
        completedAt: null,
      };
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(pendingTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(pendingTransactionRecord as any);
      const updateBookingSpy = vi.spyOn(prisma.booking, 'update');

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          paymentMethod: 'UPI_PENDING_FLOW', // Trigger simulated pending
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('PENDING');
      expect(res.body.data.transaction.completedAt).toBeNull();

      // Booking must NOT be updated to CONFIRMED while pending
      expect(updateBookingSpy).not.toHaveBeenCalled();
    });

    it('should return 404 Not Found if bookingId does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 422 Unprocessable Entity for invalid bookingId format', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: 'invalid-not-a-uuid',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. RETRIEVE TRANSACTION BY ID (GET /api/v1/payments/:transactionId)
  // =========================================================================
  describe('GET /api/v1/payments/:transactionId', () => {
    it('should allow sender (passenger) to retrieve transaction details (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(mockTransactionRecord as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get(`/api/v1/payments/${mockTransactionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.transactionId).toBe(mockTransactionId);
      expect(res.body.data.transaction.senderId).toBe(mockRiderId);
    });

    it('should allow receiver (driver) to retrieve transaction details (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDriver as any);
      vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(mockTransactionRecord as any);

      const token = generateToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/payments/${mockTransactionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.receiverId).toBe(mockDriverId);
    });

    it('should reject third-party user from viewing another user transaction with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherUser as any);
      vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(mockTransactionRecord as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get(`/api/v1/payments/${mockTransactionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 Not Found if transaction does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get(`/api/v1/payments/${mockTransactionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // 3. RETRIEVE BOOKING TRANSACTIONS (GET /api/v1/bookings/:bookingId/payments)
  // =========================================================================
  describe('GET /api/v1/bookings/:bookingId/payments', () => {
    it('should retrieve all transactions for a booking when requested by passenger (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([mockTransactionRecord] as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}/payments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactions).toHaveLength(1);
      expect(res.body.data.transactions[0].transactionId).toBe(mockTransactionId);
    });

    it('should reject third-party from viewing booking transactions with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherUser as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}/payments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 4. LIST USER TRANSACTIONS (GET /api/v1/payments)
  // =========================================================================
  describe('GET /api/v1/payments - User Transaction History', () => {
    it('should list financial transaction history with pagination (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([mockTransactionRecord] as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .get('/api/v1/payments?page=1&limit=10&status=COMPLETED')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactions).toHaveLength(1);
      expect(res.body.meta.pagination.total).toBe(1);
      expect(res.body.meta.pagination.page).toBe(1);
    });
  });

  // =========================================================================
  // 5. PAYMENT PROVIDER UNIT TESTS
  // =========================================================================
  describe('SimulatedPaymentProvider Unit Tests', () => {
    it('should simulate successful payment with unique provider reference and isSimulated=true', async () => {
      const provider = new SimulatedPaymentProvider();
      const result = await provider.processPayment({
        amount: '200.00',
        currency: 'INR',
        bookingId: mockBookingId,
        payerId: mockRiderId,
        paymentMethod: 'UPI',
        idempotencyKey: 'idemp_key_unit_1',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(result.providerReference).toMatch(/^sim_pay_/);
      expect(result.isSimulated).toBe(true);
      expect(result.duplicateSuppressed).toBeUndefined();

      // Second call with same idempotency key suppresses duplicate
      const duplicateResult = await provider.processPayment({
        amount: '200.00',
        currency: 'INR',
        bookingId: mockBookingId,
        payerId: mockRiderId,
        paymentMethod: 'UPI',
        idempotencyKey: 'idemp_key_unit_1',
      });

      expect(duplicateResult.success).toBe(true);
      expect(duplicateResult.providerReference).toBe(result.providerReference);
      expect(duplicateResult.duplicateSuppressed).toBe(true);
    });

    it('should trigger simulated failure on fault injection triggers', async () => {
      const provider = new SimulatedPaymentProvider();
      const result = await provider.processPayment({
        amount: '99.99', // .99 trigger
        currency: 'INR',
        bookingId: mockBookingId,
        payerId: mockRiderId,
        paymentMethod: 'CARD',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.providerReference).toMatch(/^sim_fail_/);
      expect(result.errorMessage).toContain('declined');
    });

    it('should trigger simulated pending status when requested', async () => {
      const provider = new SimulatedPaymentProvider();
      const result = await provider.processPayment({
        amount: '150.00',
        currency: 'INR',
        bookingId: mockBookingId,
        payerId: mockRiderId,
        paymentMethod: 'NET_BANKING_PENDING',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('PENDING');
      expect(result.providerReference).toMatch(/^sim_pend_/);
    });
  });

  // =========================================================================
  // 6. M9.1.1 TARGETED CONSISTENCY & RELIABILITY TESTS
  // =========================================================================
  describe('M9.1.1 Two-Phase Intent & Hardened Consistency Tests', () => {
    it('1. should invoke provider outside interactive transaction and persist intent before provider call', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

      const intentRecord = {
        ...mockTransactionRecord,
        status: TransactionStatus.PENDING,
        providerReference: 'intent_12345',
        completedAt: null,
      };

      const completedRecord = {
        ...mockTransactionRecord,
        status: TransactionStatus.COMPLETED,
        providerReference: 'sim_pay_confirmed_123',
      };

      const createSpy = vi.spyOn(prisma.transaction, 'create').mockResolvedValue(intentRecord as any);
      const updateSpy = vi.spyOn(prisma.transaction, 'update').mockResolvedValue(completedRecord as any);

      // Track order of execution
      const executionOrder: string[] = [];
      createSpy.mockImplementation(async () => {
        executionOrder.push('PERSIST_INTENT');
        return intentRecord as any;
      });

      const mockProvider: PaymentProvider = {
        async processPayment() {
          executionOrder.push('CALL_PROVIDER');
          return {
            success: true,
            status: 'COMPLETED',
            providerReference: 'sim_pay_confirmed_123',
            isSimulated: true,
          };
        },
      };

      updateSpy.mockImplementation(async () => {
        executionOrder.push('PERSIST_OUTCOME');
        return completedRecord as any;
      });

      const result = await paymentService.processBookingPayment(
        mockRiderId,
        {
          bookingId: mockBookingId,
          amount: '300.00',
          currency: 'INR',
          idempotencyKey: 'test_order_key_1',
        },
        mockProvider
      );

      expect(result.transaction.status).toBe('COMPLETED');
      // Intent was persisted BEFORE provider was called, and outcome was updated AFTER provider returned
      expect(executionOrder).toEqual(['PERSIST_INTENT', 'CALL_PROVIDER', 'PERSIST_OUTCOME']);
    });

    it('2. should reject concurrent payment attempt when an unresolved PENDING intent already exists for the booking', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      // Simulates an existing unresolved PENDING payment attempt on this booking with different key
      vi.spyOn(prisma.transaction, 'findFirst').mockImplementation(async (args: any) => {
        if (args?.where?.status === TransactionStatus.COMPLETED) {
          return null; // No completed transaction yet
        }
        if (args?.where?.status === TransactionStatus.PENDING) {
          return {
            ...mockTransactionRecord,
            status: TransactionStatus.PENDING,
            description: '[IDEMPOTENCY:existing_pending_key_123]',
            completedAt: null,
          } as any;
        }
        return null;
      });

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'new_different_key_456',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('currently pending and unresolved');
    });

    it('3. should permit fresh retry after a definitively FAILED attempt', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      // In step 6, findFirst checks for completed -> returns null
      // In step 7, findFirst checks for matching key -> returns previous failed attempt
      // In step 8, findFirst checks for pending -> returns null (since previous is FAILED)
      vi.spyOn(prisma.transaction, 'findFirst').mockImplementation(async (args: any) => {
        if (args?.where?.status === TransactionStatus.COMPLETED) return null;
        if (args?.where?.status === TransactionStatus.PENDING) return null;
        if (args?.where?.description?.contains) {
          return {
            ...mockTransactionRecord,
            status: TransactionStatus.FAILED,
            description: '[IDEMPOTENCY:failed_key_retry] [FAILURE: Card declined]',
          } as any;
        }
        return null;
      });

      const intentRecord = {
        ...mockTransactionRecord,
        status: TransactionStatus.PENDING,
        providerReference: 'intent_retry_1',
      };
      const completedRecord = {
        ...mockTransactionRecord,
        status: TransactionStatus.COMPLETED,
        providerReference: 'sim_pay_retry_success',
      };

      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(intentRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(completedRecord as any);
      vi.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'failed_key_retry',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('COMPLETED');
    });

    it('4. should preserve unresolved PENDING intent when provider times out or returns ambiguous outcome', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

      const intentRecord = {
        ...mockTransactionRecord,
        status: TransactionStatus.PENDING,
        providerReference: 'intent_timeout_case',
        completedAt: null,
      };
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(intentRecord as any);
      const updateTransactionSpy = vi.spyOn(prisma.transaction, 'update').mockResolvedValue(intentRecord as any);
      const updateBookingSpy = vi.spyOn(prisma.booking, 'update');

      const timeoutProvider: PaymentProvider = {
        async processPayment() {
          throw new Error('Connection timeout while waiting for gateway');
        },
      };

      const result = await paymentService.processBookingPayment(
        mockRiderId,
        {
          bookingId: mockBookingId,
          amount: '300.00',
          currency: 'INR',
          idempotencyKey: 'key_for_timeout_test',
        },
        timeoutProvider
      );

      // Must remain PENDING in database
      expect(result.transaction.status).toBe('PENDING');
      expect(updateTransactionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TransactionStatus.PENDING,
          }),
        })
      );
      // Booking must NOT be confirmed
      expect(updateBookingSpy).not.toHaveBeenCalled();
    });

    it('5. should retain intent in PENDING state and log emergency message when provider succeeds but database update throws error', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

      const intentRecord = {
        ...mockTransactionRecord,
        status: TransactionStatus.PENDING,
        providerReference: 'intent_orphan_test',
        completedAt: null,
      };
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(intentRecord as any);

      // Phase 1 succeeds, provider succeeds, Phase 2 database update fails
      let callCount = 0;
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        callCount++;
        if (callCount === 1) {
          // Phase 1
          return callback(prisma);
        }
        // Phase 2 throws database failure
        throw new Error('Database connection lost during Phase 2 update');
      });

      const successfulProvider: PaymentProvider = {
        async processPayment() {
          return {
            success: true,
            status: 'COMPLETED',
            providerReference: 'sim_pay_orphaned_success_999',
            isSimulated: true,
          };
        },
      };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await paymentService.processBookingPayment(
        mockRiderId,
        {
          bookingId: mockBookingId,
          amount: '300.00',
          currency: 'INR',
          idempotencyKey: 'orphan_test_key',
        },
        successfulProvider
      );

      expect(result.transaction.status).toBe('PENDING');
      expect(result.transaction.providerReference).toBe('sim_pay_orphaned_success_999');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL_PAYMENT_RECONCILIATION_REQUIRED]')
      );
      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // 6. M9.2.7: PREVENT PAYMENT RESURRECTION OF CANCELLED BOOKINGS
  // =========================================================================
  describe('Milestone 9.2.7: In-Flight Cancellation Race & Anti-Resurrection Safety', () => {
    it('should complete payment transaction but retain CANCELLED booking status when booking was cancelled while payment was in-flight', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);

      const updateBookingSpy = vi.spyOn(prisma.booking, 'update');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const cancelledInFlightBooking = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: mockDriverId,
        cancellationReason: '[CANCELLED_BY_DRIVER] Ride cancelled by driver',
        ride: {
          ...mockRide,
          status: RideStatus.CANCELLED,
        },
      };

      // Call 1 (Phase 1): returns PENDING booking
      // Call 2 (Phase 3): returns CANCELLED booking (cancelled while provider call was in progress)
      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockBooking as any)
        .mockResolvedValueOnce(cancelledInFlightBooking as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          amount: '300.00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('COMPLETED');

      // Crucial: booking must NOT be updated/resurrected to CONFIRMED
      expect(updateBookingSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PAYMENT_RACE_DETECTED]')
      );
      consoleWarnSpy.mockRestore();
    });

    it('should not confirm booking if ride was cancelled while payment was in-flight', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);

      const updateBookingSpy = vi.spyOn(prisma.booking, 'update');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const rideCancelledBooking = {
        ...mockBooking,
        status: BookingStatus.PENDING,
        ride: {
          ...mockRide,
          status: RideStatus.CANCELLED,
        },
      };

      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockBooking as any)
        .mockResolvedValueOnce(rideCancelledBooking as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          amount: '300.00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('COMPLETED');
      expect(updateBookingSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL_PAYMENT_RECONCILIATION_REQUIRED]')
      );
      consoleErrorSpy.mockRestore();
    });

    it('should allow immediate 100% refund for a booking whose payment completed after in-flight driver cancellation', async () => {
      // Setup the booking that ended up in CANCELLED state with completed payment
      const cancelledBookingWithCompletedPayment = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: mockDriverId,
        cancellationReason: '[CANCELLED_BY_DRIVER] Ride cancelled by driver',
        ride: {
          ...mockRide,
          status: RideStatus.CANCELLED,
        },
      };

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(
        cancelledBookingWithCompletedPayment as any
      );
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({
        ...mockTransactionRecord,
        status: TransactionStatus.COMPLETED,
        amount: '300.00',
      } as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const mockRefundTx = {
        transactionId: '88888888-8888-8888-8888-888888888888',
        bookingId: mockBookingId,
        senderId: mockDriverId,
        receiverId: mockRiderId,
        amount: '300.00',
        currency: 'INR',
        type: TransactionType.REFUND,
        status: TransactionStatus.COMPLETED,
        paymentMethod: 'SIMULATED',
        providerReference: 'sim_rf_race_recovery_123',
        referenceTransactionId: mockTransactionId,
        description: '[IDEMPOTENCY:rf_race_recovery] [POLICY:100%_FULL_REFUND]',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      };
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockRefundTx as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockRefundTx as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'rf_race_recovery',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.type).toBe('REFUND');
      expect(res.body.data.transaction.amount).toBe('300.00');
    });

    it('should deterministically handle driver cancellation committing while payment provider is paused, preserving 100% refund eligibility', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);

      const updateBookingSpy = vi.spyOn(prisma.booking, 'update');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Set up async coordination barrier
      let resolveProviderInvoked: () => void;
      const providerInvokedPromise = new Promise<void>((resolve) => {
        resolveProviderInvoked = resolve;
      });

      let releaseProvider: () => void;
      const providerCanProceedPromise = new Promise<void>((resolve) => {
        releaseProvider = resolve;
      });

      const pausingProvider: PaymentProvider = {
        async processPayment() {
          // Notify that Phase 1 committed and provider is called
          resolveProviderInvoked();
          // Pause execution until driver cancellation completes
          await providerCanProceedPromise;
          return {
            success: true,
            status: 'COMPLETED',
            providerReference: 'sim_pay_paused_driver_race_888',
            isSimulated: true,
          };
        },
        async processRefund() {
          throw new Error('Not implemented');
        },
      };

      const driverCancelledBookingState = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: mockDriverId,
        cancellationReason: '[CANCELLED_BY_DRIVER] Ride cancelled by driver',
        ride: {
          ...mockRide,
          status: RideStatus.CANCELLED,
        },
      };

      // Call 1 (Phase 1): returns PENDING booking
      // Call 2 (Phase 3 after driver cancellation commits): returns CANCELLED booking
      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockBooking as any)
        .mockResolvedValueOnce(driverCancelledBookingState as any);

      // Start payment in background
      const paymentPromise = paymentService.processBookingPayment(
        mockRiderId,
        {
          bookingId: mockBookingId,
          amount: '300.00',
        },
        pausingProvider
      );

      // 1. Wait until payment Phase 1 commits and provider is invoked
      await providerInvokedPromise;

      // 2. Driver cancellation commits while provider was processing
      // (driverCancelledBookingState is now the authoritative DB state)

      // 3. Release provider to report success
      releaseProvider!();

      // 4. Await payment Phase 3 completion
      const res = await paymentPromise;

      expect(res.transaction).toBeDefined();
      expect(res.transaction.status).toBe('COMPLETED');
      // Booking was NOT resurrected to CONFIRMED
      expect(updateBookingSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PAYMENT_RACE_DETECTED]')
      );
      consoleWarnSpy.mockRestore();
    });

    it('should deterministically handle passenger late cancellation committing while payment provider is paused, preserving 50% refund policy', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);

      const updateBookingSpy = vi.spyOn(prisma.booking, 'update');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      let resolveProviderInvoked: () => void;
      const providerInvokedPromise = new Promise<void>((resolve) => {
        resolveProviderInvoked = resolve;
      });

      let releaseProvider: () => void;
      const providerCanProceedPromise = new Promise<void>((resolve) => {
        releaseProvider = resolve;
      });

      const pausingProvider: PaymentProvider = {
        async processPayment() {
          resolveProviderInvoked();
          await providerCanProceedPromise;
          return {
            success: true,
            status: 'COMPLETED',
            providerReference: 'sim_pay_paused_rider_race_777',
            isSimulated: true,
          };
        },
        async processRefund() {
          throw new Error('Not implemented');
        },
      };

      const passengerLateCancelledBookingState = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(Date.now() - 1000), // < 120 mins before departure
        cancelledById: mockRiderId, // Passenger attribution
        cancellationReason: '[CANCELLED_BY_RIDER: LATE_CANCEL_50_PERCENT] Passenger voluntary cancel',
        ride: {
          ...mockRide,
          departureTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
          status: RideStatus.SCHEDULED,
        },
      };

      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockBooking as any)
        .mockResolvedValueOnce(passengerLateCancelledBookingState as any);

      const paymentPromise = paymentService.processBookingPayment(
        mockRiderId,
        {
          bookingId: mockBookingId,
          amount: '300.00',
        },
        pausingProvider
      );

      await providerInvokedPromise;
      releaseProvider!();
      const res = await paymentPromise;

      expect(res.transaction).toBeDefined();
      expect(res.transaction.status).toBe('COMPLETED');
      expect(updateBookingSpy).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();

      // Now verify that refunding this booking strictly awards the 50% late-cancellation refund (150.00)
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(
        passengerLateCancelledBookingState as any
      );
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({
        ...mockTransactionRecord,
        status: TransactionStatus.COMPLETED,
        amount: '300.00',
      } as any);
      vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

      const mockHalfRefundTx = {
        transactionId: '99999999-8888-7777-6666-555555555555',
        bookingId: mockBookingId,
        senderId: mockDriverId,
        receiverId: mockRiderId,
        amount: '150.00', // 50% of 300.00
        currency: 'INR',
        type: TransactionType.REFUND,
        status: TransactionStatus.COMPLETED,
        paymentMethod: 'SIMULATED',
        providerReference: 'sim_rf_late_policy_150',
        referenceTransactionId: mockTransactionId,
        description: '[IDEMPOTENCY:rf_late_test] [POLICY:50%_LATE_CANCEL]',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      };
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockHalfRefundTx as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockHalfRefundTx as any);

      const token = generateToken(mockRiderId);
      const refundRes = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          idempotencyKey: 'rf_late_test',
        });

      expect(refundRes.status).toBe(201);
      expect(refundRes.body.success).toBe(true);
      expect(refundRes.body.data.transaction.amount).toBe('150.00');
    });

    it('should handle Case D: ride is CANCELLED while booking remains PENDING, recording payment without confirming booking and emitting reconciliation alert', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);

      const updateBookingSpy = vi.spyOn(prisma.booking, 'update');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const rideCancelledBookingPendingState = {
        ...mockBooking,
        status: BookingStatus.PENDING,
        ride: {
          ...mockRide,
          status: RideStatus.CANCELLED,
        },
      };

      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockBooking as any)
        .mockResolvedValueOnce(rideCancelledBookingPendingState as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          amount: '300.00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('COMPLETED');
      // Never confirmed on a cancelled ride
      expect(updateBookingSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL_PAYMENT_RECONCILIATION_REQUIRED]')
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle Case E: cancelled booking with null attribution preserves null attribution without fabricating identity and fails closed on refund', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const nullAttributionCancelledBooking = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: null, // Unknown/unverified actor
        cancellationReason: 'Cancelled out of band',
        ride: {
          ...mockRide,
          status: RideStatus.CANCELLED,
        },
      };

      vi.spyOn(prisma.booking, 'findUnique')
        .mockResolvedValueOnce(mockBooking as any)
        .mockResolvedValueOnce(nullAttributionCancelledBooking as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          amount: '300.00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('COMPLETED');

      // Now verify that refunding this booking with unverified cancelledById fails closed with 400 Bad Request
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(
        nullAttributionCancelledBooking as any
      );
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({
        ...mockTransactionRecord,
        status: TransactionStatus.COMPLETED,
        amount: '300.00',
      } as any);

      const refundRes = await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
        });

      expect(refundRes.status).toBe(400);
      expect(refundRes.body.success).toBe(false);
      expect(refundRes.body.error.message).toContain('Cancellation actor could not be verified');

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should acquire row locks in consistent order (rides -> bookings) during Phase 3', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockRider as any);
      vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.transaction, 'create').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.transaction, 'update').mockResolvedValue(mockTransactionRecord as any);
      vi.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      const queryRawSpy = vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as any);

      const token = generateToken(mockRiderId);
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: mockBookingId,
          amount: '300.00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify row locks:
      // Call 1 (Phase 1): SELECT 1 FROM "bookings" WHERE "booking_id" = ... FOR UPDATE
      // Call 2 (Phase 3): SELECT 1 FROM "rides" WHERE "ride_id" = ... FOR UPDATE
      // Call 3 (Phase 3): SELECT 1 FROM "bookings" WHERE "booking_id" = ... FOR UPDATE
      expect(queryRawSpy).toHaveBeenCalledTimes(3);
      const call2Strings = queryRawSpy.mock.calls[1][0] as any;
      const call3Strings = queryRawSpy.mock.calls[2][0] as any;

      expect(call2Strings.join(' ')).toContain('"rides"');
      expect(call3Strings.join(' ')).toContain('"bookings"');
    });
  });
});
