/**
 * Centralized path registry for User endpoints.
 * All Express user route handlers import paths from here — no hardcoded strings.
 */
export const USER_PATHS = {
  /** Mount point in app.ts: app.use(USER_PATHS.BASE, userRouter) */
  BASE: "/api/v1/users",

  /** POST /api/v1/users/role — set role after onboarding */
  ROLE: "/role",

  /** GET /api/v1/users/me — get current user profile + role */
  ME: "/me",

  /** Fully-qualified paths for use in tests and clients */
  full: {
    role: "/api/v1/users/role",
    me: "/api/v1/users/me",
  },
} as const
