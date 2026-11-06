/**
 * Standardized error envelope used across Express and FastAPI.
 */
export interface ApiErrorDetail {
  code: string
  message: string
  details?: unknown
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail
}

export interface ApiResponse<T> {
  data: T
  meta?: Record<string, unknown>
}
