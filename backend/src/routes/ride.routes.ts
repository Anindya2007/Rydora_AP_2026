import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { UserRole } from '../generated/prisma/client.js';
import { createRideSchema } from '../validators/rideValidator.js';
import { RideController } from '../controllers/ride.controller.js';

export const rideRouter = Router();

/**
 * Request body validation middleware for ride publication.
 * Parses req.body against createRideSchema and forwards ZodError to errorHandler.
 */
export const validateCreateRide = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = createRideSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/rides
 * Protected endpoint for verified drivers to publish a new carpool ride.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. requireRoles(UserRole.DRIVER) - Enforces global DRIVER role on req.user.roles.
 * 3. validateCreateRide - Enforces payload validation, ISO date, positive seat counts, valid coordinates.
 * 4. RideController.createRide - Validates vehicle ownership, community membership, prevents conflicts, and creates ride.
 */
rideRouter.post(
  '/',
  authenticate,
  requireRoles(UserRole.DRIVER),
  validateCreateRide,
  RideController.createRide
);
