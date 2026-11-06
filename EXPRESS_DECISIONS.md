# Express API Architecture Decisions

## EXDR-001: Separation of Express Application Backend and FastAPI AI Backend
- **Date:** 2026-11-05
- **Status:** Accepted
- **Context:** An engineering simulation platform has distinct workloads: (1) low-latency interactive CRUD, session management, and realtime WebSocket rooms; (2) computationally intensive AI prompt pipelines, vector indexing, code analysis, and RAG.
- **Decision:** Split the backend into two modular services:
  - `MockPrep_Express/`: Node.js + Express + TypeScript as the public-facing application gateway and owner of users, projects, sessions, timers, and the PostgreSQL `app` schema.
  - `MockPrep_BE/`: Python + FastAPI as the protected internal AI service and owner of embeddings, prompt orchestration, and the PostgreSQL `ai` schema.
- **Alternatives Considered:**
  - Single FastAPI backend handling both web CRUD and AI (heavier to manage Socket.IO session rooms and duplicates TypeScript types across language barriers).
  - Single Express backend doing Python via child processes (fragile runtime dependencies, lacks native Python AI library ecosystem).
- **Consequences:** Clear division of responsibilities, decoupled scaling, isolated security perimeters.

## EXDR-002: Monorepo Folder Isolation via Root `.gitignore`
- **Date:** 2026-11-05
- **Status:** Accepted
- **Context:** The frontend and both backends reside under the same project directory `MockPrep/`. The frontend repository needs to avoid tracking backend node_modules, Python virtual environments, and local build artifacts.
- **Decision:** Exclude `/MockPrep_Express/` and `/MockPrep_BE/` in the root `.gitignore`. Each backend folder manages its own dependencies, `.gitignore`, and version-control boundaries.
- **Consequences:** Zero pollution of frontend Git status; clean, isolated development workflows for FE, Express, and FastAPI.

## EXDR-003: Native Fetch Client with AbortController and Correlation IDs for FastAPI Integration
- **Date:** 2026-11-06
- **Status:** Accepted
- **Context:** Express needs to call FastAPI internal endpoints reliably, securely, and with timeout protection.
- **Decision:** Build a dedicated `createFastApiClient` factory using Node.js native `fetch` (standard in Node 22), with:
  1. Header injection: `X-Service-Token` for service identity and `X-Correlation-ID` for distributed tracing.
  2. Timeout enforcement: 10,000ms timeout via `AbortController` abort signal.
  3. Error normalization: Translating FastAPI HTTP error responses into domain `AppError` instances via `createAppError`.
- **Alternatives Considered:**
  - Third-party HTTP client libraries like `axios` (unnecessary dependency when Node 22 native `fetch` provides native standards-compliant fetch, AbortSignal, and zero bundle bloat).
- **Consequences:** Zero external HTTP client dependencies, unified error handling, and robust timeout protection.

## EXDR-004: Strict Function-Based Architecture in Node.js / Express (No ES6 Classes)
- **Date:** 2026-11-06
- **Status:** Accepted
- **Context:** In JavaScript/TypeScript, class-based architectures introduce unnecessary stateful OOP patterns, `this` binding ambiguities, and prototype inheritance complexities. Modern idiomatic Node.js and React strongly favor pure functions, closures, factory functions, and immutable data objects.
- **Decision:** Mandate a strictly function-based architecture across the entire Node.js Express backend (and Next.js frontend). No ES6 `class` definitions are allowed in Node.js.
  - Express app is instantiated via factory function `createApp()`.
  - Integration clients are created via factory function `createFastApiClient()` with closure methods and standalone functions (`generateChallenge`, `getChallengeJob`, `checkFastApiHealth`).
  - Errors are constructed via factory function `createAppError()` with type guard `isAppError()`.
  - Configuration and path registries are typed immutable objects (`as const`).
  - Python FastAPI retains classes where native (e.g. Pydantic `BaseModel`, Pydantic Settings) per Python ecosystem conventions.
- **Consequences:** Predictable code, zero `this` context bugs, simpler composition and testing, clean alignment with modern TypeScript functional practices.

## EXDR-005: Neon PostgreSQL as Cloud Database Engine
- **Date:** 2026-11-06
- **Status:** Accepted
- **Context:** The Express backend requires persistent storage for application data (projects, users, sessions, submissions). Neon PostgreSQL provides cloud-native PostgreSQL 17 with serverless branching and SSL encryption.
- **Decision:** Use Neon PostgreSQL with connection pooling via the official `pg` package and `sslmode=require`.
- **Alternatives Considered:**
  - Local Docker PostgreSQL instance (adds daemon overhead and environment discrepancies across machines).
  - SQLite (insufficient concurrency for multi-user session evaluation and lacking native PostgreSQL schema support).
- **Consequences:** Low maintenance, zero local DB server configuration, production-identical database engine.

## EXDR-006: Raw SQL with `pg` Driver and Pure Functional Repositories over Heavy ORMs
- **Date:** 2026-11-06
- **Status:** Accepted
- **Context:** Node.js ORMs like Prisma or TypeORM introduce substantial runtime overhead, complex schema generation steps, and often enforce class-based models or heavy query builders that obscure raw SQL execution.
- **Decision:** Adopt the lightweight, battle-tested `pg` driver with pure functional utilities (`getDbPool`, `query`, `withTransaction`) and functional repository functions (`createProject`, `findProjectById`, etc.).
  - Database migrations are written as standard declarative `.sql` files in `src/database/migrations/` and executed atomically via `runMigrations()`.
  - Queries use parameterized SQL (`$1, $2`) for full injection protection.
  - Repositories return clean, typed TypeScript interfaces without ORM magic or ES6 classes.
- **Alternatives Considered:**
  - Prisma (generates large binary engines, complicates multi-schema configurations, and abstracts away SQL learning).
  - Kysely / Drizzle (lighter than Prisma, but raw SQL with `pg` ensures the developer learns foundational SQL and relational mechanics first, with zero external dependency lock-in).
- **Consequences:** Zero ORM generation overhead, clear transparency into SQL queries and performance, strict compliance with the function-based architecture mandate (EXDR-004).

