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
