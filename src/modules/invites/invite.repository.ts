import { query } from "../../database/connection"
import { generateInviteToken, hashToken } from "../../utils/token"

export interface InviteRow {
  id: string
  project_id: string
  created_by: string
  token_hash: string
  raw_token: string | null
  raw_token_hint: string | null
  type: "email" | "public_link"
  email: string | null
  message: string | null
  max_uses: number
  use_count: number
  expires_at: Date
  revoked_at: Date | null
  status: "sent" | "opened" | "accepted" | "in_progress" | "completed" | "expired" | "revoked"
  created_at: Date
  updated_at: Date
}

export interface SessionRow {
  id: string
  invite_id: string | null
  candidate_id: string
  candidate_email: string | null
  project_id: string
  environment_id: string | null
  status: "ready" | "in_progress" | "completed" | "expired"
  started_at: Date | null
  ends_at: Date | null
  duration_mins: number
  created_at: Date
  updated_at: Date
}

export interface InviteWithProjectDetails extends InviteRow {
  project_name: string
  project_description: string | null
  difficulty: string
  tech_stack: string[]
  category: string | null
  visibility: string
  frontend_tech: string | null
  backend_tech: string | null
  database_tech: string | null
  assessor_name: string | null
  assessor_organization: string | null
  assessor_title: string | null
}

/**
 * Creates one or more email-bound single-use invites for a project.
 */
export async function createEmailInvites(input: {
  projectId: string
  createdBy: string
  emails: string[]
  message?: string
  expiryDays?: number
}): Promise<Array<InviteRow & { rawToken: string }>> {
  const expiryDays = input.expiryDays ?? 7
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  const createdInvites: Array<InviteRow & { rawToken: string }> = []

  for (const email of input.emails) {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) continue

    const rawToken = generateInviteToken()
    const tokenHash = hashToken(rawToken)
    const rawHint = rawToken.slice(0, 8)

    const sql = `
      INSERT INTO app.invites (
        project_id,
        created_by,
        token_hash,
        raw_token,
        raw_token_hint,
        type,
        email,
        message,
        max_uses,
        use_count,
        expires_at,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'email', $6, $7, 1, 0, $8, 'sent')
      RETURNING *;
    `

    const res = await query<InviteRow>(sql, [
      input.projectId,
      input.createdBy,
      tokenHash,
      rawToken,
      rawHint,
      trimmedEmail,
      input.message ?? null,
      expiresAt,
    ])

    createdInvites.push({
      ...res.rows[0],
      rawToken,
    })
  }

  return createdInvites
}

/**
 * Creates or rotates a generic public link for a PUBLIC project.
 * Public links allow multiple candidates up to `maxUses`.
 */
export async function createOrRotatePublicLink(input: {
  projectId: string
  createdBy: string
  maxUses?: number
  expiryDays?: number
}): Promise<InviteRow & { rawToken: string }> {
  // First revoke any existing active public link for this project
  await query(
    `UPDATE app.invites
     SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
     WHERE project_id = $1 AND type = 'public_link' AND status != 'revoked';`,
    [input.projectId]
  )

  const rawToken = generateInviteToken()
  const tokenHash = hashToken(rawToken)
  const rawHint = rawToken.slice(0, 8)
  const maxUses = input.maxUses ?? 50
  const expiryDays = input.expiryDays ?? 14
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  const sql = `
    INSERT INTO app.invites (
      project_id,
      created_by,
      token_hash,
      raw_token,
      raw_token_hint,
      type,
      email,
      max_uses,
      use_count,
      expires_at,
      status
    )
    VALUES ($1, $2, $3, $4, $5, 'public_link', NULL, $6, 0, $7, 'sent')
    RETURNING *;
  `

  const res = await query<InviteRow>(sql, [
    input.projectId,
    input.createdBy,
    tokenHash,
    rawToken,
    rawHint,
    maxUses,
    expiresAt,
  ])

  return {
    ...res.rows[0],
    rawToken,
  }
}

/**
 * Disables / revokes the active public link for a project.
 */
export async function disablePublicLink(
  projectId: string,
  assessorId: string
): Promise<boolean> {
  const sql = `
    UPDATE app.invites
    SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
    WHERE project_id = $1 AND created_by = $2 AND type = 'public_link' AND status != 'revoked';
  `
  const res = await query(sql, [projectId, assessorId])
  return (res.rowCount ?? 0) > 0
}

/**
 * Lists all invites for a project created by the assessor.
 */
export async function listProjectInvites(
  projectId: string,
  assessorId: string
): Promise<InviteRow[]> {
  const sql = `
    SELECT * FROM app.invites
    WHERE project_id = $1 AND created_by = $2
    ORDER BY created_at DESC;
  `
  const res = await query<InviteRow>(sql, [projectId, assessorId])
  return res.rows
}

/**
 * Revokes a specific invite by ID.
 */
export async function revokeInvite(
  inviteId: string,
  assessorId: string
): Promise<InviteRow | null> {
  const sql = `
    UPDATE app.invites
    SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND created_by = $2
    RETURNING *;
  `
  const res = await query<InviteRow>(sql, [inviteId, assessorId])
  return res.rows[0] ?? null
}

/**
 * Resends an email invite (refreshes token, extends expiry).
 */
export async function resendInvite(
  inviteId: string,
  assessorId: string
): Promise<{ invite: InviteRow; rawToken: string } | null> {
  const rawToken = generateInviteToken()
  const tokenHash = hashToken(rawToken)
  const rawHint = rawToken.slice(0, 8)
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const sql = `
    UPDATE app.invites
    SET
      token_hash = $3,
      raw_token = $4,
      raw_token_hint = $5,
      expires_at = $6,
      status = 'sent',
      revoked_at = NULL,
      updated_at = NOW()
    WHERE id = $1 AND created_by = $2
    RETURNING *;
  `
  const res = await query<InviteRow>(sql, [
    inviteId,
    assessorId,
    tokenHash,
    rawToken,
    rawHint,
    newExpiresAt,
  ])

  if (!res.rows[0]) return null

  return {
    invite: res.rows[0],
    rawToken,
  }
}

/**
 * Finds and validates an invite by its raw token.
 * Returns review page data including project details and assessor profile.
 */
export async function findInviteByRawToken(
  rawToken: string
): Promise<InviteWithProjectDetails | null> {
  const tokenHash = hashToken(rawToken)

  const sql = `
    SELECT
      i.*,
      p.name AS project_name,
      p.description AS project_description,
      p.difficulty,
      p.tech_stack,
      p.category,
      p.visibility,
      p.frontend_tech,
      p.backend_tech,
      p.database_tech,
      u.display_name AS assessor_name,
      u.organization AS assessor_organization,
      u.title AS assessor_title
    FROM app.invites i
    JOIN app.projects p ON i.project_id = p.id
    LEFT JOIN app.user_roles u ON i.created_by = u.clerk_user_id
    WHERE (i.token_hash = $1 OR i.raw_token = $2)
    LIMIT 1;
  `

  const res = await query<InviteWithProjectDetails>(sql, [tokenHash, rawToken])
  return res.rows[0] ?? null
}

/**
 * Accepts an invite and creates a live candidate assessment session.
 */
export async function acceptInviteAndCreateSession(input: {
  rawToken: string
  candidateId: string
  candidateEmail?: string
  durationMins?: number
}): Promise<{ session: SessionRow; invite: InviteRow }> {
  const tokenHash = hashToken(input.rawToken)

  // 1. Fetch invite
  const findRes = await query<InviteRow>(
    `SELECT * FROM app.invites WHERE (token_hash = $1 OR raw_token = $2) LIMIT 1;`,
    [tokenHash, input.rawToken]
  )
  const invite = findRes.rows[0]

  if (!invite) {
    throw new Error("Invalid or unrecognized invitation token.")
  }

  // 2. Validate status and expiry
  if (invite.status === "revoked" || invite.revoked_at) {
    throw new Error("This invitation has been revoked by the assessor.")
  }

  if (new Date(invite.expires_at) < new Date()) {
    throw new Error("This invitation link has expired.")
  }

  if (invite.use_count >= invite.max_uses) {
    throw new Error("This invitation has already been accepted.")
  }

  // 3. For private email invites, verify email match if candidateEmail is provided
  if (invite.type === "email" && invite.email && input.candidateEmail) {
    if (invite.email.toLowerCase() !== input.candidateEmail.toLowerCase()) {
      throw new Error(
        `This invite is restricted to ${invite.email}. Please sign in with the invited email address.`
      )
    }
  }

  // 4. Update invite use count and status
  const nextStatus = invite.type === "email" ? "accepted" : invite.status
  const updateInviteSql = `
    UPDATE app.invites
    SET
      use_count = use_count + 1,
      status = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `
  const updatedInviteRes = await query<InviteRow>(updateInviteSql, [
    invite.id,
    nextStatus,
  ])
  const updatedInvite = updatedInviteRes.rows[0]

  // 5. Create session
  const durationMins = input.durationMins ?? 120
  const startedAt = new Date()
  const endsAt = new Date(startedAt.getTime() + durationMins * 60 * 1000)

  const sessionSql = `
    INSERT INTO app.sessions (
      invite_id,
      candidate_id,
      candidate_email,
      project_id,
      status,
      started_at,
      ends_at,
      duration_mins
    )
    VALUES ($1, $2, $3, $4, 'ready', $5, $6, $7)
    RETURNING *;
  `
  const sessionRes = await query<SessionRow>(sessionSql, [
    invite.id,
    input.candidateId,
    input.candidateEmail ?? null,
    invite.project_id,
    startedAt,
    endsAt,
    durationMins,
  ])

  return {
    session: sessionRes.rows[0],
    invite: updatedInvite,
  }
}
