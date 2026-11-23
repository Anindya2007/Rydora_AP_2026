import type { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service.js';
import { sendSuccess } from '../utils/response.js';
import { ForbiddenError } from '../utils/errors.js';
import {
  type ProcessPaymentInput,
  type ProcessRefundInput,
  type ListTransactionsQueryInput,
  type DriverEarningsQueryInput,
  listTransactionsQuerySchema,
  driverEarningsQuerySchema,
} from '../validators/payment.validator.js';

export class PaymentController {
  /**
   * POST /api/v1/payments
   * POST /api/v1/transactions/payment
   * Initiates and records a financial payment transaction for a booking.
   */
  static async processPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user?.roles?.includes('ADMIN') || false;
      const input = req.body as ProcessPaymentInput;

      // Extract optional Idempotency-Key header if not present in request body
      const idempotencyHeader = req.headers['idempotency-key'] as
        | string
        | undefined;
      if (idempotencyHeader && !input.idempotencyKey) {
        input.idempotencyKey = idempotencyHeader.trim();
      }

      const { transaction, duplicateSuppressed } =
        await paymentService.processBookingPayment(
          userId,
          input,
          undefined,
          isAdmin
        );

      const statusCode = duplicateSuppressed ? 200 : 201;
      const message = duplicateSuppressed
        ? 'Payment transaction replayed idempotently'
        : transaction.status === 'COMPLETED'
        ? 'Payment processed and booking confirmed successfully'
        : transaction.status === 'PENDING'
        ? 'Payment initiated and awaiting provider completion'
        : 'Payment transaction failed: Provider declined';

      sendSuccess(res, { transaction, duplicateSuppressed }, message, statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/refund
   * POST /api/v1/transactions/refund
   * POST /api/v1/bookings/:bookingId/refund
   * Initiates and records a financial refund transaction for an eligible cancelled booking.
   */
  static async processRefund(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user?.roles?.includes('ADMIN') || false;
      const input = req.body as ProcessRefundInput;

      // Extract optional Idempotency-Key header if not present in request body
      const idempotencyHeader = req.headers['idempotency-key'] as
        | string
        | undefined;
      if (idempotencyHeader && !input.idempotencyKey) {
        input.idempotencyKey = idempotencyHeader.trim();
      }

      const { transaction, duplicateSuppressed } =
        await paymentService.processBookingRefund(
          userId,
          input,
          undefined,
          isAdmin
        );

      const statusCode = duplicateSuppressed ? 200 : 201;
      const message = duplicateSuppressed
        ? 'Refund transaction replayed idempotently'
        : transaction.status === 'COMPLETED'
        ? 'Refund processed and completed successfully'
        : transaction.status === 'PENDING'
        ? 'Refund initiated and awaiting gateway settlement'
        : 'Refund transaction failed: Provider declined';

      sendSuccess(res, { transaction, duplicateSuppressed }, message, statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/:transactionId
   * GET /api/v1/transactions/:transactionId
   * Retrieves single transaction details with participant authorization.
   */
  static async getTransactionById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user?.roles?.includes('ADMIN') || false;
      const transactionId = req.params.transactionId as string;

      const transaction = await paymentService.getTransactionById(
        userId,
        transactionId,
        isAdmin
      );

      sendSuccess(
        res,
        { transaction },
        'Financial transaction retrieved successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/bookings/:bookingId/payments
   * GET /api/v1/bookings/:bookingId/transactions
   * Retrieves payment transaction history for a specific booking.
   */
  static async getBookingTransactions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user?.roles?.includes('ADMIN') || false;
      const bookingId = req.params.bookingId as string;

      const transactions = await paymentService.getBookingTransactions(
        userId,
        bookingId,
        isAdmin
      );

      sendSuccess(
        res,
        { transactions },
        'Booking transaction history retrieved successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments
   * GET /api/v1/transactions
   * Lists the authenticated user's financial transactions (sent or received).
   */
  static async listUserTransactions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const query = listTransactionsQuerySchema.parse(req.query);

      const { transactions, pagination } =
        await paymentService.listUserTransactions(userId, query);

      sendSuccess(
        res,
        { transactions },
        'User transactions retrieved successfully',
        200,
        pagination
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/driver/earnings
   * GET /api/v1/transactions/driver/earnings
   * Retrieves driver earnings summary and paginated history.
   */
  static async getDriverEarnings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requester = req.user!;
      const isAdmin = requester.roles.includes('ADMIN');
      const query = driverEarningsQuerySchema.parse(req.query);

      // Drivers can only access their own earnings; Admins may specify a target driverId
      if (!isAdmin && query.driverId && query.driverId !== requester.userId) {
        throw new ForbiddenError(
          'Access denied: Drivers can only view their own earnings'
        );
      }

      const targetDriverId =
        isAdmin && query.driverId ? query.driverId : requester.userId;

      const { summary, history, pagination } =
        await paymentService.getDriverEarnings(
          targetDriverId,
          query,
          isAdmin
        );

      sendSuccess(
        res,
        { summary, history },
        'Driver earnings retrieved successfully',
        200,
        pagination
      );
    } catch (error) {
      next(error);
    }
  }
}
