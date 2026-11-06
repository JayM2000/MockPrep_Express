import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import { createApp } from "../src/app"
import { fastApiClient } from "../src/integrations/fastapi-client"
import { CHALLENGE_PATHS } from "../src/utils/challenge.paths"

describe("Challenge Routes", () => {
  const app = createApp()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe(`POST ${CHALLENGE_PATHS.full.GENERATE}`, () => {
    it("returns 400 when required fields are missing", async () => {
      const response = await request(app)
        .post(CHALLENGE_PATHS.full.GENERATE)
        .send({
          // Missing projectId, projectName, and codeSummary
          difficulty: "hard",
        })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty("error")
      expect(response.body.error.message).toContain("projectId")
    })

    it("delegates to FastApiClient and returns 202 with job payload", async () => {
      const mockJob = {
        jobId: "job_xyz789",
        projectId: "proj_456",
        status: "queued",
        message: "Job queued successfully",
        estimatedDurationSeconds: 15,
        createdAt: "2026-11-06T00:00:00Z",
        updatedAt: "2026-11-06T00:00:00Z",
      }

      vi.spyOn(fastApiClient, "generateChallenge").mockResolvedValue(mockJob as any)

      const response = await request(app)
        .post(CHALLENGE_PATHS.full.GENERATE)
        .send({
          projectId: "proj_456",
          projectName: "Distributed Queue System",
          difficulty: "hard",
          techStack: ["Node.js", "Redis"],
          codeSummary: "Message broker with consumer groups and dead letter queue",
        })

      expect(response.status).toBe(202)
      expect(response.body.jobId).toBe("job_xyz789")
      expect(response.body.status).toBe("queued")
    })
  })

  describe(`GET ${CHALLENGE_PATHS.BASE}${CHALLENGE_PATHS.JOB_BY_ID}`, () => {
    it("delegates to FastApiClient and returns 200 with job status", async () => {
      const mockJob = {
        jobId: "job_xyz789",
        projectId: "proj_456",
        status: "processing",
        message: "Generating bug fixtures...",
        estimatedDurationSeconds: 15,
        createdAt: "2026-11-06T00:00:00Z",
        updatedAt: "2026-11-06T00:00:00Z",
      }

      vi.spyOn(fastApiClient, "getChallengeJob").mockResolvedValue(mockJob as any)

      const response = await request(app).get(
        CHALLENGE_PATHS.full.jobById("job_xyz789")
      )

      expect(response.status).toBe(200)
      expect(response.body.status).toBe("processing")
      expect(response.body.jobId).toBe("job_xyz789")
    })
  })
})
