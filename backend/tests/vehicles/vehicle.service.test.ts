import { describe, it, expect, vi, afterEach } from 'vitest';
import { prisma } from '../../src/config/prisma.js';
import { vehicleService } from '../../src/services/vehicle.service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../src/utils/errors.js';
import type { CreateVehicleInput } from '../../src/validators/vehicleValidator.js';

describe('Vehicle Service - Creation (M5.3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validDriverId = '11111111-2222-3333-4444-555555555555';
  const mockDate = new Date('2026-11-22T10:00:00.000Z');

  const validVehicleInput: CreateVehicleInput = {
    vehicleType: 'SEDAN',
    make: 'Toyota',
    model: 'Camry',
    registrationNumber: 'DL01AB1234',
    seatCapacity: 4,
    color: 'Silver',
  };

  const createMockDbVehicle = (overrides = {}) => ({
    vehicleId: '99999999-8888-7777-6666-555555555555',
    driverId: validDriverId,
    vehicleType: 'SEDAN',
    make: 'Toyota',
    model: 'Camry',
    registrationNumber: 'DL01AB1234',
    color: 'Silver',
    seatCapacity: 4,
    isActive: true,
    createdAt: mockDate,
    updatedAt: mockDate,
    ...overrides,
  });

  describe('1. Driver Verification', () => {
    it('should verify driver exists and allow creation when user has DRIVER role', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce(null);
      const createSpy = vi
        .spyOn(prisma.vehicle, 'create')
        .mockResolvedValueOnce(createMockDbVehicle() as any);

      const result = await vehicleService.createVehicle(validDriverId, validVehicleInput);

      expect(result).toBeDefined();
      expect(result.driverId).toBe(validDriverId);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when driver does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);
      const vehicleFindSpy = vi.spyOn(prisma.vehicle, 'findUnique');
      const createSpy = vi.spyOn(prisma.vehicle, 'create');

      await expect(
        vehicleService.createVehicle(validDriverId, validVehicleInput)
      ).rejects.toThrow(NotFoundError);

      expect(vehicleFindSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user exists but has only USER role', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['USER'],
      } as any);

      const createSpy = vi.spyOn(prisma.vehicle, 'create');

      await expect(
        vehicleService.createVehicle(validDriverId, validVehicleInput)
      ).rejects.toThrow(ForbiddenError);

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user roles array is empty', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: [],
      } as any);

      const createSpy = vi.spyOn(prisma.vehicle, 'create');

      await expect(
        vehicleService.createVehicle(validDriverId, validVehicleInput)
      ).rejects.toThrow(ForbiddenError);

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should accept a user with multiple roles including DRIVER', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['USER', 'DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce(null);
      vi.spyOn(prisma.vehicle, 'create').mockResolvedValueOnce(createMockDbVehicle() as any);

      const result = await vehicleService.createVehicle(validDriverId, validVehicleInput);
      expect(result.vehicleId).toBe('99999999-8888-7777-6666-555555555555');
    });
  });

  describe('2. Duplicate Registration Verification', () => {
    it('should throw ConflictError when registration number already exists', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce({
        vehicleId: 'existing-vehicle-id',
      } as any);

      const createSpy = vi.spyOn(prisma.vehicle, 'create');

      await expect(
        vehicleService.createVehicle(validDriverId, validVehicleInput)
      ).rejects.toThrow(ConflictError);

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should normalize registration number with trim and uppercase before checking duplicates', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      const vehicleFindSpy = vi
        .spyOn(prisma.vehicle, 'findUnique')
        .mockResolvedValueOnce(null);

      vi.spyOn(prisma.vehicle, 'create').mockResolvedValueOnce(createMockDbVehicle() as any);

      const unnormalizedInput: CreateVehicleInput = {
        ...validVehicleInput,
        registrationNumber: '  dl 01 ab 1234  ',
      };

      await vehicleService.createVehicle(validDriverId, unnormalizedInput);

      expect(vehicleFindSpy).toHaveBeenCalledWith({
        where: { registrationNumber: 'DL 01 AB 1234' },
        select: { vehicleId: true },
      });
    });

    it('should catch Prisma P2002 unique constraint race condition and throw ConflictError', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce(null);

      // Simulate race condition where concurrent insert occurs between findUnique and create
      const p2002Error = new Error('Unique constraint failed on the fields: (`registration_number`)');
      (p2002Error as any).code = 'P2002';
      (p2002Error as any).meta = { target: ['registration_number'] };

      vi.spyOn(prisma.vehicle, 'create').mockRejectedValueOnce(p2002Error);

      await expect(
        vehicleService.createVehicle(validDriverId, validVehicleInput)
      ).rejects.toThrow(ConflictError);
    });

    it('should re-throw unrelated Prisma errors without converting to ConflictError', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce(null);

      const connectionError = new Error('Database connection lost');
      vi.spyOn(prisma.vehicle, 'create').mockRejectedValueOnce(connectionError);

      await expect(
        vehicleService.createVehicle(validDriverId, validVehicleInput)
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('3. Successful Vehicle Creation & Ownership Assignment', () => {
    it('should successfully create a vehicle for a valid DRIVER and assign ownership', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce(null);

      const createSpy = vi
        .spyOn(prisma.vehicle, 'create')
        .mockResolvedValueOnce(createMockDbVehicle() as any);

      const result = await vehicleService.createVehicle(validDriverId, validVehicleInput);

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          driverId: validDriverId,
          vehicleType: 'SEDAN',
          make: 'Toyota',
          model: 'Camry',
          registrationNumber: 'DL01AB1234',
          seatCapacity: 4,
          color: 'Silver',
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

      expect(result).toEqual({
        vehicleId: '99999999-8888-7777-6666-555555555555',
        driverId: validDriverId,
        vehicleType: 'SEDAN',
        make: 'Toyota',
        model: 'Camry',
        registrationNumber: 'DL01AB1234',
        color: 'Silver',
        seatCapacity: 4,
        isActive: true,
        createdAt: mockDate,
        updatedAt: mockDate,
      });
    });

    it('should handle optional color when omitted or null', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce(null);

      const createSpy = vi
        .spyOn(prisma.vehicle, 'create')
        .mockResolvedValueOnce(createMockDbVehicle({ color: null }) as any);

      const inputWithoutColor: CreateVehicleInput = {
        vehicleType: 'BIKE',
        make: 'Royal Enfield',
        model: 'Hunter 350',
        registrationNumber: 'TN09CD5678',
        seatCapacity: 1,
      };

      const result = await vehicleService.createVehicle(validDriverId, inputWithoutColor);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            color: null,
          }),
        })
      );
      expect(result.color).toBeNull();
    });

    it('should not pass database-managed fields (vehicleId, isActive, timestamps) in create data', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce(null);

      const createSpy = vi
        .spyOn(prisma.vehicle, 'create')
        .mockResolvedValueOnce(createMockDbVehicle() as any);

      await vehicleService.createVehicle(validDriverId, validVehicleInput);

      const passedData = createSpy.mock.calls[0][0].data;
      expect(passedData).not.toHaveProperty('vehicleId');
      expect(passedData).not.toHaveProperty('isActive');
      expect(passedData).not.toHaveProperty('createdAt');
      expect(passedData).not.toHaveProperty('updatedAt');
    });

    it('should strictly use driverId parameter and ignore any driverId from client payload', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce(null);

      const createSpy = vi
        .spyOn(prisma.vehicle, 'create')
        .mockResolvedValueOnce(createMockDbVehicle() as any);

      // Attempt to spoof ownership in payload
      const spoofedPayload: any = {
        ...validVehicleInput,
        driverId: 'forged-attacker-driver-id',
      };

      await vehicleService.createVehicle(validDriverId, spoofedPayload);

      const passedData = createSpy.mock.calls[0][0].data;
      expect(passedData.driverId).toBe(validDriverId);
      expect(passedData.driverId).not.toBe('forged-attacker-driver-id');
    });
  });

  describe('4. Failure Handling & Abort Guarantees', () => {
    it('should propagate Prisma user findUnique unexpected errors', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
        new Error('PostgreSQL connection timeout')
      );

      await expect(
        vehicleService.createVehicle(validDriverId, validVehicleInput)
      ).rejects.toThrow('PostgreSQL connection timeout');
    });

    it('should propagate Prisma vehicle findUnique unexpected errors', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockRejectedValueOnce(
        new Error('Index scan failure')
      );

      await expect(
        vehicleService.createVehicle(validDriverId, validVehicleInput)
      ).rejects.toThrow('Index scan failure');
    });

    it('should not call prisma.vehicle.create when driver verification fails', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);
      const createSpy = vi.spyOn(prisma.vehicle, 'create');

      try {
        await vehicleService.createVehicle(validDriverId, validVehicleInput);
      } catch {
        // Expected
      }

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should not call prisma.vehicle.create when duplicate registration is detected', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        userId: validDriverId,
        roles: ['DRIVER'],
      } as any);

      vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValueOnce({
        vehicleId: 'existing-id',
      } as any);

      const createSpy = vi.spyOn(prisma.vehicle, 'create');

      try {
        await vehicleService.createVehicle(validDriverId, validVehicleInput);
      } catch {
        // Expected
      }

      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
