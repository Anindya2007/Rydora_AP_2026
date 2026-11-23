import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  processPaymentSchema,
  processRefundSchema,
  transactionIdParamSchema,
  bookingPaymentsParamSchema,
  listTransactionsQuerySchema,
} from '../validators/payment.validator.js';
import { PaymentController } from '../controllers/payment.controller.js';

export const paymentRouter = Router();

export const validateProcessPayment = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = processPaymentSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateProcessRefund = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = processRefundSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateTransactionIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    transactionIdParamSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateBookingPaymentsParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    bookingPaymentsParamSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateListTransactionsQuery = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    listTransactionsQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/payments
 * POST /api/v1/payments/payment
 * POST /api/v1/transactions/payment
 * Processes a financial transaction for a booking.
 */
paymentRouter.post(
  '/',
  authenticate,
  validateProcessPayment,
  PaymentController.processPayment
);

paymentRouter.post(
  '/payment',
  authenticate,
  validateProcessPayment,
  PaymentController.processPayment
);

/**
 * POST /api/v1/payments/refund
 * POST /api/v1/transactions/refund
 * Processes a refund transaction for an eligible cancelled booking.
 */
paymentRouter.post(
  '/refund',
  authenticate,
  validateProcessRefund,
  PaymentController.processRefund
);

/**
 * GET /api/v1/payments
 * GET /api/v1/transactions
 * Lists authenticated user's financial transactions.
 */
paymentRouter.get(
  '/',
  authenticate,
  validateListTransactionsQuery,
  PaymentController.listUserTransactions
);

/**
 * GET /api/v1/payments/booking/:bookingId
 * GET /api/v1/transactions/booking/:bookingId
 * Retrieves transactions associated with a booking.
 */
paymentRouter.get(
  '/booking/:bookingId',
  authenticate,
  validateBookingPaymentsParam,
  PaymentController.getBookingTransactions
);

/**
 * GET /api/v1/payments/:transactionId
 * GET /api/v1/transactions/:transactionId
 * Retrieves single transaction details by ID.
 */
paymentRouter.get(
  '/:transactionId',
  authenticate,
  validateTransactionIdParam,
  PaymentController.getTransactionById
);
