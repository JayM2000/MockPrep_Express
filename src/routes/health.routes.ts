import { Router, Request, Response } from "express"

export const healthRouter = Router()

/**
 * GET /health
 * Lightweight liveness and readiness probe for uptime monitoring.
 */
healthRouter.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "mockprep-express-api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
  })
})
