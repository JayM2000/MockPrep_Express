import dotenv from "dotenv"

// Load environment variables from .env file
dotenv.config()

export interface EnvConfig {
  PORT: number
  NODE_ENV: "development" | "production" | "test"
  CORS_ORIGIN: string
  FASTAPI_BASE_URL: string
  INTERNAL_SERVICE_TOKEN: string
  DATABASE_URL: string
  CLERK_PUBLISHABLE_KEY: string
  CLERK_SECRET_KEY: string
}

export const env: EnvConfig = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: (process.env.NODE_ENV as EnvConfig["NODE_ENV"]) || "development",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  FASTAPI_BASE_URL: process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000",
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN!,
  DATABASE_URL: process.env.DATABASE_URL!,
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
}
