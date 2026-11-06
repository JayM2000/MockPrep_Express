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
}

export const env: EnvConfig = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: (process.env.NODE_ENV as EnvConfig["NODE_ENV"]) || "development",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  FASTAPI_BASE_URL: process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000",
  INTERNAL_SERVICE_TOKEN:
    process.env.INTERNAL_SERVICE_TOKEN || "mockprep-internal-secret-token-change-in-prod",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_2UGQ8pKSuwej@ep-mute-queen-abfugb4p-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require",
}
