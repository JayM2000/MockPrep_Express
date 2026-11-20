import { Router, Request, Response, NextFunction } from "express"
import { requireAuth } from "../middleware/auth"
import { createAppError } from "../middleware/error-handler"
import {
  findProjectByShareToken,
  findProjectById,
} from "../modules/projects/project.repository"
import { findInviteByRawToken } from "../modules/invites/invite.repository"

export const sharedRouter = Router()

// ---------------------------------------------------------------------------
// GET /api/v1/shared/:shareToken — View a project by its shareable link
// Any registered user (Candidate or Assessor) with the link can access it.
// Supports both direct project shareToken and invite tokens.
// ---------------------------------------------------------------------------
sharedRouter.get(
  "/:shareToken",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.shareToken
      const shareToken = Array.isArray(rawToken) ? rawToken[0] : rawToken

      if (!shareToken || shareToken.trim().length === 0) {
        throw createAppError("Parameter 'shareToken' is required", 400)
      }

      let project = await findProjectByShareToken(shareToken)

      // Fallback check: see if this is an invite token (e.g. from app.invites)
      if (!project) {
        const invite = await findInviteByRawToken(shareToken)
        if (invite) {
          project = await findProjectById(invite.project_id)
        }
      }

      if (!project) {
        throw createAppError("Project not found for this share link", 404)
      }

      // Check expiry — return 410 Gone (not 404, so the UI can show a specific message)
      if (new Date(project.expires_at) < new Date()) {
        res.status(410).json({
          error: {
            statusCode: 410,
            message:
              "This project link has expired. Contact the Assessor to renew it.",
          },
        })
        return
      }

      // Return the full project detail
      res.status(200).json(toSharedProjectResponse(project))
    } catch (error) {
      next(error)
    }
  }
)

/**
 * Maps a project row to a safe camelCase response for shared link view.
 * Does NOT expose internal fields like `created_by`.
 */
function toSharedProjectResponse(row: {
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
  visibility: string
  expiry_days: number
  expires_at: Date
  created_at: Date
  updated_at: Date
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    difficulty: row.difficulty,
    techStack: row.tech_stack,
    repositoryUrl: row.repository_url,
    category: row.category,
    frontendTech: row.frontend_tech,
    backendTech: row.backend_tech,
    database: row.database_tech,
    tags: row.tags,
    status: row.status,
    visibility: row.visibility,
    expiryDays: row.expiry_days,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
