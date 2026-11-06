import { Request, Response, NextFunction } from "express"

/**
 * Custom application error with HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    Object.setPrototypeOf(this, new.target.prototype)
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Centralized Express error-handling middleware.
 * Express identifies an error middleware by its 4 arguments: (err, req, res, next).
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500
  const message = err.message || "Internal server error"

  // Log server errors for diagnosis
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.url}:`, err)
  }

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  })
}
