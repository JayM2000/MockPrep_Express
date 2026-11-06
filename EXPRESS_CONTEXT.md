# Express API Context — Main Application Backend

## 1. Overview & Service Ownership
- **Directory:** `MockPrep_Express/` (co-located in monorepo, excluded from frontend git tracking in root `.gitignore`).
- **Primary Framework:** Node.js (v22.16.0) + Express + TypeScript.
- **Role:** Main application gateway and primary backend service as defined in `AI_Project_Platform_Monorepo_Phased_Implementation_Guide.md`.
- **Current Phase:** Phase 2 (Express API Initialization & Health Endpoint) completed. Next up: Phase 3 (FastAPI AI Service Initialization).
- **Core Ownership:**
  - Application user profiles and organizations.
  - Projects and project ownership.
  - Challenge lifecycle, acceptance criteria, and creator approvals.
  - Interview sessions, invitations, and participant rosters.
  - Authoritative countdown timers and server timestamps (never trusts client clocks).
  - Application authorization and AI permission policy enforcement.
  - Submission lifecycle, audit events, and final evaluation reports.
  - Socket.IO gateway: session rooms, presence, timer sync, and relayed AI job updates.
  - PostgreSQL `app` schema writer.

## 2. Technology Stack & Planned Boundaries
- **Runtime:** Node.js v22.16.0
- **Language:** TypeScript 5
- **Web Framework:** Express 4 / 5
- **Validation:** Zod schemas
- **Realtime Gateway:** Socket.IO
- **Database Access:** PostgreSQL client (`pg` / Prisma / Kysely for `app` schema)
- **Authentication:** Clerk Express SDK / JWT verification
- **Testing:** Vitest / Jest + Supertest
- **Service Integration:** Typed HTTP client calling internal FastAPI endpoints (`MockPrep_BE`)

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
