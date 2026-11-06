# Express API Context — Main Application Backend

## 1. Overview & Service Ownership
- **Directory:** `MockPrep_Express/` (co-located in monorepo, excluded from frontend git tracking in root `.gitignore`).
- **Primary Framework:** Node.js (v22.16.0) + Express + TypeScript.
- **Role:** Main application gateway and primary backend service as defined in `AI_Project_Platform_Monorepo_Phased_Implementation_Guide.md`.
- **Current Phase:** Phase 5 (PostgreSQL Foundation & Schema Ownership) completed. Next up: Phase 6 (First Complete Vertical Slice: Project Creation).
- **Core Ownership:**
  - Application user profiles and organizations.
  - Projects and project ownership (`app.projects` table in Neon PostgreSQL).
  - Challenge lifecycle, acceptance criteria, and creator approvals.
  - Public `/api/v1/challenges/*` routing and delegation to FastAPI AI engine.
  - Interview sessions, invitations, and participant rosters.
  - Authoritative countdown timers and server timestamps (never trusts client clocks).
  - Application authorization and AI permission policy enforcement.
  - Submission lifecycle, audit events, and final evaluation reports.
  - Socket.IO gateway: session rooms, presence, timer sync, and relayed AI job updates.
  - PostgreSQL `app` schema writer.

## 2. Technology Stack & Planned Boundaries
- **Runtime:** Node.js v22.16.0
- **Language:** TypeScript 5
- **Web Framework:** Express 5
- **Architecture Style:** Strict Function-Based (No ES6 Classes, per EXDR-004)
- **Database Engine:** Neon PostgreSQL 17.11 (cloud PostgreSQL with SSL)
- **Database Access:** Pure functional `pg` client (`src/database/connection.ts`) with connection pooling, transactions, and functional repositories
- **Validation:** Type-safe DTOs & Express route validators
- **Realtime Gateway:** Socket.IO
- **Authentication:** Clerk Express SDK / JWT verification
- **Testing:** Vitest + Supertest
- **Service Integration:** Typed `FastApiClient` (`src/integrations/fastapi-client/`) with timeout, correlation ID, and secret token injection calling internal FastAPI endpoints (`MockPrep_FastAPI`)

## 3. Architecture Layout
```text
MockPrep_Express/
├── src/
│   ├── app.ts                  # Express application factory & middleware setup
│   ├── server.ts               # HTTP & Socket.IO server startup
│   ├── config/                 # Environment & typed configuration
│   ├── middleware/             # Auth, error handling, logging, validation
│   ├── routes/                 # Express route definitions
│   ├── modules/                # Feature modules (projects, challenges, sessions)
│   ├── services/               # Core business logic
│   ├── database/               # Database connection pool & migrations
│   ├── realtime/               # Socket.IO handlers & rooms
│   └── integrations/           # Client for communicating with FastAPI AI service
├── tests/
├── package.json
├── tsconfig.json
└── .gitignore
```
