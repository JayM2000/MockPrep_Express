import fs from "node:fs"
import path from "node:path"
import { query, closeDbPool } from "./connection"

/**
 * Functional migration runner for the Express-owned 'app' schema.
 * Executes versioned SQL migrations in order.
 */
export async function runMigrations(): Promise<void> {
  console.log("[Migration] Running Express 'app' schema migrations...")

  const migrationsDir = path.resolve(process.cwd(), "src/database/migrations")
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()

  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    const sql = fs.readFileSync(filePath, "utf-8")
    console.log(`[Migration] Applying ${file}...`)
    await query(sql)
    console.log(`[Migration] Successfully applied ${file}`)
  }

  console.log("[Migration] All 'app' schema migrations applied successfully.")
}

// Allow direct CLI execution: tsx src/database/migrate.ts
if (process.argv[1]?.includes("migrate")) {
  runMigrations()
    .then(async () => {
      await closeDbPool()
      process.exit(0)
    })
    .catch(async (err) => {
      console.error("[Migration Error]:", err)
      await closeDbPool()
      process.exit(1)
    })
}
