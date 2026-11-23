import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  bookingIdParamSchema,
  cancelBookingSchema,
  createBookingSchema,
  myBookingsQuerySchema,
  rejectBookingSchema,
} from '../validators/bookingValidator.js';
import { BookingController } from '../controllers/booking.controller.js';
import { PaymentController } from '../controllers/payment.controller.js';
import { validateProcessPayment } from './payment.routes.js';

export const bookingRouter = Router();

/**
 * Request body validation middleware for booking creation.
 * Parses req.body against createBookingSchema and forwards ZodError to errorHandler.
 */
export const validateCreateBooking = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = createBookingSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request parameter validation middleware for single booking retrieval.
 */
export const validateBookingIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    bookingIdParamSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request query validation middleware for passenger booking history.
 */
export const validateMyBookingsQuery = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    myBookingsQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request body validation middleware for driver booking rejection.
 */
export const validateRejectBooking = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = rejectBookingSchema.parse(req.body ?? {});
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request body validation middleware for passenger booking cancellation.
 */
export const validateCancelBooking = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = cancelBookingSchema.parse(req.body ?? {});
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/bookings
 * Protected endpoint for authenticated passengers to reserve seats on a scheduled carpool ride.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateCreateBooking - Validates rideId (UUID) and seatsBooked (1..4).
 * 3. BookingController.createBooking - Performs atomic seat allocation and booking creation.
 */
bookingRouter.post(
  '/',
  authenticate,
  validateCreateBooking,
  BookingController.createBooking
);

/**
 * GET /api/v1/bookings/me
 * Protected endpoint for authenticated passengers to retrieve their booking history.
 * NOTE: Defined BEFORE /:bookingId to prevent Express routing 'me' as a bookingId parameter.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateMyBookingsQuery - Validates pagination and status query parameters.
 * 3. BookingController.getMyBookings - Retrieves paginated booking history isolated to req.user.userId.
 */
bookingRouter.get(
  '/me',
  authenticate,
  validateMyBookingsQuery,
  BookingController.getMyBookings
);

/**
 * PATCH /api/v1/bookings/:bookingId/approve
 * POST  /api/v1/bookings/:bookingId/approve
 * Protected endpoint for authorized drivers to approve a pending booking request.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateBookingIdParam - Validates bookingId parameter as a well-formed UUID.
 * 3. BookingController.approveBooking - Enforces ride ownership, checks pending status, performs atomic transition.
 */
bookingRouter.patch(
  '/:bookingId/approve',
  authenticate,
  validateBookingIdParam,
  BookingController.approveBooking
);

bookingRouter.post(
  '/:bookingId/approve',
  authenticate,
  validateBookingIdParam,
  BookingController.approveBooking
);

/**
 * PATCH /api/v1/bookings/:bookingId/reject
 * POST  /api/v1/bookings/:bookingId/reject
 * Protected endpoint for authorized drivers to reject a pending booking request.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateBookingIdParam - Validates bookingId parameter as a well-formed UUID.
 * 3. validateRejectBooking - Validates optional rejection reason payload.
 * 4. BookingController.rejectBooking - Enforces ownership, marks cancelled, atomically restores seats.
 */
bookingRouter.patch(
  '/:bookingId/reject',
  authenticate,
  validateBookingIdParam,
  validateRejectBooking,
  BookingController.rejectBooking
);

bookingRouter.post(
  '/:bookingId/reject',
  authenticate,
  validateBookingIdParam,
  validateRejectBooking,
  BookingController.rejectBooking
);

/**
 * PATCH /api/v1/bookings/:bookingId/cancel
 * POST  /api/v1/bookings/:bookingId/cancel
 * Protected endpoint for authenticated passengers or platform admins to cancel a booking.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateBookingIdParam - Validates bookingId parameter as a well-formed UUID.
 * 3. validateCancelBooking - Validates optional cancellation reason payload.
 * 4. BookingController.cancelBooking - Enforces passenger/admin ownership, checks lifecycle, restores seats atomically.
 */
bookingRouter.patch(
  '/:bookingId/cancel',
  authenticate,
  validateBookingIdParam,
  validateCancelBooking,
  BookingController.cancelBooking
);

bookingRouter.post(
  '/:bookingId/cancel',
  authenticate,
  validateBookingIdParam,
  validateCancelBooking,
  BookingController.cancelBooking
);

/**
 * GET /api/v1/bookings/:bookingId
 * Protected endpoint for authorized passengers, drivers, and admins to retrieve a single booking.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateBookingIdParam - Validates bookingId parameter as a well-formed UUID.
 * 3. BookingController.getBookingById - Enforces ownership (rider or ride driver) or ADMIN role.
 */
bookingRouter.get(
  '/:bookingId',
  authenticate,
  validateBookingIdParam,
  BookingController.getBookingById
);

/**
 * GET /api/v1/bookings/:bookingId/payments
 * Protected endpoint to retrieve financial transactions associated with a booking.
 */
bookingRouter.get(
  '/:bookingId/payments',
  authenticate,
  validateBookingIdParam,
  PaymentController.getBookingTransactions
);

/**
 * POST /api/v1/bookings/:bookingId/payments
 * Protected endpoint to process a payment directly for a booking.
 */
bookingRouter.post(
  '/:bookingId/payments',
  authenticate,
  validateBookingIdParam,
  (req, _res, next) => {
    // Inject bookingId from path parameter into body for validation
    req.body = { ...req.body, bookingId: req.params.bookingId };
    next();
  },
  validateProcessPayment,
  PaymentController.processPayment
);
