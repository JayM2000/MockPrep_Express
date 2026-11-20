import { Request, Response, NextFunction } from "express"
import { getAuth } from "@clerk/express"
import { createAppError } from "./error-handler"
import { env } from "../config/env"

/**
 * Extracts the authenticated user ID from the request.
 * - In production/development: uses Clerk's cryptographically verified JWT session via getAuth(req).
 * - In test environment: allows an optional 'x-test-user-id' header for predictable integration testing.
 */
export function getAuthenticatedUser(req: Request): string | null {
  // Safe test-mode bypass: strictly scoped to NODE_ENV === "test"
  if (env.NODE_ENV === "test") {
    const testUserId = req.headers["x-test-user-id"]
    if (typeof testUserId === "string" && testUserId.trim().length > 0) {
      return testUserId.trim()
    }
  }

  try {
    const auth = getAuth(req)
    return auth.userId || null
  } catch {
    return null
  }
}

/**
 * Functional middleware enforcing authentication (AuthN).
 * Rejects unauthenticated requests with HTTP 401 Unauthorized.
 * Sets the verified userId on res.locals.userId for subsequent route handlers.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = getAuthenticatedUser(req)

  if (!userId) {
    next(
      createAppError(
        "Authentication required: missing, expired, or invalid session token",
        401
      )
    )
    return
  }

  res.locals.userId = userId
  next()
}

/**
 * Functional authorization helper enforcing resource ownership (AuthZ).
 * Rejects requests with HTTP 403 Forbidden if the authenticated user is not the resource owner.
 */
export function assertProjectOwner(
  projectOwnerId: string,
  currentUserId: string
): void {
  if (projectOwnerId !== currentUserId) {
    throw createAppError(
      "Forbidden: You do not have permission to modify or delete this project",
      403
    )
  }
}
