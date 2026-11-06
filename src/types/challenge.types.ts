export type DifficultyLevel = "easy" | "medium" | "hard"

export type ChallengeType =
  | "bug_fix"
  | "feature_addition"
  | "refactoring"
  | "performance_optimization"
  | "security_hardening"

export type JobStatus = "queued" | "processing" | "completed" | "failed"

/**
 * Request payload sent to FastAPI /internal/v1/challenges/generate.
 */
export interface ChallengeGenerateRequest {
  projectId: string
  projectName: string
  difficulty?: DifficultyLevel
  techStack?: string[]
  codeSummary: string
  challengeTypes?: ChallengeType[]
  customInstructions?: string | null
}

/**
 * Response payload returned by FastAPI for background challenge jobs.
 */
export interface ChallengeJobResponse {
  jobId: string
  projectId: string
  status: JobStatus
  message: string
  estimatedDurationSeconds: number
  createdAt: string
  updatedAt: string
  result?: Record<string, unknown> | null
  error?: string | null
}
