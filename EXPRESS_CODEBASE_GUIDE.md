# Complete Line-by-Line Guide to the MockPrep Express Backend

Welcome! This guide is written specifically for you as you learn backend development. It walks through **every single file** and **every single line of code** in the `MockPrep_Express` project built so far.

---

## 1. High-Level Overview: What is `MockPrep_Express`?

In our 3-tier architecture:
1. **Frontend (`Next.js 16`):** The visual interface that runs in the user's browser.
2. **Main Application Backend (`MockPrep_Express`):** The "command center" of the platform. It handles user authentication, stores projects in the database, controls interview timers, manages WebSocket rooms, and enforces security.
3. **AI Engine (`MockPrep_FastAPI`):** A specialized background microservice written in Python that generates challenges, injects bugs, and evaluates code using AI models.

### Key Principle: Strict Function-Based Architecture (No ES6 Classes)
Throughout this entire Express project, you will not see `class Database { ... }` or `class ProjectService { ... }`. Instead, we use **pure functions, factory functions, closures, and plain typed objects**. 

*Why?*
- In JavaScript, classes often lead to bugs with `this` binding (`this.something` being `undefined` inside callbacks).
- Functions are easier to read, test in isolation, and compose together.
- This style matches modern TypeScript and React hooks paradigms.

---

## 2. Directory Tree

```text
MockPrep_Express/
├── package.json                          # Dependencies & scripts
├── tsconfig.json                         # TypeScript compiler rules
├── src/
│   ├── server.ts                         # Entry point: HTTP port listener & graceful shutdown
│   ├── app.ts                            # Express application setup & middleware pipeline
│   ├── config/
│   │   └── env.ts                        # Environment variables loader & validator
│   ├── middleware/
│   │   └── error-handler.ts              # Custom error creator & global error handler
│   ├── database/
│   │   ├── connection.ts                 # PostgreSQL connection pool & query helpers
│   │   ├── migrate.ts                    # Migration runner for 'app' schema
│   │   └── migrations/
│   │       └── 001_create_projects.sql   # SQL migration creating app.projects table
│   ├── modules/
│   │   └── projects/
│   │       └── project.repository.ts     # Database functions for Project CRUD
│   ├── integrations/
│   │   └── fastapi-client/
│   │       ├── fastapi-client.ts         # HTTP client to talk to Python FastAPI
│   │       └── index.ts                  # Re-export entrypoint
│   ├── routes/
│   │   ├── health.routes.ts              # GET /health probe route
│   │   └── challenge.routes.ts           # POST /api/v1/challenges/generate & status route
│   ├── types/
│   │   ├── api.types.ts                  # Standard API envelope types
│   │   └── challenge.types.ts            # DTOs for challenge requests/responses
│   └── utils/
│       ├── health.paths.ts               # Health URL paths constants
│       ├── challenge.paths.ts            # Challenge URL paths constants
│       ├── api-paths.ts                  # Combined API path registry
│       └── index.ts                      # Barrel export for utils
└── tests/
    ├── health.test.ts                    # Vitest tests for health endpoints
    ├── fastapi-client.test.ts            # Vitest tests for FastAPI client with mocked fetch
    ├── challenge.routes.test.ts          # Supertest tests for challenge routes
    └── database.test.ts                  # Live integration tests with Neon PostgreSQL
```

---

## 3. Configuration & Root Files

### File: `package.json`

This file is the manifest for our Node.js project. It lists our project metadata, run scripts, and third-party packages.

```json
{
  "name": "mockprep-express-api",
  "version": "0.1.0",
  "description": "Main application backend for MockPrep platform",
  "main": "dist/server.js",
```
* **Lines 1–4:** Metadata naming our service and specifying version `0.1.0`.
* **Line 5 (`"main": "dist/server.js"`):** Specifies the compiled JavaScript file that Node runs when deployed to production.

```json
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "migrate:app": "tsx src/database/migrate.ts"
  },
```
* **Line 7 (`"dev"`):** Uses `tsx watch` to run our TypeScript code directly without manual compilation, automatically restarting whenever we save a file.
* **Line 8 (`"build"`):** Runs the TypeScript compiler (`tsc`) to turn `.ts` files into pure `.js` files inside the `dist/` folder.
* **Line 9 (`"start"`):** Starts the compiled production JavaScript code using standard Node.js.
* **Line 10 (`"test"`):** Runs our automated test suites once using Vitest.
* **Line 11 (`"typecheck"`):** Verifies that all TypeScript types are correct without writing any files to disk (`--noEmit`).
* **Line 12 (`"migrate:app"`):** Executes our database migration script (`migrate.ts`) to apply SQL changes to Neon PostgreSQL.

```json
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^18.0.9",
    "express": "^5.3.0",
    "pg": "^8.23.1"
  },
```
* **`cors`:** Cross-Origin Resource Sharing middleware. Allows our Next.js frontend (on port 3000) to make HTTP requests to Express (on port 4000).
* **`dotenv`:** Reads our secret `.env` file and loads the variables into `process.env`.
* **`express`:** The web server framework handling HTTP routes, requests, and responses (version 5.3).
* **`pg`:** The official PostgreSQL driver for Node.js to connect to Neon PostgreSQL.

```json
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node": "^26.6.6",
    "@types/pg": "^8.23.1",
    "@types/supertest": "^7.2.1",
    "supertest": "^7.3.1",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2",
    "vitest": "^5.1.0"
  }
}
```
* Packages starting with `@types/` provide TypeScript autocomplete and type definitions for libraries written in plain JavaScript.
* **`supertest`:** A tool for testing HTTP servers in-memory without needing to launch a real browser.
* **`tsx`:** A blazing-fast TypeScript executor based on esbuild.
* **`typescript`:** The TypeScript compiler.
* **`vitest`:** A modern, fast unit and integration test runner.

---

### File: `tsconfig.json`

Tells the TypeScript compiler how to compile our TypeScript code.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```
* **`target: "ES2022"`:** Compiles code to modern ECMAScript 2022 standard.
* **`module: "NodeNext"` & `moduleResolution: "NodeNext"`:** Uses Node's official native ECMAScript Module (ESM) resolution.
* **`rootDir: "./src"` & `outDir: "./dist"`:** Reads TypeScript from `./src` and writes compiled JavaScript into `./dist`.
* **`strict: true`:** Enables all strict type-checking flags (prevents subtle bugs, requires explicit types).
* **`esModuleInterop: true`:** Allows smooth importing of CommonJS packages as if they were ES modules.
* **`skipLibCheck: true`:** Skips type-checking `.d.ts` files inside `node_modules` to keep builds fast.
* **`include` & `exclude`:** Tells TypeScript to only compile files in `src/` and ignore `node_modules`, `dist`, and test files during production build.

---

## 4. Environment & Configuration

### File: `src/config/env.ts`

Loads and validates environment variables so we never have `undefined` surprises at runtime.

```typescript
1: import dotenv from "dotenv"
2: 
3: // Load environment variables from .env file
4: dotenv.config()
```
* **Lines 1–4:** Imports `dotenv` and immediately calls `dotenv.config()`. This parses the `.env` file on disk and copies its key-value pairs into Node's global `process.env`.

```typescript
6: export interface EnvConfig {
7:   PORT: number
8:   NODE_ENV: "development" | "production" | "test"
9:   CORS_ORIGIN: string
10:   FASTAPI_BASE_URL: string
11:   INTERNAL_SERVICE_TOKEN: string
12:   DATABASE_URL: string
13: }
```
* **Lines 6–13:** Defines a TypeScript `interface` called `EnvConfig`. This guarantees our application code knows exactly what type each configuration variable has (e.g., `PORT` is guaranteed to be a `number`, not a `string`).

```typescript
15: export const env: EnvConfig = {
16:   PORT: Number(process.env.PORT) || 4000,
17:   NODE_ENV: (process.env.NODE_ENV as EnvConfig["NODE_ENV"]) || "development",
18:   CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
19:   FASTAPI_BASE_URL: process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000",
20:   INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN!,
21:   DATABASE_URL: process.env.DATABASE_URL!,
22: }
```
* **Line 16:** Converts `process.env.PORT` to a number. If not provided, it falls back to port `4000`.
* **Line 17:** Defaults the environment to `"development"` if not set.
* **Line 18:** Defaults `CORS_ORIGIN` to the Next.js frontend port `http://localhost:3000`.
* **Line 19:** Points to the Python FastAPI microservice at `http://127.0.0.1:8000`.
* **Line 20 (`INTERNAL_SERVICE_TOKEN`):** The shared secret token. Strictly loaded from `.env` without a fallback default.
* **Line 21 (`DATABASE_URL`):** Reads the Neon PostgreSQL connection string strictly from `.env`. The exclamation mark `!` asserts that this secret must be present.

---

## 5. Server Lifecycle & Application Setup

### File: `src/server.ts`

This is the process entrypoint. It starts the network server and listens for incoming connections.

```typescript
1: import { app } from "./app"
2: import { env } from "./config/env"
```
* Imports our configured Express application and validated environment object.

```typescript
4: const server = app.listen(env.PORT, () => {
5:   console.log(`[Express API] Server running in ${env.NODE_ENV} mode on port ${env.PORT}`)
6:   console.log(`[Express API] Health check endpoint: http://localhost:${env.PORT}/health`)
7: })
```
* **Line 4:** Calls `app.listen()`, which tells the operating system: *"Open network port 4000 and direct incoming HTTP traffic to our Express app."*
* **Lines 5–6:** Prints confirmation messages in the terminal with the running port and health endpoint URL.

```typescript
9: // Graceful shutdown handling
10: process.on("SIGTERM", () => {
11:   console.log("[Express API] SIGTERM received, closing HTTP server...")
12:   server.close(() => {
13:     console.log("[Express API] HTTP server closed cleanly.")
14:   })
15: })
16: 
17: process.on("SIGINT", () => {
18:   console.log("[Express API] SIGINT received, shutting down...")
19:   server.close(() => {
20:     console.log("[Express API] HTTP server closed.")
21:     process.exit(0)
22:   })
23: })
```
* **Lines 9–23:** Handles **Graceful Shutdown**:
  * `SIGTERM` is the signal cloud providers (Docker, Kubernetes, AWS) send when they want to stop or redeploy your container.
  * `SIGINT` is the signal sent when you press `Ctrl + C` in your terminal.
  * Instead of abruptly killing the process in the middle of writing a database query, `server.close()` finishes any currently active HTTP requests first and then exits cleanly (`process.exit(0)`).

---

### File: `src/app.ts`

This file builds and configures the Express application pipeline (middleware and routes).

```typescript
1: import express, { Application, Request, Response } from "express"
2: import cors from "cors"
3: import { env } from "./config/env"
4: import { healthRouter } from "./routes/health.routes"
5: import { challengeRouter } from "./routes/challenge.routes"
6: import { errorHandler, createAppError } from "./middleware/error-handler"
7: import { HEALTH_PATHS, CHALLENGE_PATHS } from "./utils"
```
* Imports Express, CORS, our routes, error handler, and centralized URL path constants.

```typescript
9: /**
10:  * Creates and configures the Express application.
11:  * Keeping this factory separate from server.listen() allows running fast unit/integration
12:  * tests with Supertest without occupying a real TCP port.
13:  */
14: export function createApp(): Application {
15:   const app: Application = express()
```
* **Lines 14–15:** The `createApp()` **factory function**:
  * *Why a function instead of a global object?* If `server.ts` directly created and listened to the app, automated tests would have to bind to real TCP ports (which causes port conflict errors like `EADDRINUSE`). By keeping `createApp()` as a factory function, tests can spin up an in-memory test instance instantly!

```typescript
17:   // Standard middleware
18:   app.use(
19:     cors({
20:       origin: env.CORS_ORIGIN,
21:       credentials: true,
22:     })
23:   )
24:   app.use(express.json())
```
* **Lines 18–23:** Configures `cors` to allow requests coming from our frontend (`localhost:3000`) and permits cookies/credentials.
* **Line 24 (`app.use(express.json())`):** Express body-parser middleware. When a client sends a `POST` request with JSON data (`Content-Type: application/json`), this converts that raw network text stream into a handy JavaScript object accessible at `req.body`.

```typescript
26:   // Route registration
27:   app.use(HEALTH_PATHS.BASE, healthRouter)
28:   app.use(CHALLENGE_PATHS.BASE, challengeRouter)
```
* **Line 27:** Mounts `healthRouter` under `/health`.
* **Line 28:** Mounts `challengeRouter` under `/api/v1/challenges`.

```typescript
30:   // 404 handler for undefined routes
31:   app.use((req: Request, res: Response, next) => {
32:     next(createAppError(`Cannot ${req.method} ${req.originalUrl}`, 404))
33:   })
```
* **Lines 31–33:** The **Catch-All 404 Handler**:
  * If a request does not match `/health` or `/api/v1/challenges`, it falls down to this middleware.
  * It creates an `AppError` with status `404` and passes it to `next(...)`. In Express, passing an argument to `next()` tells Express to skip all other regular middleware and jump directly to the error handler.

```typescript
35:   // Centralized error handler (must be registered last)
36:   app.use(errorHandler)
37: 
38:   return app
39: }
40: 
41: export const app = createApp()
```
* **Line 36:** Registers our centralized error handler. **Rule of Express:** The error handler must always be registered last!
* **Line 41:** Exports a pre-built singleton instance of `app` for convenience.

---

## 6. Error Handling

### File: `src/middleware/error-handler.ts`

Manages error formatting and status codes without using ES6 classes.

```typescript
1: import { Request, Response, NextFunction } from "express"
2: 
3: /**
4:  * Custom application error interface.
5:  */
6: export interface AppError extends Error {
7:   statusCode: number
8:   isOperational: boolean
9: }
```
* **Lines 6–9:** Defines `AppError`. It extends JavaScript's standard `Error` type by adding:
  * `statusCode`: The HTTP status code to return (e.g., 400 for Bad Request, 404 for Not Found, 500 for Server Error).
  * `isOperational`: Set to `true` for expected operational errors (like invalid user input), or `false` for unexpected programming bugs (like null pointer exceptions).

```typescript
11: /**
12:  * Functional factory to create application errors with HTTP status codes.
13:  * Adheres strictly to the project's function-based approach (no ES6 classes).
14:  */
15: export function createAppError(
16:   message: string,
17:   statusCode: number = 500,
18:   isOperational: boolean = true
19: ): AppError {
20:   const error = new Error(message) as AppError
21:   error.name = "AppError"
22:   error.statusCode = statusCode
23:   error.isOperational = isOperational
24:   return error
25: }
```
* **Lines 15–25:** The `createAppError()` **factory function**:
  * Instead of `class AppError extends Error { constructor(...) }`, this function instantiates a standard `Error`, attaches our extra properties, and returns it.
  * Clean, simple, and strictly adheres to our function-based rule.

```typescript
27: /**
28:  * Functional type guard to determine if an unknown error is an AppError.
29:  */
30: export function isAppError(err: unknown): err is AppError {
31:   return (
32:     typeof err === "object" &&
33:     err !== null &&
34:     "statusCode" in err &&
35:     typeof (err as AppError).statusCode === "number"
36:   )
37: }
```
* **Lines 30–37:** A TypeScript **Type Guard**:
  * In TypeScript, caught errors in `catch (err)` have type `unknown`.
  * This function inspects the error object at runtime. If it has a numeric `statusCode`, TypeScript will treat `err` as `AppError` inside the block, giving us safe autocomplete.

```typescript
40: /**
41:  * Centralized Express error-handling middleware.
42:  * Express identifies an error middleware by its 4 arguments: (err, req, res, next).
43:  */
44: export function errorHandler(
45:   err: Error | AppError,
46:   req: Request,
47:   res: Response,
48:   // eslint-disable-next-line @typescript-eslint/no-unused-vars
49:   next: NextFunction
50: ): void {
51:   const statusCode = isAppError(err) ? err.statusCode : 500
52:   const message = err.message || "Internal server error"
53: 
54:   // Log server errors for diagnosis
55:   if (statusCode >= 500) {
56:     console.error(`[ERROR] ${req.method} ${req.url}:`, err)
57:   }
58: 
59:   res.status(statusCode).json({
60:     error: {
61:       message,
62:       statusCode,
63:       ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
64:     },
65:   })
66: }
```
* **Lines 44–50:** Notice the four parameters `(err, req, res, next)`. In Express, having exactly four arguments is how Express recognizes an **error-handling middleware**.
* **Line 51:** If `err` is our custom `AppError`, it extracts its `statusCode`. If it's a generic unexpected error, it defaults to `500` (Internal Server Error).
* **Lines 55–57:** If it's a `500` server crash, it logs the full error to the terminal so we can debug it.
* **Lines 59–65:** Sends a clean, standardized JSON response to the user. In development mode (`NODE_ENV === "development"`), it includes `err.stack` so we can see the exact file and line number that threw the error.

---

## 7. Database Layer (Neon PostgreSQL)

### File: `src/database/connection.ts`

Manages our connection pool to Neon PostgreSQL.

```typescript
1: import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg"
2: import { env } from "../config/env"
3: import { createAppError } from "../middleware/error-handler"
4: 
5: let poolInstance: Pool | null = null
```
* Imports the official Node.js PostgreSQL driver types and creates a module-level variable `poolInstance` to store our shared connection pool.

```typescript
7: /**
8:  * Initializes or retrieves the PostgreSQL connection pool.
9:  * Implemented functionally as a singleton closure.
10:  */
11: export function getDbPool(): Pool {
12:   if (!poolInstance) {
13:     const isSsl = env.DATABASE_URL.includes("sslmode=require") || env.NODE_ENV === "production"
14:     poolInstance = new Pool({
15:       connectionString: env.DATABASE_URL,
16:       ssl: isSsl ? { rejectUnauthorized: false } : undefined,
17:       max: 10,
18:       idleTimeoutMillis: 30000,
19:       connectionTimeoutMillis: 10000,
20:     })
21: 
22:     poolInstance.on("error", (err) => {
23:       console.error("[PostgreSQL Pool Error]:", err.message)
24:     })
25:   }
26: 
27:   return poolInstance
28: }
```
* **Lines 11–28:** `getDbPool()`:
  * Uses the **Singleton Pattern**: Only one pool of connections is created and shared across the entire app.
  * `ssl: { rejectUnauthorized: false }`: Neon PostgreSQL requires SSL encryption across the internet.
  * `max: 10`: Keeps at most 10 database connections open at once.
  * `idleTimeoutMillis: 30000`: Closes any connection that hasn't been used for 30 seconds.
  * `connectionTimeoutMillis: 10000`: If Neon doesn't respond within 10 seconds, it aborts instead of hanging forever.

```typescript
34: export async function query<T extends QueryResultRow = any>(
35:   text: string,
36:   params: any[] = []
37: ): Promise<QueryResult<T>> {
38:   const pool = getDbPool()
39:   try {
40:     return await pool.query<T>(text, params)
41:   } catch (err: any) {
42:     throw createAppError(`Database query error: ${err.message}`, 500)
43:   }
44: }
```
* **Lines 34–44:** The `query()` helper:
  * Executes a SQL query against the pool.
  * Accepts `text` (the SQL command) and `params` (an array of values).
  * **Critical Security:** Using `$1, $2` parameters with `params` ensures values are safely escaped, completely preventing SQL injection attacks!

```typescript
46: /**
47:  * Executes a callback within a managed transaction.
48:  * Issues BEGIN, executes operations, then COMMITs or ROLLBACKs on failure.
49:  */
50: export async function withTransaction<T>(
51:   callback: (client: PoolClient) => Promise<T>
52: ): Promise<T> {
53:   const pool = getDbPool()
54:   const client = await pool.connect()
55: 
56:   try {
57:     await client.query("BEGIN")
58:     const result = await callback(client)
59:     await client.query("COMMIT")
60:     return result
61:   } catch (err) {
62:     await client.query("ROLLBACK")
63:     throw err
64:   } finally {
65:     client.release()
66:   }
67: }
```
* **Lines 50–67:** The `withTransaction()` helper:
  * In a database, a **Transaction** means multiple SQL operations succeed together or fail together (ACID compliance).
  * Borrows a dedicated client from the pool (`pool.connect()`).
  * Runs `BEGIN` to start the transaction.
  * Runs your custom operations via `callback(client)`.
  * If successful, runs `COMMIT` (saves permanently).
  * If any step fails, jumps to `catch` and runs `ROLLBACK` (reverts everything back as if nothing happened).
  * `finally { client.release() }`: Guarantees the client connection is handed back to the pool no matter what.

```typescript
72: export async function checkDbHealth(): Promise<boolean> {
73:   try {
74:     const res = await query("SELECT 1 AS healthy")
75:     return res.rows.length > 0 && res.rows[0].healthy === 1
76:   } catch {
77:     return false
78:   }
79: }
```
* **Lines 72–79:** Runs a tiny query (`SELECT 1 AS healthy`) to verify that the database is reachable.

```typescript
84: export async function closeDbPool(): Promise<void> {
85:   if (poolInstance) {
86:     await poolInstance.end()
87:     poolInstance = null
88:   }
89: }
```
* **Lines 84–89:** Closes all open connections in the pool. Used in test teardowns and server shutdown.

---

### File: `src/database/migrations/001_create_projects.sql`

The SQL migration script creating the `app.projects` table in Neon PostgreSQL.

```sql
1: -- Migration: 001_create_projects.sql
2: -- Establishes the isolated 'app' schema and the 'projects' table owned by Express.
3: 
4: CREATE SCHEMA IF NOT EXISTS app;
```
* **Line 4:** Creates the `app` schema namespace if it doesn't already exist.

```sql
6: CREATE TABLE IF NOT EXISTS app.projects (
7:   id VARCHAR(64) PRIMARY KEY,
8:   name VARCHAR(255) NOT NULL,
9:   description TEXT,
10:   difficulty VARCHAR(32) NOT NULL DEFAULT 'medium',
11:   tech_stack TEXT[] NOT NULL DEFAULT '{}',
12:   repository_url VARCHAR(512),
13:   created_by VARCHAR(128) NOT NULL,
14:   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
15:   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
16: );
```
* **Line 7 (`id`):** Unique project identifier (e.g., `proj_123` or UUID).
* **Line 8 (`name`):** Human-readable project title (cannot be empty).
* **Line 9 (`description`):** Optional detailed overview of the project.
* **Line 10 (`difficulty`):** e.g., 'easy', 'medium', 'hard'.
* **Line 11 (`tech_stack TEXT[]`):** PostgreSQL native array of strings (e.g. `{"Next.js", "Express", "PostgreSQL"}`).
* **Line 12 (`repository_url`):** Optional GitHub/GitLab repository URL.
* **Line 13 (`created_by`):** User ID of the creator (from Clerk auth).
* **Lines 14–15 (`created_at`, `updated_at`):** Timestamps with timezone (`TIMESTAMPTZ`), defaulting to the current time (`NOW()`).

```sql
18: CREATE INDEX IF NOT EXISTS idx_projects_created_by ON app.projects(created_by);
```
* **Line 18:** Creates a database **Index** on `created_by`. When a user loads their dashboard, the database can find all projects belonging to them in milliseconds instead of scanning through millions of rows.

---

### File: `src/database/migrate.ts`

The migration runner script.

```typescript
1: import fs from "node:fs"
2: import path from "node:path"
3: import { query, closeDbPool } from "./connection"
```
* Imports Node's built-in file system (`fs`) and path utilities, plus our `query` helper.

```typescript
9: export async function runMigrations(): Promise<void> {
10:   console.log("[Migration] Running Express 'app' schema migrations...")
11: 
12:   const migrationsDir = path.resolve(process.cwd(), "src/database/migrations")
13:   const files = fs
14:     .readdirSync(migrationsDir)
15:     .filter((file) => file.endsWith(".sql"))
16:     .sort()
17: 
18:   for (const file of files) {
19:     const filePath = path.join(migrationsDir, file)
20:     const sql = fs.readFileSync(filePath, "utf-8")
21:     console.log(`[Migration] Applying ${file}...`)
22:     await query(sql)
23:     console.log(`[Migration] Successfully applied ${file}`)
24:   }
25: 
26:   console.log("[Migration] All 'app' schema migrations applied successfully.")
27: }
```
* **Lines 12–16:** Finds all `.sql` files in `src/database/migrations/` and sorts them alphabetically (so `001_` runs before `002_`).
* **Lines 18–24:** Loops through each SQL file, reads its raw SQL text, and executes it via `query(sql)`.

```typescript
30: if (process.argv[1]?.includes("migrate")) {
31:   runMigrations()
32:     .then(async () => {
33:       await closeDbPool()
34:       process.exit(0)
35:     })
36:     .catch(async (err) => {
37:       console.error("[Migration Error]:", err)
38:       await closeDbPool()
39:       process.exit(1)
40:     })
41: }
```
* **Lines 30–41:** Allows running the script from the command line (`npm run migrate:app`). When executed directly, it runs migrations, closes the database pool cleanly, and exits.

---

## 8. Feature Modules (Projects)

### File: `src/modules/projects/project.repository.ts`

Pure functional database access layer for Projects.

```typescript
1: import { query } from "../../database/connection"
2: 
3: export interface Project {
4:   id: string
5:   name: string
6:   description: string | null
7:   difficulty: "easy" | "medium" | "hard"
8:   tech_stack: string[]
9:   repository_url: string | null
10:   created_by: string
11:   created_at: Date
12:   updated_at: Date
13: }
14: 
15: export type NewProject = Omit<Project, "created_at" | "updated_at"> & {
16:   created_at?: Date
17:   updated_at?: Date
18: }
```
* **Lines 3–13:** Defines the `Project` type representing a row returned from PostgreSQL.
* **Lines 15–18:** Defines `NewProject`. It uses TypeScript's `Omit` utility to say: *"A new project has all the fields of Project, except created_at and updated_at are optional because the database assigns them automatically."*

```typescript
24: export async function createProject(newProject: NewProject): Promise<Project> {
25:   const sql = `
26:     INSERT INTO app.projects (
27:       id, name, description, difficulty, tech_stack, repository_url, created_by
28:     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
29:     RETURNING *;
30:   `
31:   const params = [
32:     newProject.id,
33:     newProject.name,
34:     newProject.description || null,
35:     newProject.difficulty || "medium",
36:     newProject.tech_stack || [],
37:     newProject.repository_url || null,
38:     newProject.created_by,
39:   ]
40: 
41:   const result = await query<Project>(sql, params)
42:   return result.rows[0]
43: }
```
* **Lines 24–43 (`createProject`):**
  * Runs an `INSERT INTO app.projects` statement.
  * `RETURNING *;`: In PostgreSQL, this tells the database to immediately return the newly inserted row (including its database-generated timestamps).

```typescript
48: export async function findProjectById(id: string): Promise<Project | null> {
49:   const sql = `SELECT * FROM app.projects WHERE id = $1 LIMIT 1;`
50:   const result = await query<Project>(sql, [id])
51:   return result.rows[0] || null
52: }
```
* **Lines 48–52 (`findProjectById`):** Finds a project by its ID, returning `null` if not found.

```typescript
57: export async function listProjects(limit: number = 20, offset: number = 0): Promise<Project[]> {
58:   const sql = `
59:     SELECT * FROM app.projects
60:     ORDER BY created_at DESC
61:     LIMIT $1 OFFSET $2;
62:   `
63:   const result = await query<Project>(sql, [limit, offset])
64:   return result.rows
65: }
```
* **Lines 57–65 (`listProjects`):** Returns a paginated list of projects ordered newest-first (`ORDER BY created_at DESC`).

```typescript
70: export async function deleteProject(id: string): Promise<boolean> {
71:   const sql = `DELETE FROM app.projects WHERE id = $1;`
72:   const result = await query(sql, [id])
73:   return (result.rowCount ?? 0) > 0
74: }
```
* **Lines 70–74 (`deleteProject`):** Deletes a project by ID and returns `true` if a row was deleted.

---

## 9. Service-to-Service Integration (FastAPI Client)

### File: `src/integrations/fastapi-client/fastapi-client.ts`

A function-based HTTP client to talk securely with the Python FastAPI microservice.

```typescript
1: import { randomUUID } from "node:crypto"
2: import { env } from "../../config/env"
3: import { createAppError, isAppError } from "../../middleware/error-handler"
4: import {
5:   ChallengeGenerateRequest,
6:   ChallengeJobResponse,
7: } from "../../types/challenge.types"
8: import { CHALLENGE_PATHS } from "../../utils/challenge.paths"
```
* Imports Node's crypto library for generating trace IDs, environment settings, error helpers, and challenge types.

```typescript
19: export interface FastApiClient {
20:   readonly baseUrl: string
21:   readonly timeoutMs: number
22:   checkHealth: () => Promise<boolean>
23:   generateChallenge: (
24:     payload: ChallengeGenerateRequest,
25:     correlationId?: string
26:   ) => Promise<ChallengeJobResponse>
27:   getChallengeJob: (
28:     jobId: string,
29:     correlationId?: string
30:   ) => Promise<ChallengeJobResponse>
31: }
```
* **Lines 19–31:** Defines the client interface.

```typescript
37: export function createFastApiClient(
38:   options: FastApiClientOptions = {}
39: ): FastApiClient {
40:   const baseUrl = (options.baseUrl || env.FASTAPI_BASE_URL).replace(/\/$/, "")
41:   const serviceToken = options.serviceToken || env.INTERNAL_SERVICE_TOKEN
42:   const timeoutMs = options.timeoutMs ?? 10000
```
* **Lines 37–42:** `createFastApiClient` **factory function**:
  * Strips any trailing slash from `baseUrl`.
  * Injects `INTERNAL_SERVICE_TOKEN`.
  * Sets default timeout to `10,000` milliseconds (10 seconds).

```typescript
47:   async function request<T>(
48:     endpoint: string,
49:     fetchOptions: RequestInit = {},
50:     correlationId?: string
51:   ): Promise<T> {
52:     const url = `${baseUrl}${endpoint}`
53:     const controller = new AbortController()
54:     const timer = setTimeout(() => controller.abort(), timeoutMs)
55: 
56:     const headers: Record<string, string> = {
57:       "Content-Type": "application/json",
58:       "X-Service-Token": serviceToken,
59:       "X-Correlation-ID": correlationId || randomUUID(),
60:       ...((fetchOptions.headers as Record<string, string>) || {}),
61:     }
```
* **Lines 47–61:** The private `request()` closure:
  * Uses Node 22's native `AbortController` and `setTimeout` to abort the HTTP request if FastAPI takes longer than 10 seconds.
  * Injects `X-Service-Token` (proves to FastAPI that the caller is Express, not an untrusted browser).
  * Injects `X-Correlation-ID` (a unique tracking ID to trace a single request across both backend services in logs).

```typescript
63:     try {
64:       const response = await fetch(url, {
65:         ...fetchOptions,
66:         headers,
67:         signal: controller.signal,
68:       })
69: 
70:       clearTimeout(timer)
71: 
72:       if (!response.ok) {
73:         let errorMessage = `FastAPI error: HTTP ${response.status} ${response.statusText}`
74:         try {
75:           const errorJson = (await response.json()) as Record<string, any>
76:           if (errorJson?.detail) {
77:             errorMessage =
78:               typeof errorJson.detail === "string"
79:                 ? errorJson.detail
80:                 : JSON.stringify(errorJson.detail)
81:           } else if (errorJson?.error?.message) {
82:             errorMessage = errorJson.error.message
83:           }
84:         } catch {
85:           // If response body is not JSON, retain default status text message
86:         }
87: 
88:         throw createAppError(errorMessage, response.status)
89:       }
90: 
91:       return (await response.json()) as T
```
* **Lines 63–91:** Calls native `fetch`. If FastAPI returns a non-200 status (e.g. 401, 422), it parses FastAPI's `detail` error message and translates it into an Express `AppError`.

```typescript
92:     } catch (err: any) {
93:       clearTimeout(timer)
94: 
95:       if (isAppError(err)) {
96:         throw err
97:       }
98: 
99:       if (err.name === "AbortError") {
100:         throw createAppError(
101:           `FastAPI service request timed out after ${timeoutMs}ms`,
102:           504
103:         )
104:       }
105: 
106:       throw createAppError(
107:         `Failed to communicate with AI service: ${err.message || "Unknown error"}`,
108:         503
109:       )
110:     }
111:   }
```
* **Lines 92–111:** Error normalization:
  * If the request timed out (`err.name === "AbortError"`), returns HTTP `504 Gateway Timeout`.
  * If FastAPI is down or refused connection, returns HTTP `503 Service Unavailable`.

```typescript
116:   async function checkHealth(): Promise<boolean> { ... }
131:   async function generateChallenge(...) { ... }
148:   async function getChallengeJob(...) { ... }
159:   return { baseUrl, timeoutMs, checkHealth, generateChallenge, getChallengeJob }
166: }
171: export const fastApiClient = createFastApiClient()
```
* **Lines 116–171:** Exposes the domain methods and exports a default singleton `fastApiClient`.

---

## 10. Routes

### File: `src/routes/health.routes.ts`

The liveness probe route.

```typescript
1: import { Router, Request, Response } from "express"
2: import { HEALTH_PATHS } from "../utils/health.paths"
3: 
4: export const healthRouter = Router()
5: 
6: healthRouter.get(HEALTH_PATHS.ROOT, (req: Request, res: Response) => {
7:   res.status(200).json({
8:     status: "ok",
9:     service: "mockprep-express-api",
10:     timestamp: new Date().toISOString(),
11:     uptimeSeconds: Math.floor(process.uptime()),
12:     environment: process.env.NODE_ENV || "development",
13:   })
14: })
```
* Responds to `GET /health` with HTTP 200, current server uptime in seconds, and environment.

---

### File: `src/routes/challenge.routes.ts`

Exposes endpoints for challenge generation and job polling.

```typescript
14: challengeRouter.post(
15:   CHALLENGE_PATHS.GENERATE,
16:   async (req: Request, res: Response, next: NextFunction) => {
17:     try {
18:       const body = req.body as Partial<ChallengeGenerateRequest>
19: 
20:       // Validate required contract fields
21:       if (!body.projectId || typeof body.projectId !== "string") {
22:         throw createAppError("Field 'projectId' is required and must be a string", 400)
23:       }
24:       if (!body.projectName || typeof body.projectName !== "string") {
25:         throw createAppError("Field 'projectName' is required and must be a string", 400)
26:       }
27:       if (!body.codeSummary || typeof body.codeSummary !== "string") {
28:         throw createAppError("Field 'codeSummary' is required and must be a string", 400)
29:       }
```
* **Lines 14–29 (`POST /api/v1/challenges/generate`):**
  * Validates that the client provided `projectId`, `projectName`, and `codeSummary`.
  * If missing, immediately throws a `400 Bad Request` before wasting any time calling the AI service.

```typescript
31:       const correlationId = (req.headers["x-correlation-id"] as string) || undefined
32: 
33:       const jobResponse = await fastApiClient.generateChallenge({ ... }, correlationId)
34: 
35:       res.status(202).json(jobResponse)
36:     } catch (error) {
37:       next(error)
38:     }
39:   }
40: )
```
* **Lines 31–40:**
  * Extracts any incoming correlation ID from request headers.
  * Calls `fastApiClient.generateChallenge()`.
  * Responds with **HTTP 202 Accepted** containing the `jobId`. AI challenge creation takes 10–30 seconds, so returning 202 Accepted immediately lets the client know the job is queued without blocking.

```typescript
57: challengeRouter.get(
58:   CHALLENGE_PATHS.JOB_BY_ID,
59:   async (req: Request, res: Response, next: NextFunction) => {
60:     try {
61:       const rawJobId = req.params.jobId
62:       const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId
63:       if (!jobId) {
64:         throw createAppError("Parameter 'jobId' is required", 400)
65:       }
66: 
67:       const correlationId = (req.headers["x-correlation-id"] as string) || undefined
68:       const job = await fastApiClient.getChallengeJob(jobId, correlationId)
69: 
70:       res.status(200).json(job)
71:     } catch (error) {
72:       next(error)
73:     }
74:   }
75: )
```
* **Lines 57–75 (`GET /api/v1/challenges/jobs/:jobId`):**
  * Express 5 allows params to be arrays, so line 62 safely extracts `jobId`.
  * Asks FastAPI for the current job progress (`queued`, `processing`, or `completed`) and returns it to the caller.

---

## 11. Centralized Paths & Utils

To avoid bugs caused by typos in URL strings (e.g., someone writing `api/v1/challenges` instead of `/api/v1/challenges`), all endpoints are stored in single source-of-truth constants:

### File: `src/utils/challenge.paths.ts`

```typescript
export const CHALLENGE_PATHS = {
  BASE: "/api/v1/challenges",
  GENERATE: "/generate",
  JOB_BY_ID: "/jobs/:jobId",
  full: {
    GENERATE: "/api/v1/challenges/generate",
    jobById: (jobId: string) => `/api/v1/challenges/jobs/${encodeURIComponent(jobId)}`,
  },
  FASTAPI: {
    HEALTH: "/health",
    GENERATE: "/internal/v1/challenges/generate",
    jobById: (jobId: string) => `/internal/v1/challenges/jobs/${encodeURIComponent(jobId)}`,
  },
} as const
```
* The `as const` modifier tells TypeScript that these strings are immutable constants.
* Contains both Express routes and the internal FastAPI paths.

---

## 12. Automated Test Suite (Vitest)

We have four automated test files that verify our code:

1. **`tests/health.test.ts` (2 tests):**
   * Calls `GET /health` via Supertest and verifies HTTP `200` with status `"ok"`.
   * Calls a non-existent route (`GET /non-existent-route`) and verifies HTTP `404` with our structured `AppError`.
2. **`tests/fastapi-client.test.ts` (4 tests):**
   * Mocks global `fetch` to verify that `FastApiClient` sends `X-Service-Token` and `X-Correlation-ID`.
   * Verifies that FastAPI `401 Unauthorized` gets translated into an Express `AppError`.
   * Verifies that network drops translate into HTTP `503`.
   * Verifies `getChallengeJob` parses responses.
3. **`tests/challenge.routes.test.ts` (3 tests):**
   * Tests `POST /api/v1/challenges/generate` validation (returns `400` when body is empty).
   * Mocks `FastApiClient.generateChallenge` and verifies Express returns HTTP `202 Accepted` with `jobId`.
   * Tests `GET /api/v1/challenges/jobs/:jobId` and verifies HTTP `200`.
4. **`tests/database.test.ts` (2 tests):**
   * **Live Cloud Test:** Actually connects to Neon PostgreSQL.
   * Runs `checkDbHealth()` (passes).
   * Runs a complete CRUD lifecycle: inserts a real project into `app.projects`, reads it back to confirm its fields, deletes it, and confirms it is gone.

---

## 13. End-to-End Request Flow Diagram

Here is what happens when a request comes in:

```text
1. Client (Browser / Next.js)
   │
   ▼
2. server.ts  ──► Listens on port 4000
   │
   ▼
3. app.ts (createApp Pipeline)
   ├── cors()                  (Checks allowed origin: localhost:3000)
   ├── express.json()          (Parses JSON body text into JavaScript object)
   │
   ├── [Matches /health]       ──► health.routes.ts ──► Returns HTTP 200 OK
   │
   ├── [Matches /api/v1/challenges] ──► challenge.routes.ts
   │                                     ├── Validates body fields (Throws 400 if invalid)
   │                                     ├── Calls fastApiClient.generateChallenge()
   │                                     │     └── Fetch to FastAPI :8000 with X-Service-Token
   │                                     └── Returns HTTP 202 Accepted { jobId }
   │
   ├── [No Route Matched]      ──► 404 Handler (Throws AppError 404)
   │
   ▼
4. error-handler.ts            ──► Formats any thrown error into { error: { message, statusCode } }
```
