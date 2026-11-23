import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate, authenticateOptional } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  createRideSchema,
  rideIdParamSchema,
  driverRidesQuerySchema,
  rideQuerySchema,
  updateRideSchema,
} from '../validators/rideValidator.js';
import { RideController } from '../controllers/ride.controller.js';
import { BookingController } from '../controllers/booking.controller.js';
import { rideBookingsQuerySchema } from '../validators/bookingValidator.js';

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
 * Request parameter validation middleware for single ride retrieval.
 */
export const validateRideIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    rideIdParamSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request query validation middleware for driver rides listing.
 */
export const validateDriverRidesQuery = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    driverRidesQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request query validation middleware for ride listing and discovery.
 */
export const validateRideQuery = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    rideQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request query validation middleware for ride passenger manifest.
 */
export const validateRideBookingsQuery = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    rideBookingsQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request body validation middleware for ride updates (PATCH /api/v1/rides/:rideId).
 */
export const validateUpdateRide = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = updateRideSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/rides/me
 * Protected endpoint for authenticated drivers to view their published rides.
 * NOTE: Declared BEFORE /:rideId to prevent route parameter collision.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. requireRoles(UserRole.DRIVER) - Enforces global DRIVER role on req.user.roles.
 * 3. validateDriverRidesQuery - Validates pagination and status filters.
 * 4. RideController.listDriverRides - Returns paginated list of driver's rides.
 */
rideRouter.get(
  '/me',
  authenticate,
  requireRoles(UserRole.DRIVER),
  validateDriverRidesQuery,
  RideController.listDriverRides
);

/**
 * GET /api/v1/rides/search
 * Public & authenticated discovery alias for carpool ride listings.
 * NOTE: Declared before /:rideId to prevent route parameter collision.
 */
rideRouter.get(
  '/search',
  authenticateOptional,
  validateRideQuery,
  RideController.listRides
);

/**
 * GET /api/v1/rides
 * Public & authenticated discovery endpoint for listing and searching available carpool rides.
 * Supports filtering by community, route (source/destination), status, seats, vehicle, and date ranges.
 * NOTE: Declared before /:rideId to prevent route parameter collision.
 */
rideRouter.get(
  '/',
  authenticateOptional,
  validateRideQuery,
  RideController.listRides
);

/**
 * GET /api/v1/rides/:rideId
 * Protected endpoint to retrieve details of an individual ride.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateRideIdParam - Validates rideId parameter as a well-formed UUID.
 * 3. RideController.getRideById - Verifies community visibility and returns ride with safe driver/vehicle details.
 */
rideRouter.get(
  '/:rideId',
  authenticate,
  validateRideIdParam,
  RideController.getRideById
);

/**
 * GET /api/v1/rides/:rideId/bookings
 * Protected endpoint for authorized drivers (and platform admins) to retrieve the passenger manifest.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateRideIdParam - Validates rideId parameter as a well-formed UUID.
 * 3. validateRideBookingsQuery - Validates pagination and status query parameters.
 * 4. BookingController.getRideBookings - Enforces ride ownership, returns sanitized passenger bookings.
 */
rideRouter.get(
  '/:rideId/bookings',
  authenticate,
  validateRideIdParam,
  validateRideBookingsQuery,
  BookingController.getRideBookings
);

/**
 * PATCH /api/v1/rides/:rideId
 * Protected endpoint for authorized drivers to update their published ride.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. requireRoles(UserRole.DRIVER) - Enforces global DRIVER role on req.user.roles.
 * 3. validateRideIdParam - Validates rideId parameter as a well-formed UUID.
 * 4. validateUpdateRide - Validates update payload against updateRideSchema (rejects protected/immutable fields).
 * 5. RideController.updateRide - Enforces ownership, lifecycle state, capacity invariants, and performs atomic update.
 */
rideRouter.patch(
  '/:rideId',
  authenticate,
  requireRoles(UserRole.DRIVER),
  validateRideIdParam,
  validateUpdateRide,
  RideController.updateRide
);

/**
 * POST /api/v1/rides/:rideId/cancel
 * PATCH /api/v1/rides/:rideId/cancel
 * DELETE /api/v1/rides/:rideId
 * Protected endpoint for authorized drivers to cancel their scheduled ride.
 * Supports POST, PATCH, and DELETE HTTP verbs for seamless integration.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. requireRoles(UserRole.DRIVER) - Enforces global DRIVER role on req.user.roles.
 * 3. validateRideIdParam - Validates rideId parameter as a well-formed UUID.
 * 4. RideController.cancelRide - Enforces ownership, checks status transitions, and executes atomic cancellation.
 */
rideRouter.post(
  '/:rideId/cancel',
  authenticate,
  requireRoles(UserRole.DRIVER),
  validateRideIdParam,
  RideController.cancelRide
);

rideRouter.patch(
  '/:rideId/cancel',
  authenticate,
  requireRoles(UserRole.DRIVER),
  validateRideIdParam,
  RideController.cancelRide
);

rideRouter.delete(
  '/:rideId',
  authenticate,
  requireRoles(UserRole.DRIVER),
  validateRideIdParam,
  RideController.cancelRide
);

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
