import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/index.js';

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

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error in development
  if (config.nodeEnv === 'development') {
    console.error('Error:', err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      error: 'Validation Error',
      message: 'Invalid request data',
      statusCode: 400,
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    };
    res.status(400).json(response);
    return;
  }

  // Handle custom app errors
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: 'Internal Server Error',
    message:
      config.nodeEnv === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    statusCode: 500,
  };
  res.status(500).json(response);
};
