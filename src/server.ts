import { app } from "./app"
import { env } from "./config/env"

const server = app.listen(env.PORT, () => {
  console.log(`[Express API] Server running in ${env.NODE_ENV} mode on port ${env.PORT}`)
  console.log(`[Express API] Health check endpoint: http://localhost:${env.PORT}/health`)
})

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("[Express API] SIGTERM received, closing HTTP server...")
  server.close(() => {
    console.log("[Express API] HTTP server closed cleanly.")
  })
})

process.on("SIGINT", () => {
  console.log("[Express API] SIGINT received, shutting down...")
  server.close(() => {
    console.log("[Express API] HTTP server closed.")
    process.exit(0)
  })
})
