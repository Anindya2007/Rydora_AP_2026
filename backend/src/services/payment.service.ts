import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import {
  BookingStatus,
  RideStatus,
  TransactionType,
  TransactionStatus,
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
} from './payment-provider.js';
import type {
  ProcessPaymentInput,
  ListTransactionsQueryInput,
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
      if (
        targetStatus === TransactionStatus.COMPLETED &&
        booking.status === BookingStatus.PENDING
      ) {
        await tx.booking.update({
          where: { bookingId: booking.bookingId },
          data: {
            status: BookingStatus.CONFIRMED,
          },
        });
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

export const paymentService = {
  processBookingPayment,
  getTransactionById,
  getBookingTransactions,
  listUserTransactions,
};
