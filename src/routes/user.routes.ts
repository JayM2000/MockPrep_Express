import { Router, Request, Response, NextFunction } from "express"
import { requireAuth } from "../middleware/auth"
import { createAppError } from "../middleware/error-handler"
import {
  upsertUserRole,
  findUserRole,
  activateAssessorProfile,
  UserRoleRow,
} from "../modules/users/user-role.repository"

export const userRouter = Router()

/**
 * Maps a DB row to a clean camelCase API response.
 */
function toUserResponse(row: UserRoleRow) {
  return {
    clerkUserId: row.clerk_user_id,
    role: row.role,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    isAssessorRegistered: row.is_assessor_registered,
    organization: row.organization,
    title: row.title,
    evaluationTrack: row.evaluation_track,
    targetLevel: row.target_level,
    websiteOrLinkedin: row.website_or_linkedin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/users/role — Set/switch active role
// ---------------------------------------------------------------------------
userRouter.post(
  "/role",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const { role, displayName, organization, title } = req.body

      const validRoles = ["candidate", "assessor"]
      if (!role || !validRoles.includes(role)) {
        throw createAppError(
          `Field 'role' is required and must be one of: ${validRoles.join(", ")}`,
          400
        )
      }

      // Check existing role
      const existing = await findUserRole(userId)

      // If user is switching to assessor for the first time without prior registration:
      if (role === "assessor" && existing && !existing.is_assessor_registered) {
        if (!organization || typeof organization !== "string" || !organization.trim()) {
          throw createAppError("Organization or Team Name is required to activate Assessor role.", 400)
        }
        if (!title || typeof title !== "string" || !title.trim()) {
          throw createAppError("Professional Role / Title is required to activate Assessor role.", 400)
        }

        const activated = await activateAssessorProfile({
          clerk_user_id: userId,
          organization: organization.trim(),
          title: title.trim(),
        })
        res.status(200).json(toUserResponse(activated))
        return
      }

      const row = await upsertUserRole({
        clerk_user_id: userId,
        role: role as "candidate" | "assessor",
        display_name: typeof displayName === "string" ? displayName : null,
        organization: typeof organization === "string" ? organization : undefined,
        title: typeof title === "string" ? title : undefined,
      })

      res.status(200).json(toUserResponse(row))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// POST /api/v1/users/activate-assessor — Explicitly activate Assessor persona
// ---------------------------------------------------------------------------
userRouter.post(
  "/activate-assessor",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const {
        organization,
        title,
        evaluationTrack,
        targetLevel,
        websiteOrLinkedin,
        bio,
      } = req.body

      // Mandatory validation on first 2 fields:
      if (!organization || typeof organization !== "string" || !organization.trim()) {
        throw createAppError(
          "Organization or Team Name is required and cannot be empty.",
          400
        )
      }

      if (!title || typeof title !== "string" || !title.trim()) {
        throw createAppError(
          "Professional Role / Title is required and cannot be empty.",
          400
        )
      }

      const row = await activateAssessorProfile({
        clerk_user_id: userId,
        organization: organization.trim(),
        title: title.trim(),
        evaluation_track:
          typeof evaluationTrack === "string" && evaluationTrack.trim()
            ? evaluationTrack.trim()
            : null,
        target_level:
          typeof targetLevel === "string" && targetLevel.trim()
            ? targetLevel.trim()
            : null,
        website_or_linkedin:
          typeof websiteOrLinkedin === "string" && websiteOrLinkedin.trim()
            ? websiteOrLinkedin.trim()
            : null,
        bio: typeof bio === "string" && bio.trim() ? bio.trim() : null,
      })

      res.status(200).json(toUserResponse(row))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// GET /api/v1/users/me — Get current user profile + role + registration state
// ---------------------------------------------------------------------------
userRouter.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const row = await findUserRole(userId)

      if (!row) {
        // User exists in Clerk but hasn't completed onboarding
        res.status(200).json({
          clerkUserId: userId,
          role: null,
          isAssessorRegistered: false,
          organization: null,
          title: null,
          evaluationTrack: null,
          targetLevel: null,
          websiteOrLinkedin: null,
        })
        return
      }

      res.status(200).json(toUserResponse(row))
    } catch (error) {
      next(error)
    }
  }
)
