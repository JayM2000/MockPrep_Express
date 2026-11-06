import dotenv from "dotenv"

// Load environment variables from .env file
dotenv.config()

export interface EnvConfig {
  PORT: number
  NODE_ENV: "development" | "production" | "test"
  CORS_ORIGIN: string
}

export const env: EnvConfig = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: (process.env.NODE_ENV as EnvConfig["NODE_ENV"]) || "development",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
}
