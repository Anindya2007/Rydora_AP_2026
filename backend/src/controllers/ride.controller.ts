import type { Request, Response, NextFunction } from 'express';
import {
  createRideSchema,
  driverRidesQuerySchema,
  rideIdParamSchema,
  rideQuerySchema,
  updateRideSchema,
} from '../validators/rideValidator.js';
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

/**
 * Controller handling authenticated driver's ride listing (GET /api/v1/rides/me).
 * Supports status filter and pagination.
 */
export async function listDriverRides(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedQuery = driverRidesQuerySchema.parse(req.query);
    const result = await rideService.listDriverRides(
      req.user.userId,
      validatedQuery
    );

    sendSuccess(
      res,
      { rides: result.rides },
      'Driver rides retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling single ride retrieval by UUID (GET /api/v1/rides/:rideId).
 * Enforces community membership / driver visibility checks.
 */
export async function getRideById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { rideId } = rideIdParamSchema.parse(req.params);
    const ride = await rideService.getRideById(req.user.userId, rideId);

    sendSuccess(res, { ride }, 'Ride retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling public and authenticated ride listing & discovery (GET /api/v1/rides).
 * Supports comprehensive filtering, bounded pagination, and deterministic sorting.
 */
export async function listRides(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedQuery = rideQuerySchema.parse(req.query);
    const userId = req.user?.userId;
    const result = await rideService.listRides(validatedQuery, userId);

    sendSuccess(
      res,
      { rides: result.rides },
      'Rides retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling ride updates (PATCH /api/v1/rides/:rideId).
 * Enforces driver ownership, validation, and lifecycle invariants.
 */
export async function updateRide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { rideId } = rideIdParamSchema.parse(req.params);
    const validatedData = updateRideSchema.parse(req.body);
    const ride = await rideService.updateRide(
      req.user.userId,
      rideId,
      validatedData
    );

    sendSuccess(res, { ride }, 'Ride updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling ride cancellation (POST/PATCH /api/v1/rides/:rideId/cancel or DELETE /api/v1/rides/:rideId).
 * Enforces driver ownership, non-repeatable cancellation, and atomic lifecycle consistency.
 */
export async function cancelRide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { rideId } = rideIdParamSchema.parse(req.params);
    const ride = await rideService.cancelRide(req.user.userId, rideId);

    sendSuccess(res, { ride }, 'Ride cancelled successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function completeRide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { rideId } = rideIdParamSchema.parse(req.params);
    const ride = await rideService.completeRide(req.user.userId, rideId);

    sendSuccess(res, { ride }, 'Ride completed successfully and driver earnings credited', 200);
  } catch (error) {
    next(error);
  }
}

export const RideController = {
  createRide,
  listDriverRides,
  getRideById,
  listRides,
  updateRide,
  cancelRide,
  completeRide,
};
