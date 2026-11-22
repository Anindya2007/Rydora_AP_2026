import { describe, it, expect } from 'vitest';
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleIdParamSchema,
  VEHICLE_TYPES,
} from '../../src/validators/vehicleValidator.js';

describe('Vehicle Request Validation Schemas (M5.2)', () => {
  const validCreationPayload = {
    vehicleType: 'SEDAN',
    make: 'Toyota',
    model: 'Camry',
    registrationNumber: 'DL01AB1234',
    seatCapacity: 4,
    color: 'Silver',
  };

  describe('1. Vehicle Creation Schema (createVehicleSchema)', () => {
    it('should validate a valid vehicle creation payload with all fields', () => {
      const result = createVehicleSchema.safeParse(validCreationPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vehicleType).toBe('SEDAN');
        expect(result.data.make).toBe('Toyota');
        expect(result.data.model).toBe('Camry');
        expect(result.data.registrationNumber).toBe('DL01AB1234');
        expect(result.data.seatCapacity).toBe(4);
        expect(result.data.color).toBe('Silver');
      }
    });

    it('should validate a valid vehicle creation payload without optional color', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { color, ...payloadWithoutColor } = validCreationPayload;
      const result = createVehicleSchema.safeParse(payloadWithoutColor);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBeUndefined();
      }
    });

    it('should normalize color to null when empty string or whitespace is provided', () => {
      const payload = { ...validCreationPayload, color: '   ' };
      const result = createVehicleSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBeNull();
      }
    });

    it('should accept null as a valid color', () => {
      const payload = { ...validCreationPayload, color: null };
      const result = createVehicleSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBeNull();
      }
    });

    it('should normalize lowercase vehicleType to uppercase', () => {
      const payload = { ...validCreationPayload, vehicleType: 'hatchback' };
      const result = createVehicleSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vehicleType).toBe('HATCHBACK');
      }
    });

    it('should normalize mixed-case and padded vehicleType to uppercase', () => {
      const payload = { ...validCreationPayload, vehicleType: '  sUv  ' };
      const result = createVehicleSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vehicleType).toBe('SUV');
      }
    });

    it('should accept all permitted vehicle types', () => {
      for (const vType of VEHICLE_TYPES) {
        const payload = { ...validCreationPayload, vehicleType: vType.toLowerCase() };
        const result = createVehicleSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.vehicleType).toBe(vType);
        }
      }
    });

    it('should reject invalid vehicle types', () => {
      const invalidTypes = ['PLANE', 'BOAT', 'SUBMARINE', 'HELICOPTER', ''];
      for (const vType of invalidTypes) {
        const payload = { ...validCreationPayload, vehicleType: vType };
        const result = createVehicleSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });

    it('should trim and uppercase registrationNumber', () => {
      const payload = { ...validCreationPayload, registrationNumber: '  dl 01 ab 1234  ' };
      const result = createVehicleSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.registrationNumber).toBe('DL 01 AB 1234');
      }
    });

    it('should reject missing required fields', () => {
      const requiredFields = ['vehicleType', 'make', 'model', 'registrationNumber', 'seatCapacity'];
      for (const field of requiredFields) {
        const payload: Record<string, any> = { ...validCreationPayload };
        delete payload[field];
        const result = createVehicleSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });

    it('should reject empty strings for required string fields', () => {
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, make: '   ' }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, model: '   ' }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, registrationNumber: '   ' }).success).toBe(false);
    });

    it('should reject string lengths exceeding maximum limits', () => {
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, make: 'a'.repeat(81) }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, model: 'b'.repeat(81) }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, registrationNumber: 'c'.repeat(31) }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, color: 'd'.repeat(41) }).success).toBe(false);
    });

    it('should validate seatCapacity boundaries (1 to 8 seats)', () => {
      // Valid boundaries
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, seatCapacity: 1 }).success).toBe(true);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, seatCapacity: 8 }).success).toBe(true);

      // Invalid: zero, negative, decimal, above 8
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, seatCapacity: 0 }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, seatCapacity: -1 }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, seatCapacity: 4.5 }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, seatCapacity: 9 }).success).toBe(false);
      expect(createVehicleSchema.safeParse({ ...validCreationPayload, seatCapacity: 100 }).success).toBe(false);
    });

    it('should reject unknown fields (strict schema enforcement)', () => {
      const payloadWithUnknown = { ...validCreationPayload, unexpectedField: 'malicious' };
      const result = createVehicleSchema.safeParse(payloadWithUnknown);
      expect(result.success).toBe(false);
    });

    it('should reject client attempts to inject system-managed fields', () => {
      const injectedFields = [
        { vehicleId: '11111111-2222-3333-4444-555555555555' },
        { driverId: '11111111-2222-3333-4444-555555555555' },
        { isActive: false },
        { createdAt: new Date().toISOString() },
        { updatedAt: new Date().toISOString() },
      ];

      for (const injection of injectedFields) {
        const payload = { ...validCreationPayload, ...injection };
        const result = createVehicleSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('2. Vehicle Update Schema (updateVehicleSchema)', () => {
    it('should validate partial update with single field (make)', () => {
      const result = updateVehicleSchema.safeParse({ make: 'Honda' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.make).toBe('Honda');
        expect(result.data.model).toBeUndefined();
      }
    });

    it('should validate partial update with single field (model)', () => {
      const result = updateVehicleSchema.safeParse({ model: 'Civic' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.model).toBe('Civic');
      }
    });

    it('should validate partial update with single field (color)', () => {
      const result = updateVehicleSchema.safeParse({ color: 'Midnight Blue' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe('Midnight Blue');
      }
    });

    it('should validate color update to null', () => {
      const result = updateVehicleSchema.safeParse({ color: null });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBeNull();
      }
    });

    it('should validate partial update with single field (isActive: false)', () => {
      const result = updateVehicleSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });

    it('should validate partial update with single field (isActive: true)', () => {
      const result = updateVehicleSchema.safeParse({ isActive: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should validate update with multiple permitted fields', () => {
      const payload = {
        make: 'Hyundai',
        model: 'Verna',
        color: 'Titan Grey',
        isActive: true,
      };
      const result = updateVehicleSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          make: 'Hyundai',
          model: 'Verna',
          color: 'Titan Grey',
          isActive: true,
        });
      }
    });

    it('should reject empty update payload', () => {
      const result = updateVehicleSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject invalid isActive types', () => {
      expect(updateVehicleSchema.safeParse({ isActive: 'yes' }).success).toBe(false);
      expect(updateVehicleSchema.safeParse({ isActive: 1 }).success).toBe(false);
      expect(updateVehicleSchema.safeParse({ isActive: null }).success).toBe(false);
    });

    it('should reject empty strings for update fields', () => {
      expect(updateVehicleSchema.safeParse({ make: '   ' }).success).toBe(false);
      expect(updateVehicleSchema.safeParse({ model: '   ' }).success).toBe(false);
    });

    it('should reject string lengths exceeding maximum limits on update', () => {
      expect(updateVehicleSchema.safeParse({ make: 'a'.repeat(81) }).success).toBe(false);
      expect(updateVehicleSchema.safeParse({ model: 'b'.repeat(81) }).success).toBe(false);
      expect(updateVehicleSchema.safeParse({ color: 'c'.repeat(41) }).success).toBe(false);
    });

    it('should reject attempts to update immutable or protected fields', () => {
      const immutableAttempts = [
        { registrationNumber: 'DL99ZZ9999' },
        { vehicleType: 'SUV' },
        { seatCapacity: 6 },
        { vehicleId: '11111111-2222-3333-4444-555555555555' },
        { driverId: '11111111-2222-3333-4444-555555555555' },
        { createdAt: new Date().toISOString() },
        { updatedAt: new Date().toISOString() },
      ];

      for (const attempt of immutableAttempts) {
        const result = updateVehicleSchema.safeParse(attempt);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('3. Vehicle ID Route Parameter Schema (vehicleIdParamSchema)', () => {
    it('should validate a well-formed UUID v4 parameter', () => {
      const result = vehicleIdParamSchema.safeParse({
        vehicleId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vehicleId).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should trim surrounding whitespace from UUID parameter', () => {
      const result = vehicleIdParamSchema.safeParse({
        vehicleId: '  123e4567-e89b-12d3-a456-426614174000  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vehicleId).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should reject malformed or non-UUID strings', () => {
      const invalidIds = [
        'not-a-uuid',
        '12345',
        '123e4567-e89b-12d3-a456',
        '123e4567-e89b-12d3-a456-42661417400g', // 'g' is non-hex
        '',
        '   ',
      ];

      for (const vehicleId of invalidIds) {
        const result = vehicleIdParamSchema.safeParse({ vehicleId });
        expect(result.success).toBe(false);
      }
    });

    it('should reject unknown fields in parameter object', () => {
      const result = vehicleIdParamSchema.safeParse({
        vehicleId: '123e4567-e89b-12d3-a456-426614174000',
        extra: 'unexpected',
      });
      expect(result.success).toBe(false);
    });
  });
});
