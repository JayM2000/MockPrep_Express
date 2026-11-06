import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg"
import { env } from "../config/env"
import { createAppError } from "../middleware/error-handler"

let poolInstance: Pool | null = null

/**
 * Initializes or retrieves the PostgreSQL connection pool.
 * Implemented functionally as a singleton closure.
 */
export function getDbPool(): Pool {
  if (!poolInstance) {
    const isSsl = env.DATABASE_URL.includes("sslmode=require") || env.NODE_ENV === "production"
    poolInstance = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    poolInstance.on("error", (err) => {
      console.error("[PostgreSQL Pool Error]:", err.message)
    })
  }

  return poolInstance
}

/**
 * Executes a parameterized SQL query using the connection pool.
 * Guarantees connection checkout and return to the pool.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const pool = getDbPool()
  try {
    return await pool.query<T>(text, params)
  } catch (err: any) {
    throw createAppError(`Database query error: ${err.message}`, 500)
  }
}

/**
 * Executes a callback within a managed transaction.
 * Issues BEGIN, executes operations, then COMMITs or ROLLBACKs on failure.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool()
  const client = await pool.connect()

  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

/**
 * Verifies database liveness by running a lightweight query.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const res = await query("SELECT 1 AS healthy")
    return res.rows.length > 0 && res.rows[0].healthy === 1
  } catch {
    return false
  }
}

/**
 * Gracefully shuts down the connection pool (for tests and server termination).
 */
export async function closeDbPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end()
    poolInstance = null
  }
}
