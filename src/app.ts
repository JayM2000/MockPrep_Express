import express, { Application, Request, Response } from "express"
import cors from "cors"
import { env } from "./config/env"
import { healthRouter } from "./routes/health.routes"
import { challengeRouter } from "./routes/challenge.routes"
import { errorHandler, createAppError } from "./middleware/error-handler"
import { HEALTH_PATHS, CHALLENGE_PATHS } from "./utils"

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

  // Route registration
  app.use(HEALTH_PATHS.BASE, healthRouter)
  app.use(CHALLENGE_PATHS.BASE, challengeRouter)

  // 404 handler for undefined routes
  app.use((req: Request, res: Response, next) => {
    next(createAppError(`Cannot ${req.method} ${req.originalUrl}`, 404))
  })

  // Centralized error handler (must be registered last)
  app.use(errorHandler)

  return app
}

export const app = createApp()
