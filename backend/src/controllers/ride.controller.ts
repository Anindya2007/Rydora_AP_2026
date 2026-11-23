import type { Request, Response, NextFunction } from 'express';
import { createRideSchema } from '../validators/rideValidator.js';
import { rideService } from '../services/ride.service.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Controller handling ride publication (POST /api/v1/rides).
 * Derives driver identity strictly from authenticated req.user.userId.
 */
export async function createRide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedData = createRideSchema.parse(req.body);
    const ride = await rideService.createRide(req.user.userId, validatedData);

    sendSuccess(res, { ride }, 'Ride created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export const RideController = {
  createRide,
};
