import type { Request, Response, NextFunction } from 'express';
import {
  bookingIdParamSchema,
  cancelBookingSchema,
  createBookingSchema,
  myBookingsQuerySchema,
  rejectBookingSchema,
  rideBookingsQuerySchema,
} from '../validators/bookingValidator.js';
import { rideIdParamSchema } from '../validators/rideValidator.js';
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

/**
 * Controller handling passenger manifest retrieval for a ride (GET /api/v1/rides/:rideId/bookings).
 * Permits access to publishing driver or platform admin.
 */
export async function getRideBookings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { rideId } = rideIdParamSchema.parse(req.params);
    const validatedQuery = rideBookingsQuerySchema.parse(req.query);
    const result = await bookingService.listRideBookings(
      req.user,
      rideId,
      validatedQuery
    );

    sendSuccess(
      res,
      { bookings: result.bookings },
      'Ride passenger manifest retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling driver approval of a pending booking (PATCH /api/v1/bookings/:bookingId/approve).
 */
export async function approveBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const booking = await bookingService.approveBooking(
      req.user.userId,
      bookingId
    );

    sendSuccess(res, { booking }, 'Booking approved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling driver rejection of a pending booking (PATCH /api/v1/bookings/:bookingId/reject).
 */
export async function rejectBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const validatedBody = rejectBookingSchema.parse(req.body ?? {});
    const booking = await bookingService.rejectBooking(
      req.user.userId,
      bookingId,
      validatedBody.reason
    );

    sendSuccess(res, { booking }, 'Booking rejected successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling passenger booking cancellation (PATCH /api/v1/bookings/:bookingId/cancel).
 * Enforces rider ownership or platform admin permissions.
 */
export async function cancelBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { bookingId } = bookingIdParamSchema.parse(req.params);
    const validatedBody = cancelBookingSchema.parse(req.body ?? {});
    const reason = validatedBody.reason || validatedBody.cancellationReason || undefined;
    const isAdmin = req.user.roles.includes('ADMIN');

    const booking = await bookingService.cancelPassengerBooking(
      req.user.userId,
      bookingId,
      reason,
      isAdmin
    );

    sendSuccess(res, { booking }, 'Booking cancelled successfully', 200);
  } catch (error) {
    next(error);
  }
}

export const BookingController = {
  createBooking,
  getBookingById,
  getMyBookings,
  getRideBookings,
  approveBooking,
  rejectBooking,
  cancelBooking,
};
