/**
 * Centralized API paths for Challenge endpoints across Express and FastAPI integration.
 */
export const CHALLENGE_PATHS = {
  /** Express public router base mount */
  BASE: "/api/v1/challenges",

  /** Express sub-route endpoints within challengeRouter */
  GENERATE: "/generate",
  JOB_BY_ID: "/jobs/:jobId",

  /** Full Express path helpers for callers/tests */
  full: {
    GENERATE: "/api/v1/challenges/generate",
    jobById: (jobId: string) => `/api/v1/challenges/jobs/${encodeURIComponent(jobId)}`,
  },

  /**
   * Internal FastAPI endpoints invoked by FastApiClient
   */
  FASTAPI: {
    HEALTH: "/health",
    INTERNAL_V1_PREFIX: "/internal/v1",
    CHALLENGES_PREFIX: "/challenges",
    GENERATE: "/internal/v1/challenges/generate",
    JOB_BY_ID: "/internal/v1/challenges/jobs/:jobId",
    jobById: (jobId: string) =>
      `/internal/v1/challenges/jobs/${encodeURIComponent(jobId)}`,
  },
} as const
