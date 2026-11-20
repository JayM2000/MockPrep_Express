import { Request, Response, NextFunction } from "express"
import { createAppError } from "./error-handler"
import { findUserRole } from "../modules/users/user-role.repository"
import { env } from "../config/env"

/**
 * Role values used in app.user_roles.
 */
export type AppRole = "candidate" | "assessor"

/**
 * Middleware factory that enforces a specific role (Authorization).
 * Must be used AFTER requireAuth (which sets res.locals.userId).
 *
 * Usage:
 *   router.post("/", requireAuth, requireRole("assessor"), handler)
 *
 * In test mode: reads 'x-test-role' header to simulate any role without a DB call.
 * In production: looks up the role from app.user_roles using the verified Clerk userId.
 */
export function requireRole(requiredRole: AppRole) {
  return async function roleMw(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = res.locals.userId as string

      let userRole: AppRole | null = null

      // Test-mode role bypass (safe — only active when NODE_ENV === "test")
      if (env.NODE_ENV === "test") {
        const testRole = req.headers["x-test-role"]
        if (typeof testRole === "string" && testRole.trim().length > 0) {
          userRole = testRole.trim() as AppRole
        }
      }

      // Production / development: load from DB
      if (!userRole) {
        const row = await findUserRole(userId)
        if (!row) {
          next(
            createAppError(
              "Role not set: please complete onboarding before accessing this resource",
              403
            )
          )
          return
        }
        userRole = row.role
      }

      if (userRole !== requiredRole) {
        next(
          createAppError(
            `Forbidden: this action requires the '${requiredRole}' role`,
            403
          )
        )
        return
      }

      // Store role for downstream handlers
      res.locals.role = userRole
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware that loads the caller's role and attaches it to res.locals.
 * Does NOT reject any role — use this on mixed-role endpoints where you
 * need to filter results differently per role (e.g. GET /projects).
 *
 * Sets res.locals.role = 'candidate' | 'assessor' | null
 */
export function attachRole() {
  return async function attachRoleMw(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = res.locals.userId as string | undefined
      if (!userId) {
        res.locals.role = null
        next()
        return
      }

      // Test-mode override
      if (env.NODE_ENV === "test") {
        const testRole = req.headers["x-test-role"]
        if (typeof testRole === "string" && testRole.trim().length > 0) {
          res.locals.role = testRole.trim() as AppRole
          next()
          return
        }
      }

      const row = await findUserRole(userId)
      res.locals.role = row?.role ?? null
      next()
    } catch (error) {
      next(error)
    }
  }
}
