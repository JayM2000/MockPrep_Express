import { query } from "../../database/connection"

/**
 * Raw database row shape (snake_case, matches PostgreSQL columns).
 * Route handlers map this to camelCase for the API response.
 */
export interface ProjectRow {
  id: string
  name: string
  description: string | null
  difficulty: string
  tech_stack: string[]
  repository_url: string | null
  category: string | null
  frontend_tech: string | null
  backend_tech: string | null
  database_tech: string | null
  tags: string[]
  status: string
  visibility: "public" | "private"
  share_token: string
  expiry_days: number
  expires_at: Date
  created_by: string
  created_at: Date
  updated_at: Date
}

/**
 * Input for creating a new project — all required DB columns.
 */
export interface CreateProjectInput {
  id: string
  name: string
  description: string
  difficulty: string
  category: string
  frontend_tech: string
  backend_tech: string
  database_tech: string
  tech_stack: string[]
  tags: string[]
  status: string
  created_by: string
  repository_url?: string | null
  visibility?: "public" | "private"
  share_token: string
  expiry_days?: number
}

/**
 * Filters for listing projects — varies by caller role.
 */
export interface ListProjectsOptions {
  limit?: number
  offset?: number
  /** If set, return ALL projects created by this user (Assessor view) */
  ownerId?: string
  /** If true, filter to public + non-expired only (Candidate view) */
  publicOnly?: boolean
}

/**
 * Inserts a new project into the 'app.projects' table.
 * Returns the full row including server-generated timestamps.
 */
export async function createProject(
  input: CreateProjectInput
): Promise<ProjectRow> {
  const expiryDays = input.expiry_days ?? 7
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  const sql = `
    INSERT INTO app.projects (
      id, name, description, difficulty, category,
      frontend_tech, backend_tech, database_tech,
      tech_stack, tags, status, repository_url, created_by,
      visibility, share_token, expiry_days, expires_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17
    )
    RETURNING *;
  `
  const params = [
    input.id,
    input.name,
    input.description,
    input.difficulty || "intermediate",
    input.category || null,
    input.frontend_tech || null,
    input.backend_tech || null,
    input.database_tech || null,
    input.tech_stack || [],
    input.tags || [],
    input.status || "draft",
    input.repository_url || null,
    input.created_by,
    input.visibility || "private",
    input.share_token,
    expiryDays,
    expiresAt,
  ]

  const result = await query<ProjectRow>(sql, params)
  return result.rows[0]
}

/**
 * Retrieves a single project by ID.
 */
export async function findProjectById(id: string): Promise<ProjectRow | null> {
  const sql = `SELECT * FROM app.projects WHERE id = $1 LIMIT 1;`
  const result = await query<ProjectRow>(sql, [id])
  return result.rows[0] ?? null
}

/**
 * Retrieves a single project by its share_token.
 * Returns null if not found or if the project has expired.
 */
export async function findProjectByShareToken(
  shareToken: string
): Promise<ProjectRow | null> {
  const sql = `
    SELECT * FROM app.projects
    WHERE share_token = $1
    LIMIT 1;
  `
  const result = await query<ProjectRow>(sql, [shareToken])
  return result.rows[0] ?? null
}

/**
 * Lists projects with role-aware filtering:
 * - Assessor (ownerId set): all their own projects, any visibility or expiry
 * - Candidate (publicOnly true): only public + non-expired projects
 * - Default (no options): all projects (used in legacy / test paths)
 */
export async function listProjects(
  options: ListProjectsOptions = {}
): Promise<ProjectRow[]> {
  const { limit = 50, offset = 0, ownerId, publicOnly } = options

  let sql: string
  let params: (string | number | boolean)[]

  if (ownerId) {
    // Assessor: see all their own projects
    sql = `
      SELECT * FROM app.projects
      WHERE created_by = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `
    params = [ownerId, limit, offset]
  } else if (publicOnly) {
    // Candidate: public + not expired
    sql = `
      SELECT * FROM app.projects
      WHERE visibility = 'public'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `
    params = [limit, offset]
  } else {
    // Legacy / no-role path: all projects
    sql = `
      SELECT * FROM app.projects
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `
    params = [limit, offset]
  }

  const result = await query<ProjectRow>(sql, params)
  return result.rows
}

/**
 * Deletes a project by ID. Returns true if a row was removed.
 */
export async function deleteProject(id: string): Promise<boolean> {
  const sql = `DELETE FROM app.projects WHERE id = $1;`
  const result = await query(sql, [id])
  return (result.rowCount ?? 0) > 0
}

/**
 * Extends a project's expiry. Max allowed is 30 days from now.
 * Returns the updated row.
 */
export async function renewProject(
  id: string,
  newExpiryDays: number
): Promise<ProjectRow | null> {
  const days = Math.min(Math.max(newExpiryDays, 1), 30)
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  const sql = `
    UPDATE app.projects
    SET expiry_days = $2,
        expires_at  = $3,
        updated_at  = NOW()
    WHERE id = $1
    RETURNING *;
  `
  const result = await query<ProjectRow>(sql, [id, days, expiresAt])
  return result.rows[0] ?? null
}
