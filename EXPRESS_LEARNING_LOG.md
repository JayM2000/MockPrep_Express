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



