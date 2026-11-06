/**
 * Centralized API paths for Health check endpoints.
 */
export const HEALTH_PATHS = {
  /** Base path mounted on the Express application */
  BASE: "/health",
  /** Route path within the health router */
  ROOT: "/",
  /** Full URL path */
  FULL: "/health",
} as const
