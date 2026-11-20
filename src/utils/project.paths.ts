/**
 * Centralized API paths for Project endpoints.
 * Every router, test, and client imports from here — never hardcode path strings.
 */
export const PROJECT_PATHS = {
  /** Express router base mount */
  BASE: "/api/v1/projects",

  /** Express sub-route endpoints within projectRouter */
  BY_ID: "/:projectId",

  /** Full Express path helpers for callers/tests */
  full: {
    list: "/api/v1/projects",
    create: "/api/v1/projects",
    byId: (projectId: string) =>
      `/api/v1/projects/${encodeURIComponent(projectId)}`,
  },
} as const
