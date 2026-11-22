import { describe, it, expect, vi, afterEach } from 'vitest';
import { prisma } from '../../src/config/prisma.js';
import { vehicleService } from '../../src/services/vehicle.service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../src/utils/errors.js';
import type { CreateVehicleInput } from '../../src/validators/vehicleValidator.js';

describe('Vehicle Service - Unit Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validDriverId = '11111111-2222-3333-4444-555555555555';
  const otherDriverId = '99999999-0000-0000-0000-000000000000';
  const mockVehicleId = '88888888-7777-6666-5555-444444444444';
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

  describe('Vehicle Creation (M5.3)', () => {
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
          select: expect.any(Object),
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

  describe('Vehicle Listing (M5.5: listVehicles)', () => {
    it('1. should retrieve all vehicles for a driver with multiple vehicles and default pagination', async () => {
      const mockVehicles = [
        createMockDbVehicle({ vehicleId: 'v1', make: 'Toyota', model: 'Innova' }),
        createMockDbVehicle({ vehicleId: 'v2', make: 'Honda', model: 'City' }),
      ];

      vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(2);
      vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce(mockVehicles as any);

      const result = await vehicleService.listVehicles(validDriverId);

      expect(result.vehicles).toHaveLength(2);
      expect(result.vehicles[0].vehicleId).toBe('v1');
      expect(result.vehicles[1].vehicleId).toBe('v2');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('2. should return empty list and zero counts when driver has no registered vehicles', async () => {
      vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(0);
      vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce([]);

      const result = await vehicleService.listVehicles(validDriverId);

      expect(result.vehicles).toEqual([]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('3. should ensure only vehicles belonging to the specified driverId are queried', async () => {
      const countSpy = vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(0);
      const findManySpy = vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce([]);

      await vehicleService.listVehicles(validDriverId);

      expect(countSpy).toHaveBeenCalledWith({
        where: { driverId: validDriverId },
      });
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { driverId: validDriverId },
        })
      );
    });

    it('4. should return both active and inactive vehicles by default for driver fleet view', async () => {
      const mockFleet = [
        createMockDbVehicle({ vehicleId: 'v1', isActive: true }),
        createMockDbVehicle({ vehicleId: 'v2', isActive: false }),
      ];

      vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(2);
      const findManySpy = vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce(mockFleet as any);

      const result = await vehicleService.listVehicles(validDriverId);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { driverId: validDriverId },
        })
      );
      expect(result.vehicles).toHaveLength(2);
      expect(result.vehicles[0].isActive).toBe(true);
      expect(result.vehicles[1].isActive).toBe(false);
    });

    it('5. should filter for active-only vehicles when includeInactive is false', async () => {
      const countSpy = vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(1);
      const findManySpy = vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce([
        createMockDbVehicle({ vehicleId: 'v1', isActive: true }),
      ] as any);

      await vehicleService.listVehicles(validDriverId, { includeInactive: false });

      expect(countSpy).toHaveBeenCalledWith({
        where: { driverId: validDriverId, isActive: true },
      });
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { driverId: validDriverId, isActive: true },
        })
      );
    });

    it('6. should filter for active-only vehicles when isActive is explicitly true', async () => {
      const countSpy = vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(1);
      const findManySpy = vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce([
        createMockDbVehicle({ vehicleId: 'v1', isActive: true }),
      ] as any);

      await vehicleService.listVehicles(validDriverId, { isActive: true });

      expect(countSpy).toHaveBeenCalledWith({
        where: { driverId: validDriverId, isActive: true },
      });
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { driverId: validDriverId, isActive: true },
        })
      );
    });

    it('7. should filter for inactive-only vehicles when isActive is explicitly false', async () => {
      const countSpy = vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(1);
      const findManySpy = vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce([
        createMockDbVehicle({ vehicleId: 'v2', isActive: false }),
      ] as any);

      await vehicleService.listVehicles(validDriverId, { isActive: false });

      expect(countSpy).toHaveBeenCalledWith({
        where: { driverId: validDriverId, isActive: false },
      });
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { driverId: validDriverId, isActive: false },
        })
      );
    });

    it('8. should calculate pagination skip and take accurately when custom page and limit are provided', async () => {
      vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(25);
      const findManySpy = vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce([
        createMockDbVehicle({ vehicleId: 'v6' }),
      ] as any);

      const result = await vehicleService.listVehicles(validDriverId, { page: 2, limit: 5 });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 25,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('9. should accurately calculate hasNext=false on the last page', async () => {
      vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(10);
      vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce([
        createMockDbVehicle({ vehicleId: 'v10' }),
      ] as any);

      const result = await vehicleService.listVehicles(validDriverId, { page: 2, limit: 5 });

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('10. should propagate database error when prisma.vehicle.count fails', async () => {
      vi.spyOn(prisma.vehicle, 'count').mockRejectedValueOnce(
        new Error('Database timeout on count')
      );
      vi.spyOn(prisma.vehicle, 'findMany').mockResolvedValueOnce([]);

      await expect(vehicleService.listVehicles(validDriverId)).rejects.toThrow(
        'Database timeout on count'
      );
    });

    it('11. should propagate database error when prisma.vehicle.findMany fails', async () => {
      vi.spyOn(prisma.vehicle, 'count').mockResolvedValueOnce(5);
      vi.spyOn(prisma.vehicle, 'findMany').mockRejectedValueOnce(
        new Error('Query execution failure on findMany')
      );

      await expect(vehicleService.listVehicles(validDriverId)).rejects.toThrow(
        'Query execution failure on findMany'
      );
    });
  });

  describe('Vehicle Individual Retrieval (M5.5: getVehicleById)', () => {
    it('1. should successfully retrieve an owned vehicle by vehicleId and driverId', async () => {
      const mockVehicle = createMockDbVehicle({
        vehicleId: mockVehicleId,
        driverId: validDriverId,
      });

      const findFirstSpy = vi
        .spyOn(prisma.vehicle, 'findFirst')
        .mockResolvedValueOnce(mockVehicle as any);

      const result = await vehicleService.getVehicleById(validDriverId, mockVehicleId);

      expect(result).toEqual(mockVehicle);
      expect(findFirstSpy).toHaveBeenCalledWith({
        where: {
          vehicleId: mockVehicleId,
          driverId: validDriverId,
        },
        select: expect.any(Object),
      });
    });

    it('2. should throw NotFoundError when vehicle does not exist in the database', async () => {
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(null);

      await expect(
        vehicleService.getVehicleById(validDriverId, 'nonexistent-uuid')
      ).rejects.toThrow(NotFoundError);
    });

    it('3. should reject access and throw NotFoundError when vehicle belongs to another driver (Zero-Knowledge Privacy)', async () => {
      // Driver A tries to retrieve Driver B's vehicle
      // Database query filters by both vehicleId AND requesting driverId, returning null
      vi.spyOn(prisma.vehicle, 'findFirst').mockResolvedValueOnce(null);

      await expect(
        vehicleService.getVehicleById(otherDriverId, mockVehicleId)
      ).rejects.toThrow(NotFoundError);
    });

    it('4. should include both vehicleId and driverId in the Prisma query where clause', async () => {
      const findFirstSpy = vi
        .spyOn(prisma.vehicle, 'findFirst')
        .mockResolvedValueOnce(createMockDbVehicle() as any);

      await vehicleService.getVehicleById(validDriverId, mockVehicleId);

      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            vehicleId: mockVehicleId,
            driverId: validDriverId,
          },
        })
      );
    });

    it('5. should safely project only vehicle fields and verify select projection in query', async () => {
      const findFirstSpy = vi
        .spyOn(prisma.vehicle, 'findFirst')
        .mockResolvedValueOnce(createMockDbVehicle({ vehicleId: mockVehicleId }) as any);

      const result = await vehicleService.getVehicleById(validDriverId, mockVehicleId);

      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
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
        })
      );
      expect(result.vehicleId).toBe(mockVehicleId);
      expect(result.driverId).toBe(validDriverId);
    });

    it('6. should propagate unexpected database errors when prisma.vehicle.findFirst fails', async () => {
      vi.spyOn(prisma.vehicle, 'findFirst').mockRejectedValueOnce(
        new Error('PostgreSQL connection dropped')
      );

      await expect(
        vehicleService.getVehicleById(validDriverId, mockVehicleId)
      ).rejects.toThrow('PostgreSQL connection dropped');
    });
  });
});
