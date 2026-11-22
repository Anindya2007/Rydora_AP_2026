import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  createVehicleSchema,
  vehicleIdParamSchema,
  updateVehicleSchema,
} from '../validators/vehicleValidator.js';
import { VehicleController } from '../controllers/vehicle.controller.js';

export const vehicleRouter = Router();

/**
 * Request body validation middleware for vehicle registration.
 * Parses req.body against createVehicleSchema and forwards ZodError to errorHandler.
 */
export const validateCreateVehicle = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = createVehicleSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Request parameter and body validation middleware for vehicle updates.
 * Parses req.params against vehicleIdParamSchema and req.body against updateVehicleSchema.
 */
export const validateUpdateVehicle = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    vehicleIdParamSchema.parse(req.params);
    req.body = updateVehicleSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/vehicles/me
 * Protected endpoint to list vehicles belonging to the authenticated DRIVER.
 * NOTE: Must be declared BEFORE /:vehicleId so Express does not match "me" as a vehicleId param.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. requireRoles(UserRole.DRIVER) - Enforces global DRIVER role on req.user.roles.
 * 3. VehicleController.listVehicles - Validates query parameters and returns paginated vehicle list.
 */
vehicleRouter.get(
  '/me',
  authenticate,
  requireRoles(UserRole.DRIVER),
  VehicleController.listVehicles
);

/**
 * GET /api/v1/vehicles/:vehicleId
 * Protected endpoint to retrieve an individual vehicle belonging to the authenticated DRIVER.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. requireRoles(UserRole.DRIVER) - Enforces global DRIVER role on req.user.roles.
 * 3. VehicleController.getVehicleById - Validates vehicleId UUID parameter and returns single vehicle.
 */
vehicleRouter.get(
  '/:vehicleId',
  authenticate,
  requireRoles(UserRole.DRIVER),
  VehicleController.getVehicleById
);

/**
 * POST /api/v1/vehicles
 * Protected endpoint to register a new vehicle for an authenticated DRIVER.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. requireRoles(UserRole.DRIVER) - Enforces global DRIVER role on req.user.roles.
 * 3. validateCreateVehicle - Validates and sanitizes request body using createVehicleSchema.
 * 4. VehicleController.createVehicle - Invokes vehicle creation service and returns 201 Created.
 */
vehicleRouter.post(
  '/',
  authenticate,
  requireRoles(UserRole.DRIVER),
  validateCreateVehicle,
  VehicleController.createVehicle
);

/**
 * PATCH /api/v1/vehicles/:vehicleId
 * Protected endpoint to update a vehicle belonging to the authenticated DRIVER.
 *
 * Security & Middleware Execution Sequence:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. requireRoles(UserRole.DRIVER) - Enforces global DRIVER role on req.user.roles.
 * 3. validateUpdateVehicle - Validates vehicleId parameter and update request body.
 * 4. VehicleController.updateVehicle - Invokes vehicle update service and returns 200 OK.
 */
vehicleRouter.patch(
  '/:vehicleId',
  authenticate,
  requireRoles(UserRole.DRIVER),
  validateUpdateVehicle,
  VehicleController.updateVehicle
);
