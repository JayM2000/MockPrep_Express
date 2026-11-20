import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import { app } from "../src/app"
import { upsertUserRole } from "../src/modules/users/user-role.repository"
import { createProject } from "../src/modules/projects/project.repository"

describe("Invite & Share Routes (Section 8 Architecture)", () => {
  const assessorId = "test-assessor-invite-user"
  const candidateId = "test-candidate-invite-user"
  let publicProjectId: string
  let privateProjectId: string

  beforeAll(async () => {
    // Setup roles
    await upsertUserRole({
      clerk_user_id: assessorId,
      role: "assessor",
      display_name: "Assessor Dave",
      organization: "Acme Cloud",
      title: "Senior Architect",
    })

    await upsertUserRole({
      clerk_user_id: candidateId,
      role: "candidate",
      display_name: "Candidate Alice",
    })

    // Setup public project
    const pubProj = await createProject({
      id: "pub-proj-" + Date.now(),
      name: "Public Distributed Cache",
      description: "Distributed cache design",
      difficulty: "Advanced",
      category: "Backend Systems",
      frontend_tech: "React 19",
      backend_tech: "Node.js (TypeScript)",
      database_tech: "PostgreSQL 16",
      tech_stack: ["TypeScript", "Node.js", "Redis"],
      tags: ["Distributed", "Cache"],
      status: "published",
      visibility: "public",
      share_token: "pub-share-" + Date.now(),
      expiry_days: 14,
      created_by: assessorId,
    })
    publicProjectId = pubProj.id

    // Setup private project
    const privProj = await createProject({
      id: "priv-proj-" + Date.now(),
      name: "Private High-Frequency Order Book",
      description: "Internal confidential trading engine",
      difficulty: "Advanced",
      category: "Fintech",
      frontend_tech: "Next.js 15",
      backend_tech: "Go",
      database_tech: "PostgreSQL 16",
      tech_stack: ["Go", "PostgreSQL"],
      tags: ["Fintech", "Trading"],
      status: "published",
      visibility: "private",
      share_token: "priv-share-" + Date.now(),
      expiry_days: 7,
      created_by: assessorId,
    })
    privateProjectId = privProj.id
  })

  it("POST /projects/:id/invites sends email invites for private project", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${privateProjectId}/invites`)
      .set("x-test-user-id", assessorId)
      .send({
        emails: ["candidate1@test.com", "candidate2@test.com"],
        message: "Please complete this assessment within 7 days",
      })
      .expect(201)

    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(2)
    expect(res.body[0].type).toBe("email")
    expect(res.body[0].status).toBe("sent")
    expect(res.body[0].rawToken).toBeDefined()
    expect(res.body[0].email).toBe("candidate1@test.com")
  })

  it("POST /projects/:id/public-link creates a public link for a public project", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${publicProjectId}/public-link`)
      .set("x-test-user-id", assessorId)
      .send({ maxUses: 25, expiryDays: 14 })
      .expect(200)

    expect(res.body.type).toBe("public_link")
    expect(res.body.maxUses).toBe(25)
    expect(res.body.rawToken).toBeDefined()
  })

  it("POST /projects/:id/public-link rejects creating a public link for a private project (400)", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${privateProjectId}/public-link`)
      .set("x-test-user-id", assessorId)
      .send({ maxUses: 10 })
      .expect(400)

    expect(res.body.error.message).toContain("Public links are disabled for private projects")
  })

  it("GET /projects/:id/invites lists all invites for the project", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${privateProjectId}/invites`)
      .set("x-test-user-id", assessorId)
      .expect(200)

    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(2)
  })

  it("GET /invites/validate/:token returns review page data", async () => {
    // 1. Create an invite
    const inviteRes = await request(app)
      .post(`/api/v1/projects/${privateProjectId}/invites`)
      .set("x-test-user-id", assessorId)
      .send({ emails: ["alice@example.com"] })
      .expect(201)

    const rawToken = inviteRes.body[0].rawToken

    // 2. Validate token
    const validateRes = await request(app)
      .get(`/api/v1/invites/validate/${rawToken}?email=alice@example.com`)
      .set("x-test-user-id", candidateId)
      .expect(200)

    expect(validateRes.body.project.name).toBe("Private High-Frequency Order Book")
    expect(validateRes.body.assessor.organization).toBe("Acme Cloud")
    expect(validateRes.body.invite.type).toBe("email")
    expect(validateRes.body.isEmailMatch).toBe(true)
  })

  it("POST /invites/accept/:token accepts invite and creates live session", async () => {
    // 1. Create an invite
    const inviteRes = await request(app)
      .post(`/api/v1/projects/${publicProjectId}/public-link`)
      .set("x-test-user-id", assessorId)
      .send({ maxUses: 10 })
      .expect(200)

    const rawToken = inviteRes.body.rawToken

    // 2. Accept invite
    const acceptRes = await request(app)
      .post(`/api/v1/invites/accept/${rawToken}`)
      .set("x-test-user-id", candidateId)
      .send({ candidateEmail: "candidate@alice.io" })
      .expect(201)

    expect(acceptRes.body.sessionId).toBeDefined()
    expect(acceptRes.body.projectId).toBe(publicProjectId)
    expect(acceptRes.body.status).toBe("ready")
    expect(acceptRes.body.durationMins).toBe(120)
  })

  it("POST /invites/:id/revoke revokes an invite and blocks validation (410)", async () => {
    // 1. Create an invite
    const inviteRes = await request(app)
      .post(`/api/v1/projects/${privateProjectId}/invites`)
      .set("x-test-user-id", assessorId)
      .send({ emails: ["revokeme@test.com"] })
      .expect(201)

    const inviteId = inviteRes.body[0].id
    const rawToken = inviteRes.body[0].rawToken

    // 2. Revoke it
    await request(app)
      .post(`/api/v1/invites/${inviteId}/revoke`)
      .set("x-test-user-id", assessorId)
      .expect(200)

    // 3. Validating revoked token returns 410 Gone
    const validateRes = await request(app)
      .get(`/api/v1/invites/validate/${rawToken}`)
      .set("x-test-user-id", candidateId)
      .expect(410)

    expect(validateRes.body.error.message).toContain("revoked")
  })
})
