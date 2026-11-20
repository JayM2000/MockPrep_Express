import express, { Application, Request, Response } from "express"
import cors from "cors"
import { clerkMiddleware } from "@clerk/express"
import { env } from "./config/env"
import { healthRouter } from "./routes/health.routes"
import { challengeRouter } from "./routes/challenge.routes"
import { projectRouter } from "./routes/project.routes"
import { userRouter } from "./routes/user.routes"
import { sharedRouter } from "./routes/shared.routes"
import { inviteRouter } from "./routes/invite.routes"
import { errorHandler, createAppError } from "./middleware/error-handler"
import {
  HEALTH_PATHS,
  CHALLENGE_PATHS,
  PROJECT_PATHS,
  USER_PATHS,
  SHARED_PATHS,
} from "./utils"

/**
 * Creates and configures the Express application.
 * Keeping this factory separate from server.listen() allows running fast unit/integration
 * tests with Supertest without occupying a real TCP port.
 */
export function createApp(): Application {
  const app: Application = express()

  // Standard middleware
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  )
  app.use(express.json())

  // Clerk authentication middleware — parses session tokens & verifies JWT signatures
  app.use(
    clerkMiddleware({
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    })
  )

  // Route registration
  app.use(HEALTH_PATHS.BASE, healthRouter)
  app.use(CHALLENGE_PATHS.BASE, challengeRouter)
  app.use(PROJECT_PATHS.BASE, projectRouter)
  app.use(USER_PATHS.BASE, userRouter)
  app.use(SHARED_PATHS.BASE, sharedRouter)
  app.use("/api/v1", inviteRouter)

  // 404 handler for undefined routes
  app.use((req: Request, res: Response, next) => {
    next(createAppError(`Cannot ${req.method} ${req.originalUrl}`, 404))
  })

  // Centralized error handler (must be registered last)
  app.use(errorHandler)

  return app
}

export const app = createApp()
