import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import type { CreateVehicleInput } from '../validators/vehicleValidator.js';

export interface VehicleOutput {
  vehicleId: string;
  driverId: string;
  vehicleType: string;
  make: string;
  model: string;
  registrationNumber: string;
  color: string | null;
  seatCapacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Registers a new vehicle belonging to the authenticated driver.
 *
 * Business Rules:
 * 1. Driver verification: The user must exist in the database and have the 'DRIVER' role.
 * 2. Duplicate registration verification: The registration number must be unique across the platform.
 * 3. Ownership assignment: The vehicle ownership (`driverId`) is strictly assigned by the backend.
 * 4. System fields: `isActive`, `createdAt`, `updatedAt` are governed by database defaults.
 *
 * @param driverId UUID of the authenticated driver.
 * @param input Validated vehicle registration payload.
 * @returns Standardized VehicleOutput representation.
 */
export async function createVehicle(
  driverId: string,
  input: CreateVehicleInput
): Promise<VehicleOutput> {
  // 1. Verify driver exists and holds the DRIVER role
  const driver = await prisma.user.findUnique({
    where: { userId: driverId },
    select: {
      userId: true,
      roles: true,
    },
  });

  if (!driver) {
    throw new NotFoundError('Driver not found');
  }

  const hasDriverRole = Array.isArray(driver.roles) && driver.roles.includes('DRIVER');
  if (!hasDriverRole) {
    throw new ForbiddenError('Forbidden: Must have the DRIVER role to register a vehicle');
  }

  // 2. Normalize registration number consistently (trimmed, uppercase)
  const normalizedRegistrationNumber = input.registrationNumber.trim().toUpperCase();

  // 3. Proactive uniqueness check against database
  const existingVehicle = await prisma.vehicle.findUnique({
    where: { registrationNumber: normalizedRegistrationNumber },
    select: { vehicleId: true },
  });

  if (existingVehicle) {
    throw new ConflictError('A vehicle with this registration number already exists', [
      { field: 'registrationNumber', message: 'Already exists' },
    ]);
  }

  // 4. Create vehicle with ownership assigned by the backend
  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        driverId,
        vehicleType: input.vehicleType,
        make: input.make.trim(),
        model: input.model.trim(),
        registrationNumber: normalizedRegistrationNumber,
        seatCapacity: input.seatCapacity,
        color: input.color ?? null,
      },
      select: {
        vehicleId: true,
        driverId: true,
        vehicleType: true,
        make: true,
        model: true,
        registrationNumber: true,
        color: true,
        seatCapacity: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return vehicle;
  } catch (error: any) {
    // 5. Reactive handling for race conditions on unique registration_number constraint
    if (error?.code === 'P2002') {
      throw new ConflictError('A vehicle with this registration number already exists', [
        { field: 'registrationNumber', message: 'Already exists' },
      ]);
    }
    throw error;
  }
}

export const vehicleService = {
  createVehicle,
};
