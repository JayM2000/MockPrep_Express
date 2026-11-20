# Express API Context — Main Application Backend

## 1. Overview & Service Ownership
- **Directory:** `MockPrep_Express/` (co-located in monorepo, excluded from frontend git tracking in root `.gitignore`).
- **Primary Framework:** Node.js (v22.16.0) + Express + TypeScript.
- **Role:** Main application gateway and primary backend service as defined in `AI_Project_Platform_Monorepo_Phased_Implementation_Guide.md`.
- **Current Phase:** Phase 8 (Role-Based System, Project Visibility & Expiry) completed. Next up: Phase 9 (FastAPI AI heavy integration & challenge generation).
- **Core Ownership:**
  - Application user profiles, roles, and onboarding (`app.user_roles` table: 'candidate' | 'assessor').
  - Projects, project ownership, visibility, and expiry (`app.projects` table in Neon PostgreSQL).
  - Public `/api/v1/projects/*` endpoints for project CRUD, role checks, and candidate bookmarking.
  - Secret share link access via `/api/v1/shared/:shareToken` for private assessment sharing.
  - Candidate bookmarks (`app.project_bookmarks`) and session invites (`app.session_invites`).
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
- **Authentication:** Clerk Express SDK / JWT verification + Role middleware (`requireRole`)
- **Testing:** Vitest + Supertest (38 passing tests)
- **Service Integration:** Typed `FastApiClient` (`src/integrations/fastapi-client/`) with timeout, correlation ID, and secret token injection calling internal FastAPI endpoints (`MockPrep_FastAPI`)

## 3. Architecture Layout
```text
MockPrep_Express/
├── src/
│   ├── app.ts                  # Express application factory & middleware setup
│   ├── server.ts               # HTTP & Socket.IO server startup
│   ├── config/                 # Environment & typed configuration
│   ├── middleware/             # Auth, role check, error handling, validation
│   ├── routes/                 # Express route definitions (projects, users, shared, etc.)
│   ├── modules/                # Feature modules (projects, users)
│   ├── database/               # Database connection pool & migrations (001 - 005)
│   ├── utils/                  # Centralized path registries & token helpers
│   └── integrations/           # Client for communicating with FastAPI AI service
├── tests/                      # 38 integration & unit tests
├── package.json
├── tsconfig.json
└── .gitignore
```
