/**
 * Centralized path registry for Shared Link endpoints.
 * Any registered user (Candidate or Assessor) can access a project by its share token.
 */
export const SHARED_PATHS = {
  /** Mount point in app.ts: app.use(SHARED_PATHS.BASE, sharedRouter) */
  BASE: "/api/v1/shared",

  /** GET /api/v1/shared/:shareToken */
  BY_TOKEN: "/:shareToken",

  /** Fully-qualified paths for use in tests and clients */
  full: {
    byToken: (token: string) => `/api/v1/shared/${token}`,
  },
} as const
