import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import { vehicleService } from '../../src/services/vehicle.service.js';
import { VehicleController } from '../../src/controllers/vehicle.controller.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../src/utils/errors.js';
import type { Request, Response, NextFunction } from 'express';

const mockDriverId = '11111111-2222-3333-4444-555555555555';
const mockUserId = '22222222-3333-4444-5555-666666666666';
const mockTimestamp = new Date('2026-11-22T12:00:00.000Z');

const mockDriverDbUser = {
  userId: mockDriverId,
  name: 'Rohan Sharma',
  email: 'rohan.driver@rydora.in',
  phone: '+919876543210',
  roles: ['DRIVER'],
  profileImage: null,
  licenseNumber: 'DL-04-2022-0012345',
  licenseExpiry: new Date('2030-01-01T00:00:00.000Z'),
  driverVerified: true,
  walletBalance: '0.00',
  averageRating: '5.00',
  ratingCount: 10,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

const mockPassengerDbUser = {
  userId: mockUserId,
  name: 'Aarav Patel',
  email: 'aarav.patel@rydora.in',
  phone: '+919123456789',
  roles: ['USER'],
  profileImage: null,
  licenseNumber: null,
  licenseExpiry: null,
  driverVerified: false,
  walletBalance: '0.00',
  averageRating: '0.00',
  ratingCount: 0,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

function generateValidToken(userId: string = mockDriverId): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
}

describe('Vehicle Controller & API Route Test Suite (M5.4: POST /api/v1/vehicles)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validVehiclePayload = {
    vehicleType: 'SEDAN',
    make: 'Honda',
    model: 'City',
    registrationNumber: 'DL01AB1234',
    seatCapacity: 4,
    color: 'White',
  };

  const mockCreatedVehicle = {
    vehicleId: '99999999-8888-7777-6666-555555555555',
    driverId: mockDriverId,
    vehicleType: 'SEDAN',
    make: 'Honda',
    model: 'City',
    registrationNumber: 'DL01AB1234',
    color: 'White',
    seatCapacity: 4,
    isActive: true,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockListResult = {
    vehicles: [mockCreatedVehicle],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  describe('1. Authentication & RBAC Authorization', () => {
    it('should reject unauthenticated request when Authorization header is missing (401)', async () => {
      const res = await request(app)
        .post('/api/v1/vehicles')
        .send(validVehiclePayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/authorization header is required/i);
    });

    it('should reject unauthenticated request when token is invalid or malformed (401)', async () => {
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', 'Bearer invalid-token-value')
        .send(validVehiclePayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject unauthenticated request when token is expired (401)', async () => {
      const expiredToken = jwt.sign({ sub: mockDriverId }, env.JWT_SECRET, {
        expiresIn: '-1s',
      });

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/expired/i);
    });

    it('should reject authenticated user who only has the USER role (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockPassengerDbUser as any);
      const serviceSpy = vi.spyOn(vehicleService, 'createVehicle');

      const token = generateValidToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/insufficient permissions/i);
      expect(serviceSpy).not.toHaveBeenCalled();
    });

    it('should reject authenticated user when roles array is empty (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockPassengerDbUser,
        roles: [],
      } as any);
      const serviceSpy = vi.spyOn(vehicleService, 'createVehicle');

      const token = generateValidToken(mockUserId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(serviceSpy).not.toHaveBeenCalled();
    });

    it('should allow authenticated user with DRIVER role to proceed', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'createVehicle').mockResolvedValueOnce(mockCreatedVehicle);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should allow authenticated user with multiple roles including DRIVER (e.g. USER and DRIVER)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        ...mockDriverDbUser,
        roles: ['USER', 'DRIVER'],
      } as any);
      vi.spyOn(vehicleService, 'createVehicle').mockResolvedValueOnce(mockCreatedVehicle);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should extract driverId strictly from authenticated token context, never from body', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      const serviceSpy = vi
        .spyOn(vehicleService, 'createVehicle')
        .mockResolvedValueOnce(mockCreatedVehicle);

      const token = generateValidToken(mockDriverId);
      await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(serviceSpy).toHaveBeenCalledWith(mockDriverId, expect.anything());
    });
  });

  describe('2. Request Body Validation', () => {
    it('should reject when vehicleType is missing (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      const { vehicleType, ...payloadWithoutType } = validVehiclePayload;

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(payloadWithoutType);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'vehicleType' }),
        ])
      );
    });

    it('should reject when vehicleType is not an allowed enum category (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validVehiclePayload, vehicleType: 'SPORTS_CAR' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject when make is missing or empty string (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validVehiclePayload, make: '   ' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'make' })])
      );
    });

    it('should reject when model is missing or empty string (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validVehiclePayload, model: '' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'model' })])
      );
    });

    it('should reject when registrationNumber is missing or empty string (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validVehiclePayload, registrationNumber: '' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'registrationNumber' }),
        ])
      );
    });

    it('should reject invalid seatCapacity below 1 or above 8 (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const resLow = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validVehiclePayload, seatCapacity: 0 });

      expect(resLow.status).toBe(422);

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      const resHigh = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validVehiclePayload, seatCapacity: 9 });

      expect(resHigh.status).toBe(422);
    });

    it('should reject non-integer seatCapacity (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validVehiclePayload, seatCapacity: 4.5 });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject unexpected extra fields due to strict schema mode (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validVehiclePayload,
          unrecognizedField: 'malicious-data',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject client-supplied driverId in request body (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validVehiclePayload,
          driverId: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });

  describe('3. Successful Creation & Response Format', () => {
    it('should return HTTP 201 with standard success envelope for valid request', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'createVehicle').mockResolvedValueOnce(mockCreatedVehicle);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.message).toMatch(/vehicle registered successfully/i);
      expect(res.body.data.vehicle).toBeDefined();
      expect(res.body.data.vehicle.vehicleId).toBe(mockCreatedVehicle.vehicleId);
      expect(res.body.data.vehicle.driverId).toBe(mockDriverId);
      expect(res.body.data.vehicle.make).toBe('Honda');
      expect(res.body.data.vehicle.model).toBe('City');
      expect(res.body.data.vehicle.registrationNumber).toBe('DL01AB1234');
      expect(res.body.data.vehicle.seatCapacity).toBe(4);
      expect(res.body.data.vehicle.isActive).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.requestId).toBeDefined();
      expect(res.body.meta.timestamp).toBeDefined();
    });

    it('should pass sanitized and normalized data to vehicleService.createVehicle', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      const serviceSpy = vi
        .spyOn(vehicleService, 'createVehicle')
        .mockResolvedValueOnce(mockCreatedVehicle);

      const token = generateValidToken(mockDriverId);
      await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vehicleType: 'sedan',
          make: '  Honda  ',
          model: '  City  ',
          registrationNumber: '  dl01ab1234  ',
          seatCapacity: 4,
          color: '  White  ',
        });

      expect(serviceSpy).toHaveBeenCalledWith(mockDriverId, {
        vehicleType: 'SEDAN',
        make: 'Honda',
        model: 'City',
        registrationNumber: 'DL01AB1234',
        seatCapacity: 4,
        color: 'White',
      });
    });

    it('should handle optional color when omitted or null', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'createVehicle').mockResolvedValueOnce({
        ...mockCreatedVehicle,
        color: null,
      });

      const { color, ...payloadWithoutColor } = validVehiclePayload;
      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(payloadWithoutColor);

      expect(res.status).toBe(201);
      expect(res.body.data.vehicle.color).toBeNull();
    });
  });

  describe('4. Error Handling & Forwarding', () => {
    it('should return HTTP 409 Conflict when registration number already exists', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'createVehicle').mockRejectedValueOnce(
        new ConflictError('A vehicle with this registration number already exists', [
          { field: 'registrationNumber', message: 'Already exists' },
        ])
      );

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/already exists/i);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'registrationNumber',
            message: 'Already exists',
          }),
        ])
      );
    });

    it('should return HTTP 404 Not Found when driver is not found in database', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'createVehicle').mockRejectedValueOnce(
        new NotFoundError('Driver not found')
      );

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return HTTP 403 Forbidden when service rejects due to missing DRIVER role', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'createVehicle').mockRejectedValueOnce(
        new ForbiddenError('Forbidden: Must have the DRIVER role to register a vehicle')
      );

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should forward unexpected server errors to centralized error handler (500)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'createVehicle').mockRejectedValueOnce(
        new Error('Unexpected database failure')
      );

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(validVehiclePayload);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('5. Direct Controller Isolation Unit Tests', () => {
    it('should throw UnauthorizedError when req.user is undefined in direct invocation', async () => {
      const mockReq = {
        body: validVehiclePayload,
      } as Request;

      const mockRes = {} as Response;
      const mockNext = vi.fn() as NextFunction;

      await VehicleController.createVehicle(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should pass service errors directly to next() in controller execution', async () => {
      const mockReq = {
        user: { userId: mockDriverId },
        body: validVehiclePayload,
      } as unknown as Request;

      const mockRes = {} as Response;
      const mockNext = vi.fn() as NextFunction;

      const testError = new Error('Service crash');
      vi.spyOn(vehicleService, 'createVehicle').mockRejectedValueOnce(testError);

      await VehicleController.createVehicle(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should throw UnauthorizedError when req.user is undefined in listVehicles', async () => {
      const mockReq = { query: {} } as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn() as NextFunction;

      await VehicleController.listVehicles(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should forward service errors to next() in listVehicles', async () => {
      const mockReq = {
        user: { userId: mockDriverId },
        query: {},
      } as unknown as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn() as NextFunction;

      const testError = new Error('Service failure');
      vi.spyOn(vehicleService, 'listVehicles').mockRejectedValueOnce(testError);

      await VehicleController.listVehicles(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should throw UnauthorizedError when req.user is undefined in getVehicleById', async () => {
      const mockReq = { params: { vehicleId: '88888888-7777-6666-5555-444444444444' } } as unknown as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn() as NextFunction;

      await VehicleController.getVehicleById(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should forward service errors to next() in getVehicleById', async () => {
      const mockReq = {
        user: { userId: mockDriverId },
        params: { vehicleId: '88888888-7777-6666-5555-444444444444' },
      } as unknown as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn() as NextFunction;

      const testError = new Error('Service failure');
      vi.spyOn(vehicleService, 'getVehicleById').mockRejectedValueOnce(testError);

      await VehicleController.getVehicleById(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(testError);
    });
  });

  describe('6. Vehicle Listing API Route (M5.6: GET /api/v1/vehicles/me)', () => {
    it('should reject unauthenticated request when Authorization header is missing (401)', async () => {
      const res = await request(app).get('/api/v1/vehicles/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject authenticated user who only has USER role (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockPassengerDbUser as any);
      const serviceSpy = vi.spyOn(vehicleService, 'listVehicles');

      const token = generateValidToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/vehicles/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(serviceSpy).not.toHaveBeenCalled();
    });

    it('should allow authenticated DRIVER and return HTTP 200 with paginated vehicles', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'listVehicles').mockResolvedValueOnce(mockListResult);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/vehicles/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.message).toMatch(/vehicles retrieved successfully/i);
      expect(res.body.data.vehicles).toHaveLength(1);
      expect(res.body.data.vehicles[0].vehicleId).toBe(mockCreatedVehicle.vehicleId);
      expect(res.body.meta.pagination).toEqual(mockListResult.pagination);
    });

    it('should extract driverId exclusively from token and reject client-supplied driverId in query (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/vehicles/me?driverId=spoofed-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should reject invalid page or limit query parameters (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/vehicles/me?page=0&limit=150')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should support pagination and lifecycle filter queries', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      const serviceSpy = vi
        .spyOn(vehicleService, 'listVehicles')
        .mockResolvedValueOnce(mockListResult);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/vehicles/me?page=2&limit=10&isActive=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(serviceSpy).toHaveBeenCalledWith(mockDriverId, {
        page: 2,
        limit: 10,
        isActive: true,
      });
    });

    it('should forward unexpected service errors to error handler (500)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'listVehicles').mockRejectedValueOnce(
        new Error('Database connectivity failure')
      );

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/vehicles/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('7. Vehicle Detail Retrieval API Route (M5.6: GET /api/v1/vehicles/:vehicleId)', () => {
    const validVehicleId = '88888888-7777-6666-5555-444444444444';

    it('should reject unauthenticated request when Authorization header is missing (401)', async () => {
      const res = await request(app).get(`/api/v1/vehicles/${validVehicleId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject authenticated user who only has USER role (403 Forbidden)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockPassengerDbUser as any);
      const serviceSpy = vi.spyOn(vehicleService, 'getVehicleById');

      const token = generateValidToken(mockUserId);
      const res = await request(app)
        .get(`/api/v1/vehicles/${validVehicleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(serviceSpy).not.toHaveBeenCalled();
    });

    it('should allow authenticated DRIVER to retrieve owned vehicle (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'getVehicleById').mockResolvedValueOnce(mockCreatedVehicle);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/vehicles/${validVehicleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.message).toMatch(/vehicle retrieved successfully/i);
      expect(res.body.data.vehicle).toEqual(
        expect.objectContaining({
          vehicleId: mockCreatedVehicle.vehicleId,
          driverId: mockDriverId,
        })
      );
    });

    it('should reject malformed or non-UUID vehicleId route parameter (422)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/vehicles/not-a-valid-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should return HTTP 404 when vehicle does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'getVehicleById').mockRejectedValueOnce(
        new NotFoundError('Vehicle not found')
      );

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/vehicles/${validVehicleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return HTTP 404 when vehicle belongs to another driver (Zero-Knowledge Privacy)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'getVehicleById').mockRejectedValueOnce(
        new NotFoundError('Vehicle not found')
      );

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/vehicles/${validVehicleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should ensure /me route is handled by listVehicles and not matched by :vehicleId', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      const listSpy = vi
        .spyOn(vehicleService, 'listVehicles')
        .mockResolvedValueOnce(mockListResult);
      const detailSpy = vi.spyOn(vehicleService, 'getVehicleById');

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get('/api/v1/vehicles/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(listSpy).toHaveBeenCalledTimes(1);
      expect(detailSpy).not.toHaveBeenCalled();
    });

    it('should forward unexpected service errors to error handler (500)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
      vi.spyOn(vehicleService, 'getVehicleById').mockRejectedValueOnce(
        new Error('Unexpected DB timeout')
      );

      const token = generateValidToken(mockDriverId);
      const res = await request(app)
        .get(`/api/v1/vehicles/${validVehicleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('Vehicle Update API (M5.8: PATCH /api/v1/vehicles/:vehicleId)', () => {
    const validVehicleId = '88888888-7777-6666-5555-444444444444';

    describe('1. Authentication & RBAC Authorization', () => {
      it('should reject unauthenticated request when Authorization header is missing (401)', async () => {
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .send({ make: 'Honda' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject request when user does not have DRIVER role (403)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockPassengerDbUser as any);

        const token = generateValidToken(mockUserId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda' });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('2. Parameter & Request Body Validation', () => {
      it('should reject malformed or non-UUID vehicleId route parameter (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch('/api/v1/vehicles/not-a-valid-uuid')
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should reject empty update payload body (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should reject attempts to update registrationNumber (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ registrationNumber: 'DL99ZZ9999' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should reject attempts to update vehicleType (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ vehicleType: 'SUV' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should reject attempts to update seatCapacity (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ seatCapacity: 7 });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should reject client attempts to inject driverId in request body (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda', driverId: 'spoofed-driver-id' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should reject client attempts to inject vehicleId in request body (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda', vehicleId: '11111111-2222-3333-4444-555555555555' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should reject arbitrary unknown fields due to strict schema (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda', unexpectedProperty: 'bad' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should reject invalid field types (422)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ isActive: 'not-a-boolean' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      });
    });

    describe('3. Successful Vehicle Updates (200 OK)', () => {
      it('should update vehicle make and model successfully', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const updatedVehicleData = {
          ...mockCreatedVehicle,
          make: 'Toyota',
          model: 'Corolla',
        };

        const updateSpy = vi
          .spyOn(vehicleService, 'updateVehicle')
          .mockResolvedValueOnce(updatedVehicleData);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Toyota', model: 'Corolla' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.statusCode).toBe(200);
        expect(res.body.message).toMatch(/vehicle updated successfully/i);
        expect(res.body.data.vehicle.make).toBe('Toyota');
        expect(res.body.data.vehicle.model).toBe('Corolla');

        expect(updateSpy).toHaveBeenCalledWith(
          mockDriverId,
          validVehicleId,
          expect.objectContaining({ make: 'Toyota', model: 'Corolla' })
        );
      });

      it('should deactivate vehicle by setting isActive to false', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const deactivatedVehicle = {
          ...mockCreatedVehicle,
          isActive: false,
        };

        const updateSpy = vi
          .spyOn(vehicleService, 'updateVehicle')
          .mockResolvedValueOnce(deactivatedVehicle);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ isActive: false });

        expect(res.status).toBe(200);
        expect(res.body.data.vehicle.isActive).toBe(false);
        expect(updateSpy).toHaveBeenCalledWith(
          mockDriverId,
          validVehicleId,
          expect.objectContaining({ isActive: false })
        );
      });

      it('should reactivate vehicle by setting isActive to true', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const reactivatedVehicle = {
          ...mockCreatedVehicle,
          isActive: true,
        };

        vi.spyOn(vehicleService, 'updateVehicle').mockResolvedValueOnce(reactivatedVehicle);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ isActive: true });

        expect(res.status).toBe(200);
        expect(res.body.data.vehicle.isActive).toBe(true);
      });

      it('should update color to null when color is explicitly null (200 OK)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const nullColorVehicle = {
          ...mockCreatedVehicle,
          color: null,
        };

        const updateSpy = vi
          .spyOn(vehicleService, 'updateVehicle')
          .mockResolvedValueOnce(nullColorVehicle);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ color: null });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.vehicle.color).toBeNull();
        expect(updateSpy).toHaveBeenCalledWith(
          mockDriverId,
          validVehicleId,
          expect.objectContaining({ color: null })
        );
      });

      it('should normalize whitespace-only color string to null and update successfully (200 OK)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);

        const nullColorVehicle = {
          ...mockCreatedVehicle,
          color: null,
        };

        const updateSpy = vi
          .spyOn(vehicleService, 'updateVehicle')
          .mockResolvedValueOnce(nullColorVehicle);

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ color: '   ' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.vehicle.color).toBeNull();
        expect(updateSpy).toHaveBeenCalledWith(
          mockDriverId,
          validVehicleId,
          expect.objectContaining({ color: null })
        );
      });
    });

    describe('4. Ownership & Zero-Knowledge Privacy (404 Not Found)', () => {
      it('should return 404 when vehicle does not exist', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
        vi.spyOn(vehicleService, 'updateVehicle').mockRejectedValueOnce(
          new NotFoundError('Vehicle not found')
        );

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda' });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 404 when vehicle belongs to another driver (Zero-Knowledge Privacy)', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
        vi.spyOn(vehicleService, 'updateVehicle').mockRejectedValueOnce(
          new NotFoundError('Vehicle not found')
        );

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda' });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('5. Error Handling & Controller Unit Invariants', () => {
      it('should return 400 when service throws BadRequestError', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
        vi.spyOn(vehicleService, 'updateVehicle').mockRejectedValueOnce(
          new (await import('../../src/utils/errors.js')).BadRequestError(
            'At least one field must be provided for update'
          )
        );

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('BAD_REQUEST');
      });

      it('should return 500 when unexpected service error occurs', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockDriverDbUser as any);
        vi.spyOn(vehicleService, 'updateVehicle').mockRejectedValueOnce(
          new Error('Database deadlock on update')
        );

        const token = generateValidToken(mockDriverId);
        const res = await request(app)
          .patch(`/api/v1/vehicles/${validVehicleId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ make: 'Honda' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      });

      it('should throw UnauthorizedError when req.user is missing in direct controller invocation', async () => {
        const req = {
          params: { vehicleId: validVehicleId },
          body: { make: 'Honda' },
        } as unknown as Request;
        const res = {} as Response;
        const next = vi.fn() as NextFunction;

        await VehicleController.updateVehicle(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      });
    });
  });
});
