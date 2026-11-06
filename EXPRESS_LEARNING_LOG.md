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

