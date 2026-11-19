import type { Request, Response } from 'express';
import type { FieldError } from './errors.js';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = unknown> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: {
    code: string;
    message: string;
    details: FieldError[] | null;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

/**
 * Standardized success response helper.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200,
  pagination?: PaginationMeta
): Response {
  const req = res.req as Request & { id?: string };
  const requestId = req?.id || (res.locals?.requestId as string) || 'unknown';

  const responsePayload: ApiResponse<T> = {
    success: true,
    statusCode,
    message,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...(pagination && { pagination }),
    },
  };

  return res.status(statusCode).json(responsePayload);
}
