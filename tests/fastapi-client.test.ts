import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createFastApiClient } from "../src/integrations/fastapi-client/fastapi-client"
import { isAppError } from "../src/middleware/error-handler"
import { CHALLENGE_PATHS } from "../src/utils/challenge.paths"

describe("FastApiClient (Functional)", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("sends correct headers and returns 202 Accepted on generateChallenge", async () => {
    const mockResponse = {
      jobId: "job_test123",
      projectId: "proj_123",
      status: "queued",
      message: "Job accepted",
      estimatedDurationSeconds: 15,
      createdAt: "2026-11-06T00:00:00Z",
      updatedAt: "2026-11-06T00:00:00Z",
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => mockResponse,
    })
    global.fetch = fetchMock as any

    const client = createFastApiClient({
      baseUrl: "http://127.0.0.1:8000",
      serviceToken: "test-secret-token",
    })

    const result = await client.generateChallenge(
      {
        projectId: "proj_123",
        projectName: "Test Project",
        codeSummary: "Test code summary",
      },
      "custom-corr-id"
    )

    expect(result).toEqual(mockResponse)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, requestInit] = fetchMock.mock.calls[0]
    expect(url).toBe(`http://127.0.0.1:8000${CHALLENGE_PATHS.FASTAPI.GENERATE}`)
    expect(requestInit.method).toBe("POST")
    expect(requestInit.headers["X-Service-Token"]).toBe("test-secret-token")
    expect(requestInit.headers["X-Correlation-ID"]).toBe("custom-corr-id")
    expect(requestInit.headers["Content-Type"]).toBe("application/json")
  })

  it("translates FastAPI error responses into AppError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ detail: "Invalid service token provided" }),
    })
    global.fetch = fetchMock as any

    const client = createFastApiClient({
      baseUrl: "http://127.0.0.1:8000",
      serviceToken: "wrong-token",
    })

    try {
      await client.generateChallenge({
        projectId: "proj_123",
        projectName: "Test",
        codeSummary: "Summary",
      })
      expect.fail("Expected function to throw")
    } catch (err: any) {
      expect(isAppError(err)).toBe(true)
      expect(err.statusCode).toBe(401)
      expect(err.message).toBe("Invalid service token provided")
    }
  })

  it("handles network failures and marks status as 503", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"))

    const client = createFastApiClient({
      baseUrl: "http://127.0.0.1:8000",
    })

    await expect(
      client.generateChallenge({
        projectId: "p1",
        projectName: "Test",
        codeSummary: "Summary",
      })
    ).rejects.toMatchObject({
      statusCode: 503,
    })
  })

  it("fetches job status via getChallengeJob", async () => {
    const mockJob = {
      jobId: "job_999",
      projectId: "proj_123",
      status: "completed",
      message: "Ready",
      estimatedDurationSeconds: 15,
      createdAt: "2026-11-06T00:00:00Z",
      updatedAt: "2026-11-06T00:00:00Z",
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJob,
    }) as any

    const client = createFastApiClient({ baseUrl: "http://127.0.0.1:8000" })
    const res = await client.getChallengeJob("job_999")
    expect(res.status).toBe("completed")
  })
})
