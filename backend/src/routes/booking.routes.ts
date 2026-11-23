import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createBookingSchema } from '../validators/bookingValidator.js';
import { BookingController } from '../controllers/booking.controller.js';

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
