import type { Request, Response, NextFunction } from 'express';
import { createBookingSchema } from '../validators/bookingValidator.js';
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

export const BookingController = {
  createBooking,
};
