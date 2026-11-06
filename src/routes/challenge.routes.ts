import { Router, Request, Response, NextFunction } from "express"
import { fastApiClient } from "../integrations/fastapi-client"
import { createAppError } from "../middleware/error-handler"
import { ChallengeGenerateRequest } from "../types/challenge.types"
import { CHALLENGE_PATHS } from "../utils/challenge.paths"

export const challengeRouter = Router()

/**
 * POST /api/v1/challenges/generate
 * Public/application endpoint exposed by Express to trigger challenge generation.
 * Express validates user input, handles orchestration, and delegates AI tasks to FastAPI.
 */
challengeRouter.post(
  CHALLENGE_PATHS.GENERATE,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Partial<ChallengeGenerateRequest>

      // Validate required contract fields
      if (!body.projectId || typeof body.projectId !== "string") {
        throw createAppError("Field 'projectId' is required and must be a string", 400)
      }
      if (!body.projectName || typeof body.projectName !== "string") {
        throw createAppError("Field 'projectName' is required and must be a string", 400)
      }
      if (!body.codeSummary || typeof body.codeSummary !== "string") {
        throw createAppError("Field 'codeSummary' is required and must be a string", 400)
      }

      const correlationId = (req.headers["x-correlation-id"] as string) || undefined

      const jobResponse = await fastApiClient.generateChallenge(
        {
          projectId: body.projectId,
          projectName: body.projectName,
          difficulty: body.difficulty || "medium",
          techStack: body.techStack || [],
          codeSummary: body.codeSummary,
          challengeTypes: body.challengeTypes || ["bug_fix"],
          customInstructions: body.customInstructions || null,
        },
        correlationId
      )

      res.status(202).json(jobResponse)
    } catch (error) {
      next(error)
    }
  }
)

/**
 * GET /api/v1/challenges/jobs/:jobId
 * Endpoint for checking status of an asynchronous challenge generation job.
 */
challengeRouter.get(
  CHALLENGE_PATHS.JOB_BY_ID,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawJobId = req.params.jobId
      const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId
      if (!jobId) {
        throw createAppError("Parameter 'jobId' is required", 400)
      }

      const correlationId = (req.headers["x-correlation-id"] as string) || undefined
      const job = await fastApiClient.getChallengeJob(jobId, correlationId)

      res.status(200).json(job)
    } catch (error) {
      next(error)
    }
  }
)
