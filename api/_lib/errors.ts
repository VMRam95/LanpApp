import type { VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export function handleError(error: unknown, res: VercelResponse): VercelResponse {
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', error);
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      error: 'Validation Error',
      message: 'Invalid request data',
      statusCode: 400,
      details: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    };
    return res.status(400).json(response);
  }

  // Handle custom app errors
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      error: error.name,
      message: error.message,
      statusCode: error.statusCode,
    };
    return res.status(error.statusCode).json(response);
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error instanceof Error
          ? error.message
          : 'Unknown error',
    statusCode: 500,
  };
  return res.status(500).json(response);
}
