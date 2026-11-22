import type { Request, Response, NextFunction } from 'express';
import { createVehicleSchema } from '../validators/vehicleValidator.js';
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

export const VehicleController = {
  createVehicle,
};
