import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { UserRole } from '../generated/prisma/client.js';
import { createVehicleSchema } from '../validators/vehicleValidator.js';
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
