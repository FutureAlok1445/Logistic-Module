import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error, req: Request, res: Response, next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }
  logger.error(err, 'Unhandled error');
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}