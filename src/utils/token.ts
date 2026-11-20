import { randomUUID, randomBytes, createHash } from "crypto"

/**
 * Generates a URL-safe share token for a project.
 * Uses crypto.randomUUID() — a cryptographically secure 36-char UUID v4.
 */
export function generateShareToken(): string {
  return randomUUID()
}

/**
 * Generates a cryptographically secure 32-byte invite token.
 * Example: "4a8f9b2c..." (64 hex characters)
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex")
}

/**
 * Computes the SHA-256 hash of an invite token.
 * Only the hash is persisted to the database, never the raw token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
