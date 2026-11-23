import { z } from 'zod';
import {
  TransactionType,
  TransactionStatus,
} from '../generated/prisma/client.js';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const processPaymentSchema = z
  .object({
    bookingId: z
      .string()
      .trim()
      .regex(UUID_REGEX, { message: 'bookingId must be a valid UUID' }),
    paymentMethod: z
      .string()
      .trim()
      .min(1, { message: 'paymentMethod cannot be empty' })
      .max(50, { message: 'paymentMethod cannot exceed 50 characters' })
      .default('SIMULATED'),
    amount: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null) return undefined;
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num) || num <= 0) {
          throw new Error('amount must be a positive number');
        }
        return num.toFixed(2);
      }),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3, { message: 'currency must be a 3-letter ISO code' })
      .default('INR'),
    idempotencyKey: z
      .string()
      .trim()
      .min(1, { message: 'idempotencyKey cannot be empty' })
      .max(150, { message: 'idempotencyKey cannot exceed 150 characters' })
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, { message: 'description cannot exceed 500 characters' })
      .optional(),
  })
  .strict();

export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;

export const transactionIdParamSchema = z
  .object({
    transactionId: z
      .string()
      .trim()
      .regex(UUID_REGEX, { message: 'transactionId must be a valid UUID' }),
  })
  .strict();

export const bookingPaymentsParamSchema = z
  .object({
    bookingId: z
      .string()
      .trim()
      .regex(UUID_REGEX, { message: 'bookingId must be a valid UUID' }),
  })
  .strict();

export const listTransactionsQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => !isNaN(val) && val >= 1, {
        message: 'page must be a positive integer',
      }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
        message: 'limit must be between 1 and 100',
      }),
    type: z.nativeEnum(TransactionType).optional(),
    status: z.nativeEnum(TransactionStatus).optional(),
  })
  .strict();

export const processRefundSchema = z
  .object({
    bookingId: z
      .string()
      .trim()
      .regex(UUID_REGEX, { message: 'bookingId must be a valid UUID' }),
    reason: z
      .string()
      .trim()
      .max(500, { message: 'reason cannot exceed 500 characters' })
      .optional(),
    idempotencyKey: z
      .string()
      .trim()
      .min(1, { message: 'idempotencyKey cannot be empty' })
      .max(150, { message: 'idempotencyKey cannot exceed 150 characters' })
      .optional(),
  })
  .strict();

export type ProcessRefundInput = z.infer<typeof processRefundSchema>;

export type ListTransactionsQueryInput = z.infer<
  typeof listTransactionsQuerySchema
>;

export const driverEarningsQuerySchema = z
  .object({
    page: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null) return 1;
        const n = typeof val === 'number' ? val : parseInt(val, 10);
        return isNaN(n) ? 1 : n;
      })
      .refine((val) => val >= 1, {
        message: 'page must be a positive integer',
      }),
    limit: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null) return 20;
        const n = typeof val === 'number' ? val : parseInt(val, 10);
        return isNaN(n) ? 20 : n;
      })
      .refine((val) => val >= 1 && val <= 100, {
        message: 'limit must be between 1 and 100',
      }),
    startDate: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          return !isNaN(new Date(val).getTime());
        },
        { message: 'startDate must be a valid ISO date string' }
      ),
    endDate: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          return !isNaN(new Date(val).getTime());
        },
        { message: 'endDate must be a valid ISO date string' }
      ),
    rideId: z
      .string()
      .trim()
      .regex(UUID_REGEX, { message: 'rideId must be a valid UUID' })
      .optional(),
    driverId: z
      .string()
      .trim()
      .regex(UUID_REGEX, { message: 'driverId must be a valid UUID' })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate).getTime() <= new Date(data.endDate).getTime();
      }
      return true;
    },
    {
      message: 'startDate cannot be later than endDate',
      path: ['startDate'],
    }
  );

export type DriverEarningsQueryInput = z.infer<
  typeof driverEarningsQuerySchema
>;
