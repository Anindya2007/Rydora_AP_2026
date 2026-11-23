import type { Request, Response, NextFunction } from 'express';
import {
  bookingIdParamSchema,
  createBookingSchema,
  myBookingsQuerySchema,
} from '../validators/bookingValidator.js';
import { bookingService } from '../services/booking.service.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Controller handling passenger booking creation (POST /api/v1/bookings).
 * Derives passenger identity strictly from authenticated req.user.userId.
 */
export async function createBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedData = createBookingSchema.parse(req.body);
    const booking = await bookingService.createBooking(
      req.user.userId,
      validatedData
    );

    sendSuccess(res, { booking }, 'Booking created successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling single booking retrieval (GET /api/v1/bookings/:bookingId).
 * Enforces ownership (rider or ride driver) and platform admin permissions.
 */
export async function getBookingById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const booking = await bookingService.getBookingById(req.user, bookingId);

    sendSuccess(res, { booking }, 'Booking retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling passenger booking history retrieval (GET /api/v1/bookings/me).
 * Isolates records strictly to authenticated req.user.userId.
 */
export async function getMyBookings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedQuery = myBookingsQuerySchema.parse(req.query);
    const result = await bookingService.listPassengerBookings(
      req.user.userId,
      validatedQuery
    );

    sendSuccess(
      res,
      { bookings: result.bookings },
      'Passenger bookings retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

export const BookingController = {
  createBooking,
  getBookingById,
  getMyBookings,
};
