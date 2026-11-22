import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import type { CreateVehicleInput } from '../validators/vehicleValidator.js';
import type { PaginationMeta } from '../utils/response.js';

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

export interface VehicleListOptions {
  page?: number;
  limit?: number;
  isActive?: boolean;
  includeInactive?: boolean;
}

export interface PaginatedVehiclesResult {
  vehicles: VehicleOutput[];
  pagination: PaginationMeta;
}

/**
 * Standard Prisma selection projection for Vehicle entities.
 * Ensures consistent data shape while never exposing unrelated user or sensitive fields.
 */
const vehicleSelectProjection = {
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
} as const;

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
      select: vehicleSelectProjection,
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

/**
 * Retrieves a paginated list of vehicles belonging exclusively to the specified driver.
 *
 * Security & Architecture Rules:
 * 1. Strict Driver Isolation: Filters exclusively by `driverId`. A driver can never view another driver's fleet.
 * 2. Pagination Conventions: Calculates skip/take and returns standard PaginationMeta. Defaults to page 1, limit 20.
 * 3. Inactive Vehicle Handling: By default, returns all vehicles (both active and inactive) for the driver's private
 *    garage view. When `isActive` is explicitly supplied, or when `includeInactive === false`, filters accordingly.
 * 4. Safe Projection: Returns strictly `VehicleOutput` attributes, completely decoupled from Express HTTP objects.
 *
 * @param driverId UUID of the authenticated driver.
 * @param options Optional pagination parameters and lifecycle status filter.
 * @returns Paginated list of vehicles and pagination metadata.
 */
export async function listVehicles(
  driverId: string,
  options?: VehicleListOptions
): Promise<PaginatedVehiclesResult> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.VehicleWhereInput = {
    driverId,
  };

  // Inactive vehicle lifecycle handling:
  // - If isActive is explicitly boolean (true/false), filter by it.
  // - If includeInactive is false, filter for active-only.
  // - Otherwise (default), return all vehicles of this driver so they can manage inactive vehicles.
  if (options?.isActive !== undefined) {
    where.isActive = options.isActive;
  } else if (options?.includeInactive === false) {
    where.isActive = true;
  }

  const [total, records] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: vehicleSelectProjection,
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    vehicles: records,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
}

/**
 * Retrieves an individual vehicle belonging to the specified driver by its unique UUID.
 *
 * Security & Ownership Rules:
 * 1. Database-Level Ownership Verification: Queries using BOTH `vehicleId` and `driverId` atomically.
 * 2. Zero-Knowledge Privacy Policy: If a vehicle does not exist, OR exists but belongs to a different driver,
 *    returns `NotFoundError('Vehicle not found')`. This prevents resource enumeration and ID-probing attacks.
 * 3. Safe Projection: Returns strictly `VehicleOutput` attributes.
 *
 * @param driverId UUID of the authenticated driver.
 * @param vehicleId UUID of the target vehicle.
 * @returns Standardized VehicleOutput representation.
 */
export async function getVehicleById(
  driverId: string,
  vehicleId: string
): Promise<VehicleOutput> {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      vehicleId,
      driverId,
    },
    select: vehicleSelectProjection,
  });

  if (!vehicle) {
    throw new NotFoundError('Vehicle not found');
  }

  return vehicle;
}

export const vehicleService = {
  createVehicle,
  listVehicles,
  getVehicleById,
};
