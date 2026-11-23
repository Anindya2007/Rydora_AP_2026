import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, type FieldError } from '../utils/errors.js';
import type { ApiErrorResponse } from '../utils/response.js';
import { env } from '../config/env.js';

interface PrismaErrorWithCode extends Error {
  code?: string;
  meta?: {
    target?: string[] | string;
    field_name?: string;
  };
}

/**
 * Centralized Express Error Handling Middleware.
 * Catches all operational and unexpected errors, mapping them to the standard ApiErrorResponse.
 */
export function errorHandler(
  err: Error,
  req: Request & { id?: string },
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  const requestId = req.id || (res.locals?.requestId as string) || 'unknown';
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal server error occurred';
  let details: FieldError[] | null = null;

  // 1. Operational AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  }
  // 2. Zod Schema Validation Error
  else if (err instanceof ZodError) {
    statusCode = 422;
    errorCode = 'UNPROCESSABLE_ENTITY';
    const firstIssue = err.issues[0];
    message = firstIssue ? firstIssue.message : 'Validation failed';
    details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  }
  // 3. Prisma Known Request Errors
  else if ('code' in err && typeof (err as PrismaErrorWithCode).code === 'string') {
    const prismaErr = err as PrismaErrorWithCode;
    switch (prismaErr.code) {
      case 'P2002': {
        statusCode = 409;
        errorCode = 'CONFLICT';
        const target = prismaErr.meta?.target;
        const targetStr = Array.isArray(target) ? target.join(', ') : target || 'field';
        message = `Unique constraint violation: record with this ${targetStr} already exists`;
        details = [{ field: targetStr, message: 'Already in use' }];
        break;
      }
      case 'P2025': {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
        message = 'Requested database record not found';
        break;
      }
      case 'P2003': {
        statusCode = 400;
        errorCode = 'BAD_REQUEST';
        message = 'Foreign key constraint failed on reference relation';
        break;
      }
      default: {
        statusCode = 500;
        errorCode = 'INTERNAL_SERVER_ERROR';
        message = env.NODE_ENV === 'production' ? 'Database operation failed' : err.message;
      }
    }
  }
  // 4. Catch-all unexpected errors
  else {
    statusCode = 500;
    errorCode = 'INTERNAL_SERVER_ERROR';
    if (env.NODE_ENV !== 'production') {
      message = err.message || 'Internal server error';
    }
  }

  // Log error on server for observability
  if (statusCode >= 500 && env.NODE_ENV !== 'test') {
    console.error(`[Error] [RequestID: ${requestId}]`, err);
  }

  const responsePayload: ApiErrorResponse = {
    success: false,
    statusCode,
    error: {
      code: errorCode,
      message,
      details,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return res.status(statusCode).json(responsePayload);
}

/**
 * 404 Not Found fallback handler for unregistered routes.
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const err = new AppError(`Cannot ${req.method} ${req.originalUrl} - Route not found`, 404, 'NOT_FOUND');
  next(err);
}
