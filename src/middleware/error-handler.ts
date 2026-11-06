import { Request, Response, NextFunction } from "express"

/**
 * Custom application error interface.
 */
export interface AppError extends Error {
  statusCode: number
  isOperational: boolean
}

/**
 * Functional factory to create application errors with HTTP status codes.
 * Adheres strictly to the project's function-based approach (no ES6 classes).
 */
export function createAppError(
  message: string,
  statusCode: number = 500,
  isOperational: boolean = true
): AppError {
  const error = new Error(message) as AppError
  error.name = "AppError"
  error.statusCode = statusCode
  error.isOperational = isOperational
  return error
}

/**
 * Functional type guard to determine if an unknown error is an AppError.
 */
export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    typeof (err as AppError).statusCode === "number"
  )
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
  const statusCode = isAppError(err) ? err.statusCode : 500
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
