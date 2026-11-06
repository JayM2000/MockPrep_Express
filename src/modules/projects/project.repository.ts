import { query } from "../../database/connection"

export interface Project {
  id: string
  name: string
  description: string | null
  difficulty: "easy" | "medium" | "hard"
  tech_stack: string[]
  repository_url: string | null
  created_by: string
  created_at: Date
  updated_at: Date
}

export type NewProject = Omit<Project, "created_at" | "updated_at"> & {
  created_at?: Date
  updated_at?: Date
}

/**
 * Inserts a new project into the 'app.projects' table.
 * Pure functional database access.
 */
export async function createProject(newProject: NewProject): Promise<Project> {
  const sql = `
    INSERT INTO app.projects (
      id, name, description, difficulty, tech_stack, repository_url, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `
  const params = [
    newProject.id,
    newProject.name,
    newProject.description || null,
    newProject.difficulty || "medium",
    newProject.tech_stack || [],
    newProject.repository_url || null,
    newProject.created_by,
  ]

  const result = await query<Project>(sql, params)
  return result.rows[0]
}

/**
 * Retrieves a single project by ID from 'app.projects'.
 */
export async function findProjectById(id: string): Promise<Project | null> {
  const sql = `SELECT * FROM app.projects WHERE id = $1 LIMIT 1;`
  const result = await query<Project>(sql, [id])
  return result.rows[0] || null
}

/**
 * Lists projects with pagination.
 */
export async function listProjects(limit: number = 20, offset: number = 0): Promise<Project[]> {
  const sql = `
    SELECT * FROM app.projects
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
  `
  const result = await query<Project>(sql, [limit, offset])
  return result.rows
}

/**
 * Deletes a project by ID.
 */
export async function deleteProject(id: string): Promise<boolean> {
  const sql = `DELETE FROM app.projects WHERE id = $1;`
  const result = await query(sql, [id])
  return (result.rowCount ?? 0) > 0
}
