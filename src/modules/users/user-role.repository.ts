import { query } from "../../database/connection"

/**
 * Raw database row shape for app.user_roles.
 */
export interface UserRoleRow {
  clerk_user_id: string
  role: "candidate" | "assessor"
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  is_assessor_registered: boolean
  organization: string | null
  title: string | null
  evaluation_track: string | null
  target_level: string | null
  website_or_linkedin: string | null
  created_at: Date
  updated_at: Date
}

/**
 * Input for creating or updating a user's role record.
 */
export interface UpsertUserRoleInput {
  clerk_user_id: string
  role: "candidate" | "assessor"
  display_name?: string | null
  is_assessor_registered?: boolean
  organization?: string | null
  title?: string | null
  evaluation_track?: string | null
  target_level?: string | null
  website_or_linkedin?: string | null
  bio?: string | null
}

/**
 * Inserts a new user_role row, or updates `role` + `updated_at` if the user already exists.
 * This is the "set role after Clerk signup" operation.
 */
export async function upsertUserRole(
  input: UpsertUserRoleInput
): Promise<UserRoleRow> {
  const isAssessorReg =
    input.is_assessor_registered ?? (input.role === "assessor")

  const sql = `
    INSERT INTO app.user_roles (
      clerk_user_id,
      role,
      display_name,
      is_assessor_registered,
      organization,
      title,
      evaluation_track,
      target_level,
      website_or_linkedin,
      bio
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (clerk_user_id)
    DO UPDATE SET
      role                   = EXCLUDED.role,
      display_name           = COALESCE(EXCLUDED.display_name, app.user_roles.display_name),
      is_assessor_registered = app.user_roles.is_assessor_registered OR EXCLUDED.is_assessor_registered,
      organization           = COALESCE(EXCLUDED.organization, app.user_roles.organization),
      title                  = COALESCE(EXCLUDED.title, app.user_roles.title),
      evaluation_track       = COALESCE(EXCLUDED.evaluation_track, app.user_roles.evaluation_track),
      target_level           = COALESCE(EXCLUDED.target_level, app.user_roles.target_level),
      website_or_linkedin    = COALESCE(EXCLUDED.website_or_linkedin, app.user_roles.website_or_linkedin),
      bio                    = COALESCE(EXCLUDED.bio, app.user_roles.bio),
      updated_at             = NOW()
    RETURNING *;
  `
  const result = await query<UserRoleRow>(sql, [
    input.clerk_user_id,
    input.role,
    input.display_name ?? null,
    isAssessorReg,
    input.organization ?? null,
    input.title ?? null,
    input.evaluation_track ?? null,
    input.target_level ?? null,
    input.website_or_linkedin ?? null,
    input.bio ?? null,
  ])
  return result.rows[0]
}

/**
 * Activates the Assessor persona for a user who previously registered as Candidate.
 * Saves organization, title, and optional extended fields, sets role = 'assessor',
 * and is_assessor_registered = TRUE.
 */
export async function activateAssessorProfile(input: {
  clerk_user_id: string
  organization: string
  title: string
  evaluation_track?: string | null
  target_level?: string | null
  website_or_linkedin?: string | null
  bio?: string | null
}): Promise<UserRoleRow> {
  const sql = `
    UPDATE app.user_roles
    SET
      role                   = 'assessor',
      is_assessor_registered = TRUE,
      organization           = $2,
      title                  = $3,
      evaluation_track       = COALESCE($4, evaluation_track),
      target_level           = COALESCE($5, target_level),
      website_or_linkedin    = COALESCE($6, website_or_linkedin),
      bio                    = COALESCE($7, bio),
      updated_at             = NOW()
    WHERE clerk_user_id = $1
    RETURNING *;
  `
  const result = await query<UserRoleRow>(sql, [
    input.clerk_user_id,
    input.organization,
    input.title,
    input.evaluation_track ?? null,
    input.target_level ?? null,
    input.website_or_linkedin ?? null,
    input.bio ?? null,
  ])

  if (result.rowCount === 0) {
    // If user row didn't exist yet, insert fresh
    return upsertUserRole({
      clerk_user_id: input.clerk_user_id,
      role: "assessor",
      is_assessor_registered: true,
      organization: input.organization,
      title: input.title,
      evaluation_track: input.evaluation_track ?? null,
      target_level: input.target_level ?? null,
      website_or_linkedin: input.website_or_linkedin ?? null,
      bio: input.bio ?? null,
    })
  }

  return result.rows[0]
}

/**
 * Retrieves the role record for a given Clerk user ID.
 * Returns null if the user has not completed onboarding (no role set yet).
 */
export async function findUserRole(
  clerkUserId: string
): Promise<UserRoleRow | null> {
  const sql = `SELECT * FROM app.user_roles WHERE clerk_user_id = $1 LIMIT 1;`
  const result = await query<UserRoleRow>(sql, [clerkUserId])
  return result.rows[0] ?? null
}
