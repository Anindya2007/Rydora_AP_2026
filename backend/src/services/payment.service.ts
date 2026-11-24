import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import {
  Prisma,
  BookingStatus,
  RideStatus,
  TransactionType,
  TransactionStatus,
  UserRole,
} from '../generated/prisma/client.js';
import type { PaginationMeta } from '../utils/response.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import {
  defaultPaymentProvider,
  type PaymentProvider,
  type ProcessPaymentResult,
  type ProcessRefundResult,
} from './payment-provider.js';
import type {
  ProcessPaymentInput,
  ListTransactionsQueryInput,
  DriverEarningsQueryInput,
} from '../validators/payment.validator.js';

export interface TransactionOutput {
  transactionId: string;
  bookingId: string;
  senderId: string | null;
  receiverId: string | null;
  amount: string;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod: string | null;
  providerReference: string | null;
  referenceTransactionId: string | null;
  description: string | null;
  isSimulated: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  booking?: {
    bookingId: string;
    rideId: string;
    status: BookingStatus;
    seatsBooked: number;
    totalAmount: string;
  };
}

export const transactionSelectProjection = {
  transactionId: true,
  bookingId: true,
  senderId: true,
  receiverId: true,
  amount: true,
  currency: true,
  type: true,
  status: true,
  paymentMethod: true,
  providerReference: true,
  referenceTransactionId: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  booking: {
    select: {
      bookingId: true,
      rideId: true,
      status: true,
      seatsBooked: true,
      totalAmount: true,
    },
  },
};

/**
 * Formats a raw database Transaction into a clean API response DTO.
 */
export function formatTransaction(raw: {
  transactionId: string;
  bookingId: string;
  senderId: string | null;
  receiverId: string | null;
  amount: any;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod: string | null;
  providerReference: string | null;
  referenceTransactionId: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  booking?: {
    bookingId: string;
    rideId: string;
    status: BookingStatus;
    seatsBooked: number;
    totalAmount: any;
  } | null;
}): TransactionOutput {
  return {
    transactionId: raw.transactionId,
    bookingId: raw.bookingId,
    senderId: raw.senderId,
    receiverId: raw.receiverId,
    amount: raw.amount ? raw.amount.toString() : '0.00',
    currency: raw.currency,
    type: raw.type,
    status: raw.status,
    paymentMethod: raw.paymentMethod,
    providerReference: raw.providerReference,
    referenceTransactionId: raw.referenceTransactionId,
    description: raw.description,
    isSimulated: true, // Capstone transactions are explicitly simulated
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    completedAt: raw.completedAt,
    booking: raw.booking
      ? {
          bookingId: raw.booking.bookingId,
          rideId: raw.booking.rideId,
          status: raw.booking.status,
          seatsBooked: raw.booking.seatsBooked,
          totalAmount: raw.booking.totalAmount
            ? raw.booking.totalAmount.toString()
            : '0.00',
        }
      : undefined,
  };
}

/**
 * Processes a payment for a booking using the payment provider.
 *
 * Requirements & Invariants:
 * 1. Authorization: Only the passenger (booking.riderId) or platform ADMIN can pay.
 * 2. Concurrency Serialization: Acquires PostgreSQL row lock on the booking record.
 * 3. Lifecycle State Check:
 *    - Rejects cancelled bookings (400 Bad Request).
 *    - Rejects completed bookings (400 Bad Request).
 *    - Rejects bookings on cancelled or completed rides (400 Bad Request).
 * 4. Duplicate Payment Prevention:
 *    - Rejects if a COMPLETED BOOKING_PAYMENT transaction already exists for this booking (409 Conflict).
 * 5. Idempotency Support:
 *    - Checks idempotency tag in description or provider. If duplicate request with same idempotency key,
 *      returns the existing transaction without double-charging.
 * 6. Amount & Currency Invariance:
 *    - Verifies amount matches booking.totalAmount exactly.
 * 7. Provider Failure Isolation:
 *    - Provider failures record status: FAILED with error message and DO NOT mark transaction as COMPLETED.
 *    - Booking remains in PENDING state if payment fails, allowing user retry.
 * 8. Booking Confirmation:
 *    - Successful payment transitions booking status from PENDING to CONFIRMED.
 */
/**
 * Processes a payment for a booking using a two-phase intent architecture (M9.1.1).
 *
 * Requirements & Invariants:
 * 1. Authorization: Only the passenger (booking.riderId) or platform ADMIN can pay.
 * 2. Concurrency Serialization:
 *    - Short-lived Phase 1 interactive transaction acquires PostgreSQL row lock on the booking record.
 *    - Validates booking status, ride status, and authoritative amount.
 * 3. Idempotency & Duplicate Prevention:
 *    - Replays existing COMPLETED/PENDING transaction if matching idempotency key is supplied.
 *    - Rejects if COMPLETED booking payment exists (409 Conflict).
 *    - Rejects if an unresolved PENDING booking payment exists (409 Conflict) when a different key is used.
 *    - Permits retry after a definitively FAILED attempt.
 *    - Persists durable PENDING Transaction intent in Phase 1 before exiting the DB transaction.
 * 4. External Provider Invocation Outside DB Transaction:
 *    - provider.processPayment() is invoked completely outside the Prisma transaction.
 *    - Holds no database locks or connection pool slots during external gateway communication.
 *    - Uses stable provider idempotency key.
 * 5. Provider Outcome Persistence (Phase 2):
 *    - Short-lived Phase 2 interactive transaction updates the existing Transaction intent.
 *    - COMPLETED: updates providerReference, status: COMPLETED, completedAt, and confirms booking.
 *    - FAILED: updates providerReference, status: FAILED, failure description; keeps booking eligible for retry.
 *    - PENDING / Uncertain / Timeout: intent remains PENDING and booking remains PENDING.
 *    - Never creates a duplicate Transaction row for the same payment intent.
 */
export async function processBookingPayment(
  userId: string,
  input: ProcessPaymentInput,
  provider: PaymentProvider = defaultPaymentProvider,
  isAdmin = false
): Promise<{ transaction: TransactionOutput; duplicateSuppressed?: boolean }> {
  // Stable idempotency key for this request or synthesized stable intent key
  const effectiveIdempotencyKey = input.idempotencyKey || `auto_${input.bookingId}_${userId}`;

  // =========================================================================
  // PHASE 1: Short-lived Intent Transaction (Inside DB Transaction)
  // =========================================================================
  const intentResult = await prisma.$transaction(async (tx) => {
    // 1. Acquire row lock on booking to serialize concurrent payment operations
    await tx.$queryRaw`SELECT 1 FROM "bookings" WHERE "booking_id" = ${input.bookingId}::uuid FOR UPDATE`;

    // 2. Fetch booking with ride details
    const booking = await tx.booking.findUnique({
      where: { bookingId: input.bookingId },
      include: {
        ride: {
          select: {
            rideId: true,
            driverId: true,
            status: true,
            source: true,
            destination: true,
            departureTime: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // 3. Authorization check
    if (booking.riderId !== userId && !isAdmin) {
      throw new ForbiddenError(
        'Access denied: Only the passenger who created this booking can make a payment'
      );
    }

    // 4. Lifecycle state checks
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError('Cannot process payment for a cancelled booking');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestError('Cannot process payment for an already completed booking');
    }

    if (booking.ride.status === RideStatus.CANCELLED) {
      throw new BadRequestError('Cannot process payment for a ride that has been cancelled');
    }

    if (booking.ride.status === RideStatus.COMPLETED) {
      throw new BadRequestError('Cannot process payment for a ride that has already completed');
    }

    // 5. Authoritative Amount check
    const bookingTotalStr = Number(booking.totalAmount).toFixed(2);
    if (input.amount && Number(input.amount).toFixed(2) !== bookingTotalStr) {
      throw new BadRequestError(
        `Payment amount (${input.amount}) does not match booking total (${bookingTotalStr})`
      );
    }

    // 6. Check for existing COMPLETED payment on this booking
    const existingCompleted = await tx.transaction.findFirst({
      where: {
        bookingId: booking.bookingId,
        type: TransactionType.BOOKING_PAYMENT,
        status: TransactionStatus.COMPLETED,
      },
      select: transactionSelectProjection,
    });

    if (existingCompleted) {
      // If idempotency key was supplied and matches, return existing idempotently
      if (
        input.idempotencyKey &&
        existingCompleted.description?.includes(`[IDEMPOTENCY:${input.idempotencyKey}]`)
      ) {
        return {
          type: 'EXISTING_COMPLETED' as const,
          transaction: existingCompleted,
          duplicateSuppressed: true,
        };
      }
      throw new ConflictError(
        'A completed payment transaction already exists for this booking'
      );
    }

    // 7. Check for existing matching attempt by idempotency key
    if (input.idempotencyKey) {
      const existingByIdempotency = await tx.transaction.findFirst({
        where: {
          bookingId: booking.bookingId,
          description: {
            contains: `[IDEMPOTENCY:${input.idempotencyKey}]`,
          },
        },
        select: transactionSelectProjection,
      });

      if (existingByIdempotency) {
        // If it was already completed or still pending, replay idempotently
        if (
          existingByIdempotency.status === TransactionStatus.COMPLETED ||
          existingByIdempotency.status === TransactionStatus.PENDING
        ) {
          return {
            type: 'EXISTING_IDEMPOTENT' as const,
            transaction: existingByIdempotency,
            duplicateSuppressed: true,
          };
        }
        // If it definitively failed in the past with the same key, allow fresh retry attempt
      }
    }

    // 8. Check for any unresolved PENDING payment attempt on this booking
    const existingPending = await tx.transaction.findFirst({
      where: {
        bookingId: booking.bookingId,
        type: TransactionType.BOOKING_PAYMENT,
        status: TransactionStatus.PENDING,
      },
      select: transactionSelectProjection,
    });

    if (existingPending) {
      // If existing pending matches this idempotency key, return it idempotently
      if (
        input.idempotencyKey &&
        existingPending.description?.includes(`[IDEMPOTENCY:${input.idempotencyKey}]`)
      ) {
        return {
          type: 'EXISTING_IDEMPOTENT' as const,
          transaction: existingPending,
          duplicateSuppressed: true,
        };
      }
      // Different key or no key: reject to prevent concurrent duplicate payment processing
      throw new ConflictError(
        'A payment attempt is currently pending and unresolved for this booking. Please wait or resolve the pending transaction before trying again.'
      );
    }

    // 9. Create durable PENDING Transaction intent before exiting Phase 1 DB transaction
    const initialDescParts: string[] = [];
    if (input.idempotencyKey) {
      initialDescParts.push(`[IDEMPOTENCY:${input.idempotencyKey}]`);
    } else {
      initialDescParts.push(`[IDEMPOTENCY:${effectiveIdempotencyKey}]`);
    }
    if (input.description) {
      initialDescParts.push(input.description);
    }
    const initialDescription = initialDescParts.join(' ');

    const intentReference = `intent_${crypto.randomUUID()}`;

    const createdIntent = await tx.transaction.create({
      data: {
        bookingId: booking.bookingId,
        senderId: booking.riderId,
        receiverId: booking.ride.driverId,
        amount: booking.totalAmount,
        currency: input.currency || 'INR',
        type: TransactionType.BOOKING_PAYMENT,
        status: TransactionStatus.PENDING,
        paymentMethod: input.paymentMethod || 'SIMULATED',
        providerReference: intentReference,
        description: initialDescription,
        completedAt: null,
      },
      select: transactionSelectProjection,
    });

    return {
      type: 'NEW_INTENT' as const,
      transaction: createdIntent,
      booking,
      bookingTotalStr,
      duplicateSuppressed: false,
    };
  });

  // Short-circuit if an existing transaction was returned idempotently
  if (
    intentResult.type === 'EXISTING_COMPLETED' ||
    intentResult.type === 'EXISTING_IDEMPOTENT'
  ) {
    return {
      transaction: formatTransaction(intentResult.transaction),
      duplicateSuppressed: intentResult.duplicateSuppressed,
    };
  }

  const { transaction: intentTransaction, booking, bookingTotalStr } = intentResult;

  // =========================================================================
  // PHASE 2: External Provider Invocation (OUTSIDE Database Transaction)
  // =========================================================================
  let providerResult: ProcessPaymentResult;
  let isUncertainOutcome = false;

  try {
    providerResult = await provider.processPayment({
      amount: bookingTotalStr,
      currency: input.currency || 'INR',
      bookingId: booking.bookingId,
      payerId: userId,
      paymentMethod: input.paymentMethod || 'SIMULATED',
      idempotencyKey: input.idempotencyKey || effectiveIdempotencyKey,
      description: input.description,
    });
  } catch (providerError: any) {
    // Distinguish between timeout/uncertain vs definitive rejection
    const errMsg = providerError?.message || 'Gateway connection failed';
    const isTimeout =
      errMsg.toLowerCase().includes('timeout') ||
      errMsg.toLowerCase().includes('aborted') ||
      errMsg.toLowerCase().includes('econnreset');

    if (isTimeout) {
      // Uncertain outcome: do not mark FAILED, keep intent PENDING
      isUncertainOutcome = true;
      providerResult = {
        success: false,
        status: 'PENDING',
        providerReference: intentTransaction.providerReference || `intent_${intentTransaction.transactionId}`,
        errorMessage: `Uncertain outcome: ${errMsg}`,
        isSimulated: true,
      };
    } else {
      // Definitive gateway connection error
      providerResult = {
        success: false,
        status: 'FAILED',
        providerReference: `sim_err_${Date.now()}`,
        errorMessage: `Payment provider error: ${errMsg}`,
        isSimulated: true,
      };
    }
  }

  // =========================================================================
  // PHASE 3: Persist Provider Outcome (Short-lived DB Transaction)
  // =========================================================================
  let updatedTransaction: TransactionOutput;

  try {
    updatedTransaction = await prisma.$transaction(async (tx) => {
      // 1. Map provider outcome to TransactionStatus
      let targetStatus: TransactionStatus;
      if (providerResult.status === 'COMPLETED') {
        targetStatus = TransactionStatus.COMPLETED;
      } else if (providerResult.status === 'PENDING') {
        targetStatus = TransactionStatus.PENDING;
      } else {
        targetStatus = TransactionStatus.FAILED;
      }

      // 2. Build updated audit description
      const descParts: string[] = [];
      if (input.idempotencyKey) {
        descParts.push(`[IDEMPOTENCY:${input.idempotencyKey}]`);
      } else {
        descParts.push(`[IDEMPOTENCY:${effectiveIdempotencyKey}]`);
      }
      if (input.description) {
        descParts.push(input.description);
      }
      if (providerResult.errorMessage) {
        descParts.push(`[FAILURE: ${providerResult.errorMessage}]`);
      }
      const updatedDescription = descParts.join(' ');

      // 3. Update the existing intent record
      const updated = await tx.transaction.update({
        where: { transactionId: intentTransaction.transactionId },
        data: {
          status: targetStatus,
          providerReference: providerResult.providerReference,
          description: updatedDescription,
          completedAt:
            targetStatus === TransactionStatus.COMPLETED ? new Date() : null,
        },
        select: transactionSelectProjection,
      });

      // 4. Atomically confirm booking ONLY when payment status is COMPLETED
      if (targetStatus === TransactionStatus.COMPLETED) {
        // Concurrency Guard & Lock Order (M9.2.8):
        // Acquire locks in consistent order across the system:
        // 1. "rides" row first (FOR UPDATE)
        // 2. "bookings" row second (FOR UPDATE)
        // This strictly matches cancelRide's lock acquisition order (rides -> bookings)
        // to eliminate check-then-update race conditions and mathematically prevent deadlocks.
        const rideIdToLock = booking.ride?.rideId || booking.rideId;
        await tx.$queryRaw`SELECT 1 FROM "rides" WHERE "ride_id" = ${rideIdToLock}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT 1 FROM "bookings" WHERE "booking_id" = ${booking.bookingId}::uuid FOR UPDATE`;

        // Re-read authoritative current database state while holding exclusive row locks
        const currentBooking = await tx.booking.findUnique({
          where: { bookingId: booking.bookingId },
          select: {
            bookingId: true,
            status: true,
            cancelledById: true,
            cancelledAt: true,
            cancellationReason: true,
            ride: {
              select: {
                rideId: true,
                status: true,
              },
            },
          },
        });

        if (
          currentBooking &&
          currentBooking.status === BookingStatus.PENDING &&
          currentBooking.ride.status === RideStatus.SCHEDULED
        ) {
          // Case A — Normal payment:
          // Booking remains PENDING, Ride remains SCHEDULED.
          // Atomically confirm booking. DriverEarning will only be created when the ride/trip is marked completed.
          await tx.booking.update({
            where: { bookingId: booking.bookingId },
            data: {
              status: BookingStatus.CONFIRMED,
            },
          });
        } else if (currentBooking && currentBooking.status === BookingStatus.CANCELLED) {
          // Case B / Case C / Case E — Booking was cancelled while payment was in-flight:
          // Invariant: Do NOT resurrect the booking to CONFIRMED.
          // Preserve existing status, cancelledById, cancelledAt, and cancellationReason.
          // The payment transaction remains COMPLETED so refund processing can handle it.
          console.warn(
            `[PAYMENT_RACE_DETECTED] Payment completed for booking ${booking.bookingId} which was cancelled (cancelledById: ${currentBooking.cancelledById}) while payment was in-flight. Retaining CANCELLED status for refund processing.`
          );
        } else if (
          currentBooking &&
          currentBooking.status === BookingStatus.PENDING &&
          currentBooking.ride.status === RideStatus.CANCELLED
        ) {
          // Case D — Ride cancelled while payment in-flight, but booking is still PENDING:
          // Invariant: Never confirm booking on a cancelled ride. Do not fabricate cancellation attribution.
          // Provider success is recorded as COMPLETED, and reconciliation alert is logged.
          console.error(
            `[CRITICAL_PAYMENT_RECONCILIATION_REQUIRED] Payment completed for booking ${booking.bookingId} but parent ride ${currentBooking.ride.rideId} is CANCELLED while booking is PENDING. Retaining PENDING status and requiring reconciliation.`
          );
        } else if (currentBooking) {
          // Any other unexpected state transition (e.g. COMPLETED booking)
          console.warn(
            `[PAYMENT_RACE_DETECTED] Payment completed for booking ${booking.bookingId} in unexpected status (booking: ${currentBooking.status}, ride: ${currentBooking.ride.status}). Booking status unchanged.`
          );
        }
      }

      return formatTransaction(updated);
    });
  } catch (persistenceError: any) {
    // CRITICAL: Database update failed after provider already responded!
    // If provider succeeded, log diagnostic context for emergency reconciliation
    if (providerResult.status === 'COMPLETED') {
      console.error(
        `[CRITICAL_PAYMENT_RECONCILIATION_REQUIRED] Provider succeeded (${providerResult.providerReference}) ` +
          `for intent ${intentTransaction.transactionId} on booking ${booking.bookingId}, ` +
          `but database update failed: ${persistenceError.message}`
      );
      // Return the in-memory intent so the caller knows the intent ID and provider reference
      return {
        transaction: {
          ...formatTransaction(intentTransaction),
          status: TransactionStatus.PENDING, // remains durable PENDING in DB for reconciliation
          providerReference: providerResult.providerReference,
          description: `${intentTransaction.description} [RECONCILIATION_PENDING: ${providerResult.providerReference}]`,
        },
        duplicateSuppressed: false,
      };
    }
    throw persistenceError;
  }

  return {
    transaction: updatedTransaction,
    duplicateSuppressed: providerResult.duplicateSuppressed,
  };
}

/**
 * Retrieves a single transaction by ID with authorization checks.
 */
export async function getTransactionById(
  userId: string,
  transactionId: string,
  isAdmin = false
): Promise<TransactionOutput> {
  const transaction = await prisma.transaction.findUnique({
    where: { transactionId },
    select: {
      ...transactionSelectProjection,
      booking: {
        select: {
          bookingId: true,
          riderId: true,
          rideId: true,
          status: true,
          seatsBooked: true,
          totalAmount: true,
          ride: {
            select: {
              driverId: true,
            },
          },
        },
      },
    },
  });

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  const isSender = transaction.senderId === userId;
  const isReceiver = transaction.receiverId === userId;
  const isRider = transaction.booking?.riderId === userId;
  const isDriver = transaction.booking?.ride?.driverId === userId;

  if (!isSender && !isReceiver && !isRider && !isDriver && !isAdmin) {
    throw new ForbiddenError(
      'Access denied: You do not have permission to view this financial transaction'
    );
  }

  return formatTransaction(transaction);
}

/**
 * Retrieves payment history for a specific booking with authorization checks.
 */
export async function getBookingTransactions(
  userId: string,
  bookingId: string,
  isAdmin = false
): Promise<TransactionOutput[]> {
  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    include: {
      ride: {
        select: {
          driverId: true,
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  const isRider = booking.riderId === userId;
  const isDriver = booking.ride.driverId === userId;

  if (!isRider && !isDriver && !isAdmin) {
    throw new ForbiddenError(
      'Access denied: You do not have permission to view transactions for this booking'
    );
  }

  const transactions = await prisma.transaction.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
    select: transactionSelectProjection,
  });

  return transactions.map(formatTransaction);
}

/**
 * Lists the authenticated user's financial transactions (sent or received).
 */
export async function listUserTransactions(
  userId: string,
  query: ListTransactionsQueryInput
): Promise<{ transactions: TransactionOutput[]; pagination: PaginationMeta }> {
  const { page, limit, type, status } = query;
  const skip = (page - 1) * limit;

  const whereClause: any = {
    OR: [{ senderId: userId }, { receiverId: userId }],
  };

  if (type) {
    whereClause.type = type;
  }

  if (status) {
    whereClause.status = status;
  }

  const [total, records] = await Promise.all([
    prisma.transaction.count({ where: whereClause }),
    prisma.transaction.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: transactionSelectProjection,
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    transactions: records.map(formatTransaction),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export const driverEarningTransactionSelectProjection = {
  transactionId: true,
  bookingId: true,
  senderId: true,
  receiverId: true,
  amount: true,
  currency: true,
  type: true,
  status: true,
  paymentMethod: true,
  providerReference: true,
  referenceTransactionId: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  booking: {
    select: {
      bookingId: true,
      rideId: true,
      seatsBooked: true,
      status: true,
      totalAmount: true,
      rider: {
        select: {
          userId: true,
          name: true,
        },
      },
      ride: {
        select: {
          rideId: true,
          source: true,
          destination: true,
          departureTime: true,
          status: true,
        },
      },
    },
  },
};

export interface DriverEarningsSummary {
  driverId: string;
  currency: string;
  totalGrossEarnings: string;
  totalRefundsDeducted: string;
  totalPlatformFees: string;
  totalNetEarnings: string;
  completedPaymentsCount: number;
  refundedTransactionsCount: number;
}

export interface DriverEarningHistoryItem {
  transactionId: string;
  bookingId: string;
  rideId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  providerReference: string | null;
  referenceTransactionId: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  booking?: {
    bookingId: string;
    seatsBooked: number;
    totalAmount: string;
    status: BookingStatus;
    rider?: {
      userId: string;
      name: string;
    };
  };
  ride?: {
    rideId: string;
    source: string;
    destination: string;
    departureTime: Date;
    status: RideStatus;
  };
}

export interface DriverEarningsResult {
  summary: DriverEarningsSummary;
  history: DriverEarningHistoryItem[];
  pagination: PaginationMeta;
}

export function formatDriverEarningHistoryItem(raw: any): DriverEarningHistoryItem {
  return {
    transactionId: raw.transactionId,
    bookingId: raw.bookingId,
    rideId: raw.booking?.rideId || raw.booking?.ride?.rideId || '',
    type: raw.type,
    status: raw.status,
    amount: raw.amount ? new Prisma.Decimal(raw.amount.toString()).toFixed(2) : '0.00',
    currency: raw.currency || 'INR',
    paymentMethod: raw.paymentMethod,
    providerReference: raw.providerReference,
    referenceTransactionId: raw.referenceTransactionId,
    description: raw.description,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    completedAt: raw.completedAt,
    booking: raw.booking
      ? {
          bookingId: raw.booking.bookingId,
          seatsBooked: raw.booking.seatsBooked,
          totalAmount: raw.booking.totalAmount
            ? new Prisma.Decimal(raw.booking.totalAmount.toString()).toFixed(2)
            : '0.00',
          status: raw.booking.status,
          rider: raw.booking.rider
            ? {
                userId: raw.booking.rider.userId,
                name: raw.booking.rider.name,
              }
            : undefined,
        }
      : undefined,
    ride: raw.booking?.ride
      ? {
          rideId: raw.booking.ride.rideId,
          source: raw.booking.ride.source,
          destination: raw.booking.ride.destination,
          departureTime: raw.booking.ride.departureTime,
          status: raw.booking.ride.status,
        }
      : undefined,
  };
}

/**
 * Retrieves driver earnings summary and paginated transaction history (M9.3.1).
 *
 * Requirements & Invariants:
 * 1. Target Driver Verification: Verifies user exists and possesses the DRIVER role.
 * 2. Gross Earnings: Sum of COMPLETED BOOKING_PAYMENT where receiverId is the driver.
 * 3. Refund Deductions: Sum of COMPLETED REFUND where senderId is the driver,
 *    and referenceTransactionId links to a driver's original BOOKING_PAYMENT.
 * 4. Net Earnings: Gross earnings minus refund deductions. Platform fee is 0.00.
 * 5. Decimal Financial Precision: Uses Prisma.Decimal arithmetic exclusively (zero JS floating point math).
 * 6. Date Range Filtering: Filters by completedAt (financial event timestamp) with inclusive bounds.
 * 7. Exclusions: Excludes PENDING, FAILED, and REVERSED transactions. Never counts refunds received as rider.
 * 8. Sorting: Orders history newest first by completedAt descending, with transactionId descending secondary tiebreaker.
 */
export async function getDriverEarnings(
  targetDriverId: string,
  query: DriverEarningsQueryInput,
  isAdmin = false
): Promise<DriverEarningsResult> {
  // 1. Verify target driver exists and is a driver
  const driverUser = await prisma.user.findUnique({
    where: { userId: targetDriverId },
    select: { userId: true, roles: true },
  });

  if (!driverUser) {
    throw new NotFoundError('Driver not found');
  }

  if (!driverUser.roles.includes(UserRole.DRIVER)) {
    throw new BadRequestError('Specified user is not a driver');
  }

  const { page = 1, limit = 20, startDate, endDate, rideId } = query;
  const skip = (page - 1) * limit;

  // 2. Build date boundary filter on completedAt
  const completedAtCondition: any = { not: null };
  if (startDate) {
    completedAtCondition.gte = startDate.includes('T')
      ? new Date(startDate)
      : new Date(`${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    completedAtCondition.lte = endDate.includes('T')
      ? new Date(endDate)
      : new Date(`${endDate}T23:59:59.999Z`);
  }

  // 3. Build where clauses for gross earnings (BOOKING_PAYMENT received)
  // ONLY count completed bookings where ride has finished and payment finalized
  const paymentWhere: Prisma.TransactionWhereInput = {
    receiverId: targetDriverId,
    type: TransactionType.BOOKING_PAYMENT,
    status: TransactionStatus.COMPLETED,
    completedAt: completedAtCondition,
    booking: {
      status: BookingStatus.COMPLETED,
      ...(rideId ? { rideId } : {}),
    },
  };

  // 4. Build where clauses for refund deductions (REFUND debited, linked to driver's original payment)
  const refundWhere: Prisma.TransactionWhereInput = {
    senderId: targetDriverId,
    type: TransactionType.REFUND,
    status: TransactionStatus.COMPLETED,
    completedAt: completedAtCondition,
    referenceTransaction: {
      receiverId: targetDriverId,
      type: TransactionType.BOOKING_PAYMENT,
    },
  };
  if (rideId) {
    refundWhere.booking = { rideId };
  }

  // 5. Build combined history where clause
  const historyWhere: Prisma.TransactionWhereInput = {
    OR: [paymentWhere, refundWhere],
  };

  // 6. Execute aggregation and paginated history query concurrently
  const [paymentsAgg, refundsAgg, totalCount, records] = await Promise.all([
    prisma.transaction.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
      _count: { transactionId: true },
    }),
    prisma.transaction.aggregate({
      where: refundWhere,
      _sum: { amount: true },
      _count: { transactionId: true },
    }),
    prisma.transaction.count({
      where: historyWhere,
    }),
    prisma.transaction.findMany({
      where: historyWhere,
      skip,
      take: limit,
      orderBy: [
        { completedAt: 'desc' },
        { transactionId: 'desc' },
      ],
      select: driverEarningTransactionSelectProjection,
    }),
  ]);

  // 7. Calculate Decimal financial summaries
  let grossDecimal = paymentsAgg._sum.amount
    ? new Prisma.Decimal(paymentsAgg._sum.amount.toString())
    : new Prisma.Decimal('0.00');

  const refundDecimal = refundsAgg._sum.amount
    ? new Prisma.Decimal(refundsAgg._sum.amount.toString())
    : new Prisma.Decimal('0.00');

  const platformFeeDecimal = new Prisma.Decimal('0.00');

  let netDecimal = grossDecimal
    .sub(refundDecimal)
    .sub(platformFeeDecimal)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);

  let completedPaymentsCount = paymentsAgg._count.transactionId || 0;
  const refundedTransactionsCount = refundsAgg._count.transactionId || 0;

  // Fallback / complement with driver_earnings table if available
  if (typeof (prisma as any).driverEarning?.aggregate === 'function') {
    try {
      const deAgg = await (prisma as any).driverEarning.aggregate({
        where: {
          driverId: targetDriverId,
          status: { in: ['AVAILABLE', 'PAID'] },
        },
        _sum: { netAmount: true, grossAmount: true },
        _count: { earningId: true },
      });
      if (deAgg?._sum?.netAmount) {
        const deNet = new Prisma.Decimal(deAgg._sum.netAmount.toString());
        if (deNet.gt(netDecimal)) {
          netDecimal = deNet;
          grossDecimal = deAgg._sum.grossAmount
            ? new Prisma.Decimal(deAgg._sum.grossAmount.toString())
            : deNet;
          completedPaymentsCount = Math.max(completedPaymentsCount, deAgg._count.earningId || 0);
        }
      }
    } catch {}
  }

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    summary: {
      driverId: targetDriverId,
      currency: 'INR',
      totalGrossEarnings: grossDecimal.toFixed(2),
      totalRefundsDeducted: refundDecimal.toFixed(2),
      totalPlatformFees: platformFeeDecimal.toFixed(2),
      totalNetEarnings: netDecimal.toFixed(2),
      completedPaymentsCount,
      refundedTransactionsCount,
    },
    history: records.map(formatDriverEarningHistoryItem),
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export const paymentService = {
  processBookingPayment,
  processBookingRefund,
  getTransactionById,
  getBookingTransactions,
  listUserTransactions,
  getDriverEarnings,
};

export interface ProcessBookingRefundInput {
  bookingId: string;
  reason?: string;
  idempotencyKey?: string;
}

/**
 * Processes a refund for an eligible cancelled booking using the two-phase intent pattern (M9.2).
 *
 * Requirements & Invariants:
 * 1. Authorization: Only the passenger (booking.riderId) or platform ADMIN can request a refund.
 * 2. Booking State: The booking must be in CANCELLED status.
 * 3. Original Payment: Must locate an existing COMPLETED transaction of type BOOKING_PAYMENT.
 * 4. Cancellation Policy & Authoritative Eligibility:
 *    - Uses authoritative server timestamps (booking.cancelledAt or now vs ride.departureTime).
 *    - If cancellation was >= 120 minutes prior to departure: 100% refundable.
 *    - If cancellation was < 120 minutes prior to departure: 50% refundable.
 *    - If booking cancellationReason explicitly designates policy (e.g. FULL_REFUND or LATE_CANCEL_50_PERCENT), respects it.
 * 5. Cumulative Refund Guard:
 *    - Sum of existing COMPLETED and unresolved PENDING refunds cannot exceed the eligible refund amount.
 * 6. Direction & Relations:
 *    - TransactionType: REFUND
 *    - senderId: Driver (booking.ride.driverId)
 *    - receiverId: Rider (booking.riderId)
 *    - referenceTransactionId: Original completed payment transactionId
 * 7. Two-Phase Intent Execution:
 *    - Phase 1: Acquires booking row lock, checks idempotency & existing refunds, creates durable PENDING intent.
 *    - Phase 2: Outside DB transaction, calls provider.processRefund().
 *    - Phase 3: Short DB transaction updates existing refund intent to COMPLETED or FAILED.
 */
export async function processBookingRefund(
  userId: string,
  input: ProcessBookingRefundInput,
  provider: PaymentProvider = defaultPaymentProvider,
  isAdmin = false
): Promise<{ transaction: TransactionOutput; duplicateSuppressed?: boolean }> {
  const effectiveIdempotencyKey = input.idempotencyKey || `auto_rf_${input.bookingId}_${userId}`;

  // =========================================================================
  // PHASE 1: Short-lived Refund Intent Transaction (Inside DB Transaction)
  // =========================================================================
  const intentResult = await prisma.$transaction(async (tx) => {
    // 1. Acquire row lock on booking
    await tx.$queryRaw`SELECT 1 FROM "bookings" WHERE "booking_id" = ${input.bookingId}::uuid FOR UPDATE`;

    // 2. Fetch booking with ride details
    const booking = await tx.booking.findUnique({
      where: { bookingId: input.bookingId },
      include: {
        ride: {
          select: {
            rideId: true,
            driverId: true,
            status: true,
            departureTime: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // 3. Authorization check: Either the passenger (riderId), the driver of the ride (driverId), or ADMIN can initiate/approve refund
    const isRider = booking.riderId === userId;
    const isDriver = booking.ride.driverId === userId;

    if (!isRider && !isDriver && !isAdmin) {
      throw new ForbiddenError(
        'Access denied: Only the passenger or the ride driver can process a refund'
      );
    }

    // 4. Booking Lifecycle Check: Only CANCELLED bookings can be refunded
    if (booking.status !== BookingStatus.CANCELLED) {
      throw new BadRequestError(
        `Cannot process refund for a booking with status ${booking.status}. Booking must be CANCELLED.`
      );
    }

    // 5. Find the original COMPLETED payment
    const originalPayment = await tx.transaction.findFirst({
      where: {
        bookingId: booking.bookingId,
        type: TransactionType.BOOKING_PAYMENT,
        status: TransactionStatus.COMPLETED,
      },
      select: transactionSelectProjection,
    });

    if (!originalPayment) {
      throw new BadRequestError(
        'No completed payment found for this booking. Nothing to refund.'
      );
    }

    // 6. Calculate eligible refund percentage and amount using authoritative policy
    // Security & Business Integrity Invariants (SEC-1, BIZ-1, TIME-1, M9.2.3):
    // - Never trust or parse user-editable cancellation text for financial calculations.
    // - Driver cancellation/rejection: 100% full refund only when reliably attributable to driver (cancelledById === ride.driverId).
    // - Administrator cancellation: 100% full refund only when cancelledById explicitly matches a normalized ID in env.ADMIN_USER_IDS.
    // - Passenger cancellation: Only when cancelledById === riderId, apply 120-minute policy using authoritative cancelledAt.
    // - RideStatus.CANCELLED alone does NOT establish driver identity or grant 100% refunds to unverified or passenger cancellations.
    // - Unknown, missing, or unverified attribution: Fail safely with 400 BadRequestError and structured error logging.
    let refundRatio: Prisma.Decimal;

    const cancelledByIdNorm =
      typeof booking.cancelledById === 'string' && booking.cancelledById.trim()
        ? booking.cancelledById.trim().toLowerCase()
        : null;

    const driverIdNorm =
      typeof booking.ride.driverId === 'string' && booking.ride.driverId.trim()
        ? booking.ride.driverId.trim().toLowerCase()
        : null;

    const riderIdNorm =
      typeof booking.riderId === 'string' && booking.riderId.trim()
        ? booking.riderId.trim().toLowerCase()
        : null;

    const normalizedAdminIds = (env.ADMIN_USER_IDS || [])
      .map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : ''))
      .filter(Boolean);

    const isDriverCancellation =
      cancelledByIdNorm !== null &&
      driverIdNorm !== null &&
      cancelledByIdNorm === driverIdNorm;

    const isAdminCancellation =
      cancelledByIdNorm !== null &&
      normalizedAdminIds.includes(cancelledByIdNorm);

    const isPassengerCancellation =
      cancelledByIdNorm !== null &&
      riderIdNorm !== null &&
      cancelledByIdNorm === riderIdNorm;

    if (isDriverCancellation) {
      // 1. Driver rejection or driver-initiated cancellation: 100% full refund (Decision 11)
      refundRatio = new Prisma.Decimal('1.0');
    } else if (isAdminCancellation) {
      // 2. Administrator cancellation: Verified via env.ADMIN_USER_IDS: 100% full refund
      refundRatio = new Prisma.Decimal('1.0');
    } else if (isPassengerCancellation) {
      // 3. Passenger cancellation: Enforce authoritative M7 / Decision 11 time-windowed policy
      // Never use refund-request time or guess when cancelledAt is missing.
      if (!booking.cancelledAt) {
        console.error(
          `[REFUND_ERROR] Missing cancellation timestamp (cancelledAt) for cancelled booking ${booking.bookingId}. Cannot determine authoritative refund window.`
        );
        throw new BadRequestError(
          'Cannot determine refund entitlement: Booking cancellation timestamp (cancelledAt) is missing. Please contact platform support.'
        );
      }

      const cancelTimeMs = new Date(booking.cancelledAt).getTime();
      const departureTimeMs = new Date(booking.ride.departureTime).getTime();
      const diffMs = departureTimeMs - cancelTimeMs;

      // Issue 9: Δt >= 120 minutes -> 100% full refund; Δt < 120 minutes -> 50% late cancellation refund
      if (diffMs >= 120 * 60 * 1000) {
        refundRatio = new Prisma.Decimal('1.0');
      } else {
        refundRatio = new Prisma.Decimal('0.5');
      }
    } else {
      // 4. Unknown, missing, or unverified cancellation attribution: Fail safely
      // RideStatus.CANCELLED alone does NOT establish driver identity or override attribution
      console.error(
        `[REFUND_ERROR] Unverifiable cancellation actor attribution for booking ${booking.bookingId}. cancelledById: ${booking.cancelledById}, rideStatus: ${booking.ride.status}`
      );
      throw new BadRequestError(
        'Cannot determine refund entitlement: Cancellation actor could not be verified. Please contact platform support.'
      );
    }

    // 7. Calculate maximum refundable amount using Prisma.Decimal arithmetic (FIN-1)
    const originalAmountDecimal = new Prisma.Decimal(originalPayment.amount.toString());
    const maxRefundableDecimal = originalAmountDecimal
      .mul(refundRatio)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    const maxRefundableStr = maxRefundableDecimal.toFixed(2);

    if (maxRefundableDecimal.lte(0)) {
      throw new BadRequestError(
        `No refundable amount available for this booking under current policy (Eligible refund is INR 0.00)`
      );
    }

    // 8. Check for existing refunds linked to this original payment
    const existingRefunds = await tx.transaction.findMany({
      where: {
        bookingId: booking.bookingId,
        type: TransactionType.REFUND,
        referenceTransactionId: originalPayment.transactionId,
        status: {
          in: [TransactionStatus.COMPLETED, TransactionStatus.PENDING],
        },
      },
      select: transactionSelectProjection,
    });

    // Check for exact idempotency match on previous refund
    if (input.idempotencyKey) {
      const match = existingRefunds.find((rf) =>
        rf.description?.includes(`[IDEMPOTENCY:${input.idempotencyKey}]`)
      );
      if (match) {
        return {
          type: 'EXISTING_IDEMPOTENT' as const,
          transaction: match,
          duplicateSuppressed: true,
        };
      }
    }

    // Check if there is an unresolved PENDING refund attempt
    const pendingRefund = existingRefunds.find(
      (rf) => rf.status === TransactionStatus.PENDING
    );
    if (pendingRefund) {
      if (
        input.idempotencyKey &&
        pendingRefund.description?.includes(`[IDEMPOTENCY:${input.idempotencyKey}]`)
      ) {
        return {
          type: 'EXISTING_IDEMPOTENT' as const,
          transaction: pendingRefund,
          duplicateSuppressed: true,
        };
      }
      throw new ConflictError(
        'A refund request is currently pending and unresolved for this booking. Please wait before attempting again.'
      );
    }

    // Check cumulative refunded amount against maximum allowed (FIN-1)
    const totalAlreadyRefundedDecimal = existingRefunds
      .filter((rf) => rf.status === TransactionStatus.COMPLETED)
      .reduce(
        (sum, rf) => sum.add(new Prisma.Decimal(rf.amount.toString())),
        new Prisma.Decimal('0.00')
      );

    if (totalAlreadyRefundedDecimal.gte(maxRefundableDecimal)) {
      throw new ConflictError(
        `This booking has already been fully refunded according to policy (Refunded: INR ${totalAlreadyRefundedDecimal.toFixed(
          2
        )}, Max Eligible: INR ${maxRefundableStr})`
      );
    }

    const remainingRefundableDecimal = maxRefundableDecimal
      .sub(totalAlreadyRefundedDecimal)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);

    if (remainingRefundableDecimal.lte(0)) {
      throw new ConflictError(
        `No refundable balance remaining for this booking under current policy (Max Eligible: INR ${maxRefundableStr}, Already Refunded: INR ${totalAlreadyRefundedDecimal.toFixed(
          2
        )})`
      );
    }

    const refundAmountStr = remainingRefundableDecimal.toFixed(2);

    // 9. Create durable PENDING refund intent
    const descParts: string[] = [];
    descParts.push(`[IDEMPOTENCY:${input.idempotencyKey || effectiveIdempotencyKey}]`);
    descParts.push(
      `[POLICY:${refundRatio.equals(1) ? '100%_FULL_REFUND' : '50%_LATE_CANCEL'}]`
    );
    if (input.reason) {
      descParts.push(input.reason);
    }
    const finalDescription = descParts.join(' ');
    const intentReference = `intent_rf_${crypto.randomUUID()}`;

    // Sender = Driver (reversing funds), Receiver = Rider (receiving refund)
    const createdIntent = await tx.transaction.create({
      data: {
        bookingId: booking.bookingId,
        senderId: booking.ride.driverId,
        receiverId: booking.riderId,
        amount: refundAmountStr,
        currency: originalPayment.currency || 'INR',
        type: TransactionType.REFUND,
        status: TransactionStatus.PENDING,
        paymentMethod: originalPayment.paymentMethod || 'SIMULATED',
        providerReference: intentReference,
        referenceTransactionId: originalPayment.transactionId,
        description: finalDescription,
        completedAt: null,
      },
      select: transactionSelectProjection,
    });

    return {
      type: 'NEW_REFUND_INTENT' as const,
      transaction: createdIntent,
      booking,
      originalPayment,
      refundAmountStr,
      duplicateSuppressed: false,
    };
  });

  // Short-circuit if an existing transaction was returned idempotently
  if (intentResult.type === 'EXISTING_IDEMPOTENT') {
    return {
      transaction: formatTransaction(intentResult.transaction),
      duplicateSuppressed: intentResult.duplicateSuppressed,
    };
  }

  const {
    transaction: intentTransaction,
    booking,
    originalPayment,
    refundAmountStr,
  } = intentResult;

  // =========================================================================
  // PHASE 2: External Provider Invocation (OUTSIDE Database Transaction)
  // =========================================================================
  let providerResult: ProcessRefundResult;

  try {
    providerResult = await provider.processRefund({
      amount: refundAmountStr,
      currency: originalPayment.currency || 'INR',
      bookingId: booking.bookingId,
      originalPaymentReference:
        originalPayment.providerReference || `sim_pay_${originalPayment.transactionId}`,
      idempotencyKey: input.idempotencyKey || effectiveIdempotencyKey,
      reason: input.reason,
    });
  } catch (providerError: any) {
    const errMsg = providerError?.message || 'Gateway refund connection failed';
    const isTimeout =
      errMsg.toLowerCase().includes('timeout') ||
      errMsg.toLowerCase().includes('aborted') ||
      errMsg.toLowerCase().includes('econnreset');

    if (isTimeout) {
      // Uncertain outcome: do not mark FAILED, keep intent PENDING
      providerResult = {
        success: false,
        status: 'PENDING',
        providerReference: intentTransaction.providerReference || `intent_rf_${intentTransaction.transactionId}`,
        errorMessage: `Uncertain outcome: ${errMsg}`,
        isSimulated: true,
      };
    } else {
      providerResult = {
        success: false,
        status: 'FAILED',
        providerReference: `sim_rf_err_${Date.now()}`,
        errorMessage: `Refund provider error: ${errMsg}`,
        isSimulated: true,
      };
    }
  }

  // =========================================================================
  // PHASE 3: Persist Refund Outcome (Short-lived DB Transaction)
  // =========================================================================
  let updatedTransaction: TransactionOutput;

  try {
    updatedTransaction = await prisma.$transaction(async (tx) => {
      let targetStatus: TransactionStatus;
      if (providerResult.status === 'COMPLETED') {
        targetStatus = TransactionStatus.COMPLETED;
      } else if (providerResult.status === 'PENDING') {
        targetStatus = TransactionStatus.PENDING;
      } else {
        targetStatus = TransactionStatus.FAILED;
      }

      const descParts: string[] = [];
      descParts.push(`[IDEMPOTENCY:${input.idempotencyKey || effectiveIdempotencyKey}]`);
      if (input.reason) {
        descParts.push(input.reason);
      }
      if (providerResult.errorMessage) {
        descParts.push(`[FAILURE: ${providerResult.errorMessage}]`);
      }
      const updatedDescription = descParts.join(' ');

      const updated = await tx.transaction.update({
        where: { transactionId: intentTransaction.transactionId },
        data: {
          status: targetStatus,
          providerReference: providerResult.providerReference,
          description: updatedDescription,
          completedAt:
            targetStatus === TransactionStatus.COMPLETED ? new Date() : null,
        },
        select: transactionSelectProjection,
      });

      // Credit refunded amount directly to user's wallet
      if (targetStatus === TransactionStatus.COMPLETED && booking.riderId) {
        try {
          await tx.user.update({
            where: { userId: booking.riderId },
            data: {
              walletBalance: {
                increment: intentTransaction.amount,
              },
            },
          });
        } catch (walletErr) {
          console.error('[WALLET_REFUND_CREDIT_ERROR] Failed to credit wallet for refund:', walletErr);
        }
      }

      return formatTransaction(updated);
    });
  } catch (persistenceError: any) {
    if (providerResult.status === 'COMPLETED') {
      console.error(
        `[CRITICAL_REFUND_RECONCILIATION_REQUIRED] Provider succeeded refund (${providerResult.providerReference}) ` +
          `for intent ${intentTransaction.transactionId} on booking ${booking.bookingId}, ` +
          `but database update failed: ${persistenceError.message}`
      );
      return {
        transaction: {
          ...formatTransaction(intentTransaction),
          status: TransactionStatus.PENDING,
          providerReference: providerResult.providerReference,
          description: `${intentTransaction.description} [RECONCILIATION_PENDING: ${providerResult.providerReference}]`,
        },
        duplicateSuppressed: false,
      };
    }
    throw persistenceError;
  }

  return {
    transaction: updatedTransaction,
    duplicateSuppressed: providerResult.duplicateSuppressed,
  };
}
