import { Router, Request, Response, NextFunction } from "express"
import { randomUUID } from "crypto"
import { createAppError } from "../middleware/error-handler"
import { requireAuth, assertProjectOwner } from "../middleware/auth"
import { requireRole, attachRole } from "../middleware/role"
import { generateShareToken } from "../utils/token"
import {
  createProject,
  findProjectById,
  listProjects,
  deleteProject,
  renewProject,
  type ProjectRow,
} from "../modules/projects/project.repository"
import {
  addBookmark,
  removeBookmark,
  listBookmarksByUser,
} from "../modules/projects/bookmark.repository"
import { PROJECT_PATHS } from "../utils/project.paths"

export const projectRouter = Router()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a snake_case DB row → camelCase API response.
 * This is the single point where column names become JSON keys.
 * Now includes visibility, expiry, and share link fields.
 */
function toProjectResponse(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    category: row.category || "",
    frontendTech: row.frontend_tech || "",
    backendTech: row.backend_tech || "",
    database: row.database_tech || "",
    complexity: row.difficulty,
    status: row.status || "draft",
    ownerId: row.created_by,
    tags: row.tags || [],
    // Phase 8: visibility + expiry fields
    visibility: row.visibility,
    shareToken: row.share_token,
    expiryDays: row.expiry_days,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/projects — Create a project (Assessors only)
// ---------------------------------------------------------------------------
projectRouter.post(
  "/",
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body

      // ---- Validation (mirrors the frontend Zod schema) ----
      if (!body.name || typeof body.name !== "string" || body.name.trim().length < 3) {
        throw createAppError("Field 'name' is required (min 3 characters)", 400)
      }
      if (body.name.length > 80) {
        throw createAppError("Field 'name' cannot exceed 80 characters", 400)
      }
      if (
        !body.description ||
        typeof body.description !== "string" ||
        body.description.trim().length < 10
      ) {
        throw createAppError(
          "Field 'description' is required (min 10 characters)",
          400
        )
      }
      if (body.description.length > 500) {
        throw createAppError("Field 'description' cannot exceed 500 characters", 400)
      }

      const validComplexities = ["beginner", "intermediate", "advanced"]
      const complexity = body.complexity || "intermediate"
      if (!validComplexities.includes(complexity)) {
        throw createAppError(
          `Field 'complexity' must be one of: ${validComplexities.join(", ")}`,
          400
        )
      }

      // Visibility validation
      const validVisibilities = ["public", "private"]
      const visibility = body.visibility || "private"
      if (!validVisibilities.includes(visibility)) {
        throw createAppError(
          `Field 'visibility' must be one of: ${validVisibilities.join(", ")}`,
          400
        )
      }

      // Expiry validation (1–30 days)
      const expiryDays = Number(body.expiryDays) || 7
      if (expiryDays < 1 || expiryDays > 30) {
        throw createAppError(
          "Field 'expiryDays' must be between 1 and 30",
          400
        )
      }

      // Authoritative creator identity from verified Clerk session
      const userId = res.locals.userId as string

      const tags: string[] = Array.isArray(body.tags) ? body.tags : []
      const techStack = [
        body.frontendTech,
        body.backendTech,
        body.database,
      ].filter(Boolean)

      const row = await createProject({
        id: randomUUID(),
        name: body.name.trim(),
        description: body.description.trim(),
        difficulty: complexity,
        category: body.category || "",
        frontend_tech: body.frontendTech || "",
        backend_tech: body.backendTech || "",
        database_tech: body.database || "",
        tech_stack: techStack,
        tags,
        status: "draft",
        created_by: userId,
        visibility: visibility as "public" | "private",
        share_token: generateShareToken(),
        expiry_days: expiryDays,
      })

      res.status(201).json(toProjectResponse(row))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// GET /api/v1/projects — List projects (role-aware)
// - Assessor: sees all their own projects
// - Candidate: sees public + non-expired projects only
// - No auth / no role: sees public + non-expired (same as candidate)
// ---------------------------------------------------------------------------
projectRouter.get(
  "/",
  requireAuth,
  attachRole(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 100)
      const offset = Math.max(Number(req.query.offset) || 0, 0)
      const userId = res.locals.userId as string
      const role = res.locals.role as string | null

      let rows: ProjectRow[]

      if (role === "assessor") {
        // Assessors see all their own projects
        rows = await listProjects({ limit, offset, ownerId: userId })
      } else {
        // Candidates (and unauthenticated users) see public + non-expired only
        rows = await listProjects({ limit, offset, publicOnly: true })
      }

      res.status(200).json(rows.map(toProjectResponse))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// GET /api/v1/projects/:projectId — Get a single project
// ---------------------------------------------------------------------------
projectRouter.get(
  PROJECT_PATHS.BY_ID,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.projectId
      const projectId = Array.isArray(rawId) ? rawId[0] : rawId
      if (!projectId) {
        throw createAppError("Parameter 'projectId' is required", 400)
      }

      const row = await findProjectById(projectId)
      if (!row) {
        throw createAppError(`Project '${projectId}' not found`, 404)
      }

      res.status(200).json(toProjectResponse(row))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// DELETE /api/v1/projects/:projectId — Delete a project (Assessor + Owner)
// ---------------------------------------------------------------------------
projectRouter.delete(
  PROJECT_PATHS.BY_ID,
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.projectId
      const projectId = Array.isArray(rawId) ? rawId[0] : rawId
      if (!projectId) {
        throw createAppError("Parameter 'projectId' is required", 400)
      }

      // 1. Fetch project to verify existence and ownership
      const existingProject = await findProjectById(projectId)
      if (!existingProject) {
        throw createAppError(`Project '${projectId}' not found`, 404)
      }

      // 2. Only the creator can delete their own project
      const currentUserId = res.locals.userId as string
      assertProjectOwner(existingProject.created_by, currentUserId)

      // 3. Delete from database
      await deleteProject(projectId)

      res.status(200).json({ message: "Project deleted" })
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// PATCH /api/v1/projects/:projectId/renew — Extend project expiry (Assessor + Owner)
// ---------------------------------------------------------------------------
projectRouter.patch(
  "/:projectId/renew",
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.projectId
      const projectId = Array.isArray(rawId) ? rawId[0] : rawId
      if (!projectId) {
        throw createAppError("Parameter 'projectId' is required", 400)
      }

      const expiryDays = Number(req.body.expiryDays) || 7
      if (expiryDays < 1 || expiryDays > 30) {
        throw createAppError("Field 'expiryDays' must be between 1 and 30", 400)
      }

      const existingProject = await findProjectById(projectId)
      if (!existingProject) {
        throw createAppError(`Project '${projectId}' not found`, 404)
      }

      const currentUserId = res.locals.userId as string
      assertProjectOwner(existingProject.created_by, currentUserId)

      const updated = await renewProject(projectId, expiryDays)
      if (!updated) {
        throw createAppError("Failed to renew project", 500)
      }

      res.status(200).json(toProjectResponse(updated))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// POST /api/v1/projects/:projectId/bookmark — Bookmark a project (Candidates only)
// ---------------------------------------------------------------------------
projectRouter.post(
  "/:projectId/bookmark",
  requireAuth,
  requireRole("candidate"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.projectId
      const projectId = Array.isArray(rawId) ? rawId[0] : rawId
      if (!projectId) {
        throw createAppError("Parameter 'projectId' is required", 400)
      }

      // Verify project exists
      const project = await findProjectById(projectId)
      if (!project) {
        throw createAppError(`Project '${projectId}' not found`, 404)
      }

      const userId = res.locals.userId as string
      const bookmark = await addBookmark(userId, projectId)

      res.status(201).json({
        id: bookmark.id,
        clerkUserId: bookmark.clerk_user_id,
        projectId: bookmark.project_id,
        createdAt: bookmark.created_at,
      })
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// DELETE /api/v1/projects/:projectId/bookmark — Remove bookmark (Candidates only)
// ---------------------------------------------------------------------------
projectRouter.delete(
  "/:projectId/bookmark",
  requireAuth,
  requireRole("candidate"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.projectId
      const projectId = Array.isArray(rawId) ? rawId[0] : rawId
      if (!projectId) {
        throw createAppError("Parameter 'projectId' is required", 400)
      }

      const userId = res.locals.userId as string
      await removeBookmark(userId, projectId)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// GET /api/v1/projects/bookmarks — List candidate's bookmarks
// ---------------------------------------------------------------------------
projectRouter.get(
  "/bookmarks",
  requireAuth,
  requireRole("candidate"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const bookmarks = await listBookmarksByUser(userId)

      res.status(200).json(
        bookmarks.map((b) => ({
          id: b.id,
          projectId: b.project_id,
          createdAt: b.created_at,
        }))
      )
    } catch (error) {
      next(error)
    }
  }
)
