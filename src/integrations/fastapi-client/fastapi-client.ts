import { randomUUID } from "node:crypto"
import { env } from "../../config/env"
import { createAppError, isAppError } from "../../middleware/error-handler"
import {
  ChallengeGenerateRequest,
  ChallengeJobResponse,
} from "../../types/challenge.types"
import { CHALLENGE_PATHS } from "../../utils/challenge.paths"

export interface FastApiClientOptions {
  baseUrl?: string
  serviceToken?: string
  timeoutMs?: number
}

/**
 * Interface representing the FastAPI client methods.
 */
export interface FastApiClient {
  readonly baseUrl: string
  readonly timeoutMs: number
  checkHealth: () => Promise<boolean>
  generateChallenge: (
    payload: ChallengeGenerateRequest,
    correlationId?: string
  ) => Promise<ChallengeJobResponse>
  getChallengeJob: (
    jobId: string,
    correlationId?: string
  ) => Promise<ChallengeJobResponse>
}

/**
 * Factory function to instantiate a configured FastAPI client instance.
 * Uses functional closures instead of ES6 classes.
 */
export function createFastApiClient(
  options: FastApiClientOptions = {}
): FastApiClient {
  const baseUrl = (options.baseUrl || env.FASTAPI_BASE_URL).replace(/\/$/, "")
  const serviceToken = options.serviceToken || env.INTERNAL_SERVICE_TOKEN
  const timeoutMs = options.timeoutMs ?? 10000

  /**
   * Internal helper function to execute fetch requests with timeouts, headers, and error handling.
   */
  async function request<T>(
    endpoint: string,
    fetchOptions: RequestInit = {},
    correlationId?: string
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Service-Token": serviceToken,
      "X-Correlation-ID": correlationId || randomUUID(),
      ...((fetchOptions.headers as Record<string, string>) || {}),
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        let errorMessage = `FastAPI error: HTTP ${response.status} ${response.statusText}`
        try {
          const errorJson = (await response.json()) as Record<string, any>
          if (errorJson?.detail) {
            errorMessage =
              typeof errorJson.detail === "string"
                ? errorJson.detail
                : JSON.stringify(errorJson.detail)
          } else if (errorJson?.error?.message) {
            errorMessage = errorJson.error.message
          }
        } catch {
          // If response body is not JSON, retain default status text message
        }

        throw createAppError(errorMessage, response.status)
      }

      return (await response.json()) as T
    } catch (err: any) {
      clearTimeout(timer)

      if (isAppError(err)) {
        throw err
      }

      if (err.name === "AbortError") {
        throw createAppError(
          `FastAPI service request timed out after ${timeoutMs}ms`,
          504
        )
      }

      throw createAppError(
        `Failed to communicate with AI service: ${err.message || "Unknown error"}`,
        503
      )
    }
  }

  /**
   * Checks whether the FastAPI AI service is alive and healthy.
   */
  async function checkHealth(): Promise<boolean> {
    try {
      const res = await request<{ status: string }>(
        CHALLENGE_PATHS.FASTAPI.HEALTH
      )
      return res.status === "ok"
    } catch {
      return false
    }
  }

  /**
   * Submits project context to FastAPI to initiate challenge generation.
   * Returns 202 Accepted job metadata.
   */
  async function generateChallenge(
    payload: ChallengeGenerateRequest,
    correlationId?: string
  ): Promise<ChallengeJobResponse> {
    return request<ChallengeJobResponse>(
      CHALLENGE_PATHS.FASTAPI.GENERATE,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      correlationId
    )
  }

  /**
   * Queries the current status of an AI generation job.
   */
  async function getChallengeJob(
    jobId: string,
    correlationId?: string
  ): Promise<ChallengeJobResponse> {
    return request<ChallengeJobResponse>(
      CHALLENGE_PATHS.FASTAPI.jobById(jobId),
      { method: "GET" },
      correlationId
    )
  }

  return {
    baseUrl,
    timeoutMs,
    checkHealth,
    generateChallenge,
    getChallengeJob,
  }
}

/**
 * Default singleton client instance for standard application usage.
 */
export const fastApiClient = createFastApiClient()

/**
 * Direct standalone functional exports for functional composition.
 */
export const generateChallenge = (
  payload: ChallengeGenerateRequest,
  correlationId?: string
) => fastApiClient.generateChallenge(payload, correlationId)

export const getChallengeJob = (
  jobId: string,
  correlationId?: string
) => fastApiClient.getChallengeJob(jobId, correlationId)

export const checkFastApiHealth = () => fastApiClient.checkHealth()
