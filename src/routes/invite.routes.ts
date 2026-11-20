import { Router, Request, Response, NextFunction } from "express"
import { requireAuth } from "../middleware/auth"
import { requireRole } from "../middleware/role"
import { createAppError } from "../middleware/error-handler"
import { findProjectById } from "../modules/projects/project.repository"
import {
  createEmailInvites,
  createOrRotatePublicLink,
  disablePublicLink,
  listProjectInvites,
  revokeInvite,
  resendInvite,
  findInviteByRawToken,
  acceptInviteAndCreateSession,
  InviteRow,
} from "../modules/invites/invite.repository"

export const inviteRouter = Router()

/**
 * Maps DB invite row to clean camelCase API response.
 */
function toInviteResponse(row: InviteRow, rawToken?: string) {
  return {
    id: row.id,
    projectId: row.project_id,
    createdBy: row.created_by,
    rawTokenHint: row.raw_token_hint,
    type: row.type,
    email: row.email,
    message: row.message,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rawToken: rawToken ?? row.raw_token ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// 1. POST /api/v1/projects/:projectId/invites — Send email invites (Assessor only)
// ---------------------------------------------------------------------------
inviteRouter.post(
  "/projects/:projectId/invites",
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const rawProjectId = req.params.projectId
      const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId
      const { emails, message, expiryDays } = req.body

      if (!Array.isArray(emails) || emails.length === 0) {
        throw createAppError("Field 'emails' must be a non-empty array of email addresses", 400)
      }

      // Verify project ownership
      const project = await findProjectById(projectId)
      if (!project) {
        throw createAppError("Project not found", 404)
      }
      if (project.created_by !== userId) {
        throw createAppError("You do not have permission to invite candidates to this project", 403)
      }

      const created = await createEmailInvites({
        projectId,
        createdBy: userId,
        emails,
        message: typeof message === "string" ? message : undefined,
        expiryDays: typeof expiryDays === "number" ? expiryDays : 7,
      })

      res.status(201).json(
        created.map((item) => toInviteResponse(item, item.rawToken))
      )
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// 2. POST /api/v1/projects/:projectId/public-link — Create or rotate public link
// Restricted: Only PUBLIC projects can have a public link!
// ---------------------------------------------------------------------------
inviteRouter.post(
  "/projects/:projectId/public-link",
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const rawProjectId = req.params.projectId
      const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId
      const { maxUses, expiryDays } = req.body

      const project = await findProjectById(projectId)
      if (!project) {
        throw createAppError("Project not found", 404)
      }
      if (project.created_by !== userId) {
        throw createAppError("You do not have permission to manage links for this project", 403)
      }

      // Section 2 & 4 rule: Private projects cannot have public links!
      if (project.visibility === "private") {
        throw createAppError(
          "Public links are disabled for private projects. Use single-use email invites instead.",
          400
        )
      }

      const result = await createOrRotatePublicLink({
        projectId,
        createdBy: userId,
        maxUses: typeof maxUses === "number" ? maxUses : 50,
        expiryDays: typeof expiryDays === "number" ? expiryDays : 14,
      })

      res.status(200).json(toInviteResponse(result, result.rawToken))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// 3. DELETE /api/v1/projects/:projectId/public-link — Disable public link
// ---------------------------------------------------------------------------
inviteRouter.delete(
  "/projects/:projectId/public-link",
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const rawProjectId = req.params.projectId
      const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId

      const success = await disablePublicLink(projectId, userId)
      res.status(200).json({ success })
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// 4. GET /api/v1/projects/:projectId/invites — List all invites for project
// ---------------------------------------------------------------------------
inviteRouter.get(
  "/projects/:projectId/invites",
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const rawProjectId = req.params.projectId
      const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId

      const project = await findProjectById(projectId)
      if (!project) {
        throw createAppError("Project not found", 404)
      }
      if (project.created_by !== userId) {
        throw createAppError("You do not have permission to view invites for this project", 403)
      }

      const invites = await listProjectInvites(projectId, userId)
      res.status(200).json(invites.map((inv) => toInviteResponse(inv)))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// 5. POST /api/v1/invites/:inviteId/resend — Resend email invite
// ---------------------------------------------------------------------------
inviteRouter.post(
  "/invites/:inviteId/resend",
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const rawInviteId = req.params.inviteId
      const inviteId = Array.isArray(rawInviteId) ? rawInviteId[0] : rawInviteId

      const result = await resendInvite(inviteId, userId)
      if (!result) {
        throw createAppError("Invite not found or permission denied", 404)
      }

      res.status(200).json(toInviteResponse(result.invite, result.rawToken))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// 6. POST /api/v1/invites/:inviteId/revoke — Revoke invite
// ---------------------------------------------------------------------------
inviteRouter.post(
  "/invites/:inviteId/revoke",
  requireAuth,
  requireRole("assessor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId as string
      const rawInviteId = req.params.inviteId
      const inviteId = Array.isArray(rawInviteId) ? rawInviteId[0] : rawInviteId

      const result = await revokeInvite(inviteId, userId)
      if (!result) {
        throw createAppError("Invite not found or permission denied", 404)
      }

      res.status(200).json(toInviteResponse(result))
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// 7. GET /api/v1/invites/validate/:token — Validate invite token & get review data
// ---------------------------------------------------------------------------
inviteRouter.get(
  "/invites/validate/:token",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token
      const token = Array.isArray(rawToken) ? rawToken[0] : rawToken

      if (!token) {
        throw createAppError("Token parameter is required", 400)
      }

      const inviteData = await findInviteByRawToken(token)
      if (!inviteData) {
        throw createAppError("Invitation not found or invalid link.", 404)
      }

      // Check revoked
      if (inviteData.status === "revoked" || inviteData.revoked_at) {
        res.status(410).json({
          error: {
            statusCode: 410,
            message: "This invitation link has been revoked by the assessor.",
          },
        })
        return
      }

      // Check expired
      if (new Date(inviteData.expires_at) < new Date()) {
        res.status(410).json({
          error: {
            statusCode: 410,
            message: "This invitation link has expired. Please contact the assessor.",
          },
        })
        return
      }

      // Check use count
      if (inviteData.use_count >= inviteData.max_uses) {
        res.status(410).json({
          error: {
            statusCode: 410,
            message: "This invitation has already been accepted and reached its usage limit.",
          },
        })
        return
      }

      // Extract candidate email if passed in query or headers
      const candidateEmail = (req.query.email as string) || undefined
      const isEmailMatch =
        inviteData.type === "public_link" ||
        !inviteData.email ||
        (Boolean(candidateEmail) &&
          inviteData.email.toLowerCase() === candidateEmail?.toLowerCase())

      res.status(200).json({
        invite: {
          id: inviteData.id,
          type: inviteData.type,
          email: inviteData.email,
          expiresAt: inviteData.expires_at,
          maxUses: inviteData.max_uses,
          useCount: inviteData.use_count,
          status: inviteData.status,
          message: inviteData.message,
        },
        project: {
          id: inviteData.project_id,
          name: inviteData.project_name,
          description: inviteData.project_description,
          difficulty: inviteData.difficulty,
          techStack: inviteData.tech_stack,
          category: inviteData.category,
          visibility: inviteData.visibility,
          frontendTech: inviteData.frontend_tech,
          backendTech: inviteData.backend_tech,
          databaseTech: inviteData.database_tech,
        },
        assessor: {
          name: inviteData.assessor_name,
          organization: inviteData.assessor_organization,
          title: inviteData.assessor_title,
        },
        isEmailMatch,
      })
    } catch (error) {
      next(error)
    }
  }
)

// ---------------------------------------------------------------------------
// 8. POST /api/v1/invites/accept/:token — Accept invite & create candidate session
// ---------------------------------------------------------------------------
inviteRouter.post(
  "/invites/accept/:token",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const candidateId = res.locals.userId as string
      const rawToken = req.params.token
      const token = Array.isArray(rawToken) ? rawToken[0] : rawToken
      const { candidateEmail } = req.body

      if (!token) {
        throw createAppError("Token parameter is required", 400)
      }

      const result = await acceptInviteAndCreateSession({
        rawToken: token,
        candidateId,
        candidateEmail: typeof candidateEmail === "string" ? candidateEmail : undefined,
        durationMins: 120, // 2-hour default session
      })

      res.status(201).json({
        sessionId: result.session.id,
        projectId: result.session.project_id,
        status: result.session.status,
        startedAt: result.session.started_at,
        endsAt: result.session.ends_at,
        durationMins: result.session.duration_mins,
      })
    } catch (error) {
      next(error)
    }
  }
)
