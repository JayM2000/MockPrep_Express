# Express API Learning Log

## Phase 0: Repository Audit & Multi-Backend Architecture Agreement (2026-11-05)

### 1. Architectural Shift & Rationale
We adapted our architecture per `AI_Project_Platform_Monorepo_Phased_Implementation_Guide.md` to split backend concerns into two specialized services:
1. **Node.js + Express API (`MockPrep_Express/`):**
   - The primary application backend.
   - Built with TypeScript and Node.js.
   - Handles standard web application duties: user sessions, authorization, CRUD, PostgreSQL transactions, authoritative timers, and Socket.IO realtime events.
2. **Python + FastAPI AI Service (`MockPrep_BE/`):**
   - A dedicated internal AI microservice.
   - Built with Python, Pydantic, and async libraries.
   - Handles AI-heavy workloads: LLM provider orchestration, prompt pipelines, AST chunking, embeddings, and vector similarity search (pgvector).

### 2. Environment Audit & Git Isolation
- **Node.js Runtime:** v22.16.0 (verified via `node --version`).
- **NPM Version:** 11.4.1 (verified via `npm --version`).
- **Git Tracking Isolation:** Added `/MockPrep_Express/` and `/MockPrep_BE/` to root `.gitignore` so the Next.js frontend repository does not track backend code or dependencies.
- **Created:** `MockPrep_Express/.gitignore` isolating local `node_modules/`, `dist/`, `.env`, and test artifacts.

### 3. Key Concepts Understood
- **Why Node.js + Express for Main Application?**
  - High concurrency for I/O-bound web traffic and realtime WebSockets (Socket.IO).
  - Perfect ecosystem synergy with Clerk authentication and TypeScript data types shared conceptually with the Next.js frontend.
- **Why keep FastAPI separate instead of doing AI in Express?**
  - Python has the most robust ecosystem for LLM orchestration, vector math, AST manipulation, and RAG pipelines.
  - Keeping them separated prevents heavy AI processing from blocking or degrading the latency of critical user-facing web operations (like timer ticks or session updates).
- **Service-to-Service Security:** The Next.js frontend talks to Express. Express is the only service that talks directly to FastAPI via protected internal endpoints. The browser never directly invokes the FastAPI AI backend.

---

## Phase 2: Express API Initialization & Health Endpoint (2026-11-05)

### 1. Concepts Mastered
- **Node.js Runtime & Event Loop:** Executes asynchronous non-blocking JavaScript/TypeScript on top of the V8 engine and libuv.
- **Express Application & Factory Pattern (`createApp()`):**
  - Keeps HTTP configuration separate from `server.listen()`.
  - Enables in-memory integration testing via Supertest without binding to live TCP ports.
- **Middleware Mechanics & `next()`:**
  - Standard middleware: `(req, res, next) => { ... next() }`. Executes sequentially.
  - 4-argument Error middleware: `(err, req, res, next) => { ... }`. Express routes any unhandled error or `next(err)` directly to this handler.
- **TypeScript Integration:**
  - Strong compile-time typing for `Request`, `Response`, `NextFunction`, and environment variables.
  - Compile output to `dist/` with source isolation.

### 2. Implemented & Verified
- `src/config/env.ts`: Typed environment access.
- `src/middleware/error-handler.ts`: Structured error response and `AppError` class.
- `src/routes/health.routes.ts`: `GET /health` responding with service status, uptime, and timestamp.
- `src/app.ts` & `src/server.ts`: Factory and server listener with graceful shutdown (`SIGTERM`/`SIGINT`).
- `tests/health.test.ts`: Automated Vitest + Supertest suite (100% pass).
- Live verification: Verified `GET /health` returns HTTP 200 and unmapped route returns HTTP 404 with structured JSON.

---

## Phase 4: API Contracts & Service-to-Service Communication (2026-11-06)

### 1. Concepts Mastered
- **Contract Compatibility between TypeScript & Pydantic:**
  - TypeScript types (`ChallengeGenerateRequest`, `ChallengeJobResponse`) provide compile-time guarantees in Express.
  - Pydantic models in FastAPI enforce runtime validation and reject malformed requests with `422 Unprocessable Entity`.
  - JSON wire format alignment: JavaScript camelCase (`projectId`, `jobId`, `codeSummary`) matches across both boundaries without manual property reshaping.
- **Service Integration Architecture (`FastApiClient`):**
  - Encapsulates network communication with FastAPI behind a clean domain client interface.
  - Native `fetch` with `AbortController` timeout guarantees requests do not hang indefinitely if FastAPI is slow or down.
  - Injects `X-Service-Token` (machine-to-machine authentication) and `X-Correlation-ID` (distributed tracing across services).
  - Normalizes errors: maps FastAPI error payloads into `AppError` with accurate HTTP status codes (401, 404, 503, 504).
- **Asynchronous Workflows & Non-blocking API Design:**
  - Express accepts user requests at `POST /api/v1/challenges/generate`.
  - Validates required inputs before delegating to FastAPI.
  - Returns `202 Accepted` immediately so callers receive a tracking `jobId` instead of waiting 30 seconds for AI processing.
  - Status queries can be polled or retrieved via `GET /api/v1/challenges/jobs/:jobId`.

### 2. Implemented & Verified
- `src/types/api.types.ts`: Universal `ApiErrorEnvelope` and response contracts.
- `src/types/challenge.types.ts`: TypeScript contracts mirroring FastAPI Pydantic schemas.
- `src/integrations/fastapi-client/fastapi-client.ts`: Typed integration client with timeout, correlation ID, and error normalization.
- `src/routes/challenge.routes.ts`: `POST /api/v1/challenges/generate` and `GET /api/v1/challenges/jobs/:jobId`.
- `src/app.ts`: Mounted `/api/v1/challenges` routes.
- `tests/fastapi-client.test.ts`: Unit tests validating token injection, error mapping, and timeout handling.
- `tests/challenge.routes.test.ts`: Supertest integration tests verifying 400 validation and 202 job creation.
- Verification: 9/9 tests pass (`npm test`) and `npm run build` compiles with zero errors.

---

## Phase 5: PostgreSQL Foundation & Schema Ownership (2026-11-06)

### 1. Concepts Mastered
- **Database Connection Pools vs Single Connections:**
  - Establishing a new TLS/TCP connection to a cloud database (like Neon in AWS eu-west-2) takes 100-300ms.
  - A connection pool (`pg.Pool`) maintains a pre-warmed pool of active database connections (max 10) that can be borrowed for a query and immediately returned.
  - Keeps HTTP request latency low and avoids overwhelming the database with connection spikes.
- **Strict Function-Based Database Layer:**
  - Following EXDR-004, implemented pure function-based database utilities:
    - `getDbPool()`: Singleton-pattern closure returning the shared pool.
    - `query<T>(text, params)`: Executes a parameterized query against a borrowed pool client and releases it.
    - `withTransaction<T>(callback)`: Manages ACID transaction boundary: calls `BEGIN`, runs operations, calls `COMMIT` on success, or `ROLLBACK` on error, and ensures the client is released even if an exception occurs.
    - `checkDbHealth()`: Liveness check executing `SELECT 1`.
    - `closeDbPool()`: Clean pool shutdown for graceful server termination and test teardown.
- **SQL Injection Prevention via Parameterized Queries:**
  - Never concatenate raw user input into SQL strings (e.g. `WHERE id = '${id}'`).
  - Always use placeholders (`$1, $2, $3`) so the database engine treats input as literal data, preventing SQL injection attacks entirely.
- **Schema Isolation (`app` schema):**
  - Express creates and writes only to the `app` schema.
  - All SQL queries and migrations explicitly target `app.*` (e.g. `CREATE TABLE IF NOT EXISTS app.projects ...`).
  - Express has zero write access to `ai.*` tables.
- **Lightweight Functional Migration Runner:**
  - Rather than introducing heavy ORMs with opaque migration engines (like Prisma or TypeORM), built a lightweight, deterministic migration runner `runMigrations()`.
  - Reads timestamped `.sql` files in sequence from `src/database/migrations/`, wraps execution in an atomic transaction, and tracks applied migrations in `app.schema_migrations`.
- **Pure Functional Repository Pattern:**
  - `src/modules/projects/project.repository.ts` exposes pure functions (`createProject`, `findProjectById`, `listProjects`, `deleteProject`).
  - Pure functions receive inputs and return typed plain TypeScript objects, with zero class instantiation or OOP state.

### 2. Implemented & Verified
- `src/config/env.ts`: Added `DATABASE_URL` to validated typed configuration.
- `src/database/connection.ts`: Functional connection pool, query execution, transaction wrapper, and health checker.
- `src/database/migrate.ts`: Deterministic migration runner executing `.sql` files.
- `src/database/migrations/001_create_projects.sql`: Creates `app` schema and `app.projects` table with index on `created_by`.
- `src/modules/projects/project.repository.ts`: Pure functional repository for project persistence.
- `package.json`: Added `"migrate:app": "tsx src/database/migrate.ts"` script.
- `tests/database.test.ts`: Automated integration tests verifying Neon connection health and a complete project CRUD lifecycle.
- Verification: 11/11 tests pass (`npm test`) and `npm run build` compiles with zero TypeScript errors.

---

## Phase 6: First Complete Vertical Slice: Project Creation

### 1. Concepts Learned & Applied
- **Full-Stack Vertical Slice Architecture:**
  - Connecting the Next.js frontend -> Express API -> PostgreSQL database for end-to-end user workflows.
  - Eliminating mock in-memory stores and replacing them with live HTTP API contracts and database persistence.
- **Contract & Schema Alignment:**
  - Bridging frontend domain models (`category`, `frontendTech`, `backendTech`, `database`, `tags`, `status`) with relational PostgreSQL schema columns (`app.projects`).
  - Running forward migration `002_update_projects_add_fields.sql` using `ALTER TABLE ADD COLUMN IF NOT EXISTS`.
- **Data Normalization & DTO Mapping:**
  - Route-level transformation function `toProjectResponse()` cleanly maps snake_case database rows (`frontend_tech`, `created_by`, `difficulty`) into client camelCase DTOs (`frontendTech`, `ownerId`, `complexity`).
- **Centralized Route Path Registry (`PROJECT_PATHS`):**
  - Path constants declared in `src/utils/project.paths.ts` and unified in `src/utils/index.ts`. No hardcoded endpoint strings in routes, app factory, or tests.
- **RESTful Endpoints for Resources:**
  - `POST /api/v1/projects`: Validates body (min 3 chars name, min 10 chars description, valid complexity enum), generates UUID, inserts into DB, returns 201 Created.
  - `GET /api/v1/projects`: Lists projects ordered by `created_at DESC` with pagination (`limit`, `offset`).
  - `GET /api/v1/projects/:projectId`: Fetches project by ID or returns 404 AppError.
  - `DELETE /api/v1/projects/:projectId`: Deletes project by ID or returns 404 AppError.
- **Next.js 16 Partial Prerendering (PPR) & Clerk Boundary Design:**
  - Middleware-level auth guarding (`clerkMiddleware`) ensures dynamic session inspection occurs in proxy/middleware rather than crashing static page prerender workers.
  - Pages stay prerenderable with client-side TanStack Query hydration.

### 2. Implemented & Verified
- `MockPrep_Express/src/database/migrations/002_update_projects_add_fields.sql`: Schema migration adding missing frontend fields.
- `MockPrep_Express/src/utils/project.paths.ts`: Centralized project route path registry.
- `MockPrep_Express/src/modules/projects/project.repository.ts`: Updated with expanded `ProjectRow` and `CreateProjectInput`.
- `MockPrep_Express/src/routes/project.routes.ts`: Project router with validation, DTO transformation, and CRUD handlers.
- `MockPrep_Express/src/app.ts`: Registered `projectRouter` on `PROJECT_PATHS.BASE`.
- `MockPrep_Express/tests/project.routes.test.ts`: 10 comprehensive integration tests covering POST, GET, GET by ID, DELETE, 400 validations, and 404s.
- `src/lib/api/client.ts`: Updated to support `NEXT_PUBLIC_EXPRESS_API_URL` prefix for relative API paths.
- `src/services/projects/project.service.ts`: Swapped mock fixture store with real API calls to Express `/api/v1/projects`.
- `src/features/projects/components/create-project-form.tsx`: Connected to real mutation and instant redirect on success.
- Verification: Express 21/21 tests pass, FastAPI 13/13 tests pass, Next.js builds clean (`next build` 14/14 routes compiled), and ESLint passes with 0 warnings/errors.

---

## Phase 7: Clerk Authentication & Resource Authorization

### 1. Concepts Learned & Applied
- **Authentication (AuthN) vs. Authorization (AuthZ):**
  - **AuthN (401 Unauthorized):** Proving identity. Handled by verifying cryptographic RS256 signatures of JWT tokens issued by Clerk. If missing, expired, or invalid, Express rejects the request with HTTP 401.
  - **AuthZ (403 Forbidden):** Enforcing permissions. Once identity is proven (`res.locals.userId`), the application inspects resource ownership (`app.projects.created_by`). If a user attempts to mutate or delete a project they do not own, Express rejects the request with HTTP 403 Forbidden.
- **Asymmetric Cryptography & JWKS (JSON Web Key Set):**
  - Clerk signs JWT tokens with a private key.
  - `@clerk/express` fetches and caches Clerk's public JWKS keys once, verifying incoming signatures locally in memory with zero per-request network round-trips to Clerk servers.
- **Pure Function-Based Auth Middleware (EXDR-004):**
  - Built `src/middleware/auth.ts` without ES6 classes:
    - `getAuthenticatedUser(req)`: Pure function extracting the verified user ID via `getAuth(req)`.
    - `requireAuth(req, res, next)`: Middleware closure guarding protected endpoints. Rejects unauthenticated requests with 401 AppError and assigns `res.locals.userId = userId`.
    - `assertProjectOwner(projectCreatedBy, currentUserId)`: Functional domain assertion ensuring resource ownership before destructive actions, throwing 403 AppError on mismatch.
- **Safe Testing Mode via `NODE_ENV === "test"` Scoping:**
  - Integrated a test-mode bypass (`x-test-user-id`) strictly guarded by `env.NODE_ENV === "test"` so Vitest/Supertest suites can execute isolated integration tests deterministically without needing active network sessions to Clerk's cloud.
- **Frontend Automatic Token Resolution:**
  - Upgraded Next.js `apiClient` (`src/lib/api/client.ts`) to automatically extract the active session token from `window.Clerk.session.getToken()` on browser calls and attach it as `Authorization: Bearer <token>`, providing transparent authentication across all frontend features.

### 2. Implemented & Verified
- Installed `@clerk/express` in `MockPrep_Express`.
- `MockPrep_Express/src/config/env.ts`: Added `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
- `MockPrep_Express/.env` & `.env.example`: Configured development keys.
- `MockPrep_Express/src/middleware/auth.ts`: Implemented `getAuthenticatedUser`, `requireAuth`, and `assertProjectOwner`.
- `MockPrep_Express/src/app.ts`: Mounted `clerkMiddleware()` into Express middleware chain.
- `MockPrep_Express/src/routes/project.routes.ts`: Secured `POST /` with `requireAuth` and `DELETE /:projectId` with `requireAuth` + `assertProjectOwner`.
- `MockPrep_Express/tests/auth.test.ts`: Created dedicated automated test suite verifying 401 unauthenticated rejections, 403 non-owner mutation blocks, and 200 owner deletion.
- `MockPrep_Express/tests/project.routes.test.ts`: Updated route test suite with authenticated identities.
- `src/lib/api/client.ts`: Wired automatic Clerk bearer token injection.
- Verification: Express 24/24 tests pass, FastAPI 13/13 tests pass, Next.js build clean (14/14 routes compiled), and Next.js lint clean (0 warnings/errors).

---

## Phase 8: Role-Based System (Candidate vs Assessor), Project Visibility & Expiry (2026-11-19)

### 1. Concepts Mastered
- **Dual-Persona Role Architecture (Candidate vs Assessor):**
  - Segmented the user base into two dedicated personas:
    - `candidate`: End-users preparing for technical interviews, exploring public projects, and saving bookmarks.
    - `assessor`: Technical leads and evaluators designing assessment projects, setting visibility and expiry bounds, and managing candidate evaluation sessions.
  - User onboarding stored in `app.user_roles` with check constraint `role IN ('candidate', 'assessor')`.
- **Ephemeral Project Lifecycle & Automatic Expiration:**
  - Added project visibility ('public' | 'private'), unique random UUID `share_token`, `expiry_days` (1 to 30), and computed timestamp `expires_at`.
  - Non-permanent project design: prevents cloud environment sprawl and guarantees interview environments stay current.
  - Assessors can renew projects up to 30 days via `PATCH /api/v1/projects/:projectId/renew`.
- **Secret Link Sharing (`/api/v1/shared/:shareToken`):**
  - Any authenticated registered user (Candidate or Assessor) possessing the link can view private projects as long as they are active.
  - Expired links return HTTP 410 Gone with a dedicated explanation banner.
- **Candidate Bookmarks (`app.project_bookmarks`):**
  - Candidates can bookmark interesting public challenges via `POST/DELETE /api/v1/projects/:projectId/bookmark` and review them at `/bookmarks`.
- **Role-Aware Express Middleware:**
  - `requireRole(role)`: Functional middleware enforcing role-specific route protection (HTTP 403 Forbidden).
  - `attachRole()`: Loads caller role on mixed-access endpoints (`GET /api/v1/projects`) without rejecting access.

### 2. Implemented & Verified
- Database Migrations:
  - `003_create_user_roles.sql`: Created `app.user_roles` table with indexes.
  - `004_add_project_visibility_expiry.sql`: Added `visibility`, `share_token`, `expiry_days`, `expires_at` to `app.projects`.
  - `005_create_bookmarks_session_invites.sql`: Created `app.project_bookmarks` and `app.session_invites`.
- Express Backend:
  - `src/modules/users/user-role.repository.ts`: Pure functional repository for user onboarding.
  - `src/modules/projects/bookmark.repository.ts`: Pure functional repository for candidate bookmarks.
  - `src/modules/projects/project.repository.ts`: Updated `createProject`, `listProjects` (role-filtered), and `renewProject`.
  - `src/middleware/role.ts`: Implemented `requireRole` and `attachRole`.
  - `src/routes/user.routes.ts`: `POST /api/v1/users/role` & `GET /api/v1/users/me`.
  - `src/routes/shared.routes.ts`: `GET /api/v1/shared/:shareToken`.
  - `src/routes/project.routes.ts`: Role-aware project creation, filtering, bookmarking, and renewals.
  - `tests/project.routes.test.ts`: Expanded to 24 tests covering role checks, shared link access, and bookmarks.
- Frontend (Next.js):
  - User role context (`src/context/user-role-context.tsx`).
  - `/onboarding` page for seamless post-signup role selection.
  - Role-customized navigation (`src/config/navigation.ts`, `src/components/layout/sidebar/sidebar-nav.tsx`).
  - Candidate Dashboard (`src/components/dashboard/candidate-dashboard.tsx`).
  - Assessor Dashboard (`src/components/dashboard/assessor-dashboard.tsx`).
  - Project card upgrades: visibility badge, expiry pill, one-click share link copy, and candidate bookmarking.
  - Create Project Form: visibility toggle (public/private) and expiry slider (7-30 days) with Candidate block guard.
  - `/discover`: Real-time search and filter for all active public projects.
  - `/bookmarks`: Candidate library of saved challenges.
  - `/links`: Assessor console for copying active candidate share links and extending expirations.
  - `/analytics`: Assessor overview of active vs expired links, difficulty breakdown, and public catalog exposure.
  - `/p/[shareToken]`: Suspense-wrapped share link landing page with 410 expired error handling.
- Verification:
  - Express test suite: 38/38 tests passing across 6 test suites.
  - Express typecheck: 0 errors.
  - FastAPI AI test suite: 13/13 tests passing.
  - Next.js production build: 20/20 routes prerendered cleanly.
  - Next.js lint: 0 errors.





