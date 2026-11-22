import type { Request, Response, NextFunction } from 'express';
import {
  createVehicleSchema,
  vehicleQuerySchema,
  vehicleIdParamSchema,
  updateVehicleSchema,
} from '../validators/vehicleValidator.js';
import { vehicleService } from '../services/vehicle.service.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Controller handling vehicle registration (POST /api/v1/vehicles).
 * Obtains the driver identity strictly from authenticated req.user.userId.
 */
export async function createVehicle(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedData = createVehicleSchema.parse(req.body);
    const vehicle = await vehicleService.createVehicle(
      req.user.userId,
      validatedData
    );

    sendSuccess(res, { vehicle }, 'Vehicle registered successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling driver vehicle fleet listing (GET /api/v1/vehicles/me).
 * Obtains the driver identity strictly from authenticated req.user.userId.
 * Validates query parameters (page, limit, isActive, includeInactive).
 */
export async function listVehicles(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedQuery = vehicleQuerySchema.parse(req.query);
    const result = await vehicleService.listVehicles(
      req.user.userId,
      validatedQuery
    );

    sendSuccess(
      res,
      { vehicles: result.vehicles },
      'Vehicles retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling single vehicle retrieval (GET /api/v1/vehicles/:vehicleId).
 * Obtains the driver identity strictly from authenticated req.user.userId.
 * Validates vehicleId route parameter as a UUID.
 */
export async function getVehicleById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { vehicleId } = vehicleIdParamSchema.parse(req.params);
    const vehicle = await vehicleService.getVehicleById(
      req.user.userId,
      vehicleId
    );

    sendSuccess(res, { vehicle }, 'Vehicle retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export const VehicleController = {
  createVehicle,
  listVehicles,
  getVehicleById,
  updateVehicle,
};

/**
 * Controller handling vehicle updates (PATCH /api/v1/vehicles/:vehicleId).
 * Obtains the driver identity strictly from authenticated req.user.userId.
 * Validates vehicleId route parameter as a UUID and request body against updateVehicleSchema.
 */
export async function updateVehicle(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { vehicleId } = vehicleIdParamSchema.parse(req.params);
    const validatedData = updateVehicleSchema.parse(req.body);

    const vehicle = await vehicleService.updateVehicle(
      req.user.userId,
      vehicleId,
      validatedData
    );

    sendSuccess(res, { vehicle }, 'Vehicle updated successfully', 200);
  } catch (error) {
    next(error);
  }
}
