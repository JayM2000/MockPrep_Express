import { HEALTH_PATHS } from "./health.paths"
import { CHALLENGE_PATHS } from "./challenge.paths"
import { PROJECT_PATHS } from "./project.paths"

/**
 * Universal registry of API paths for the Express application and external integrations.
 */
export const API_PATHS = {
  HEALTH: HEALTH_PATHS,
  CHALLENGES: CHALLENGE_PATHS,
  PROJECTS: PROJECT_PATHS,
} as const

export { HEALTH_PATHS, CHALLENGE_PATHS, PROJECT_PATHS }
