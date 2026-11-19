export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_SERVER_ERROR';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Base Application Error class for operational errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details: FieldError[] | null;

  constructor(
    message: string,
    statusCode = 500,
    errorCode: ErrorCode = 'INTERNAL_SERVER_ERROR',
    details: FieldError[] | null = null,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details: FieldError[] | null = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict occurred', details: FieldError[] | null = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Validation failed', details: FieldError[] | null = null) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR', null, false);
  }
}
