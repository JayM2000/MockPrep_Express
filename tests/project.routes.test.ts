import { describe, it, expect, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/app"
import { PROJECT_PATHS } from "../src/utils/project.paths"
import { USER_PATHS } from "../src/utils/user.paths"
import { SHARED_PATHS } from "../src/utils/shared.paths"
import { closeDbPool } from "../src/database/connection"

// Track IDs created during the test so we can clean them up
const createdIds: string[] = []

// Phase 8: test users with explicit roles
const ASSESSOR_USER = "test-assessor-phase8"
const CANDIDATE_USER = "test-candidate-phase8"

afterAll(async () => {
  // Clean up any test projects (must use assessor role + owner token)
  for (const id of createdIds) {
    await request(app)
      .delete(PROJECT_PATHS.full.byId(id))
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
  }
  await closeDbPool()
})

// ---------------------------------------------------------------------------
// Project CRUD — POST (Assessor only)
// ---------------------------------------------------------------------------
describe("Project Routes — POST /api/v1/projects", () => {
  it("creates a project and returns 201 with the full project (Assessor)", async () => {
    const payload = {
      name: "Test Integration Project",
      description: "An automated test project for Phase 8 route verification",
      category: "Testing",
      frontendTech: "React",
      backendTech: "Express",
      database: "PostgreSQL",
      complexity: "intermediate",
      tags: ["test", "integration"],
      visibility: "public",
      expiryDays: 14,
    }

    const res = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send(payload)
      .expect(201)

    expect(res.body).toMatchObject({
      name: "Test Integration Project",
      description: "An automated test project for Phase 8 route verification",
      category: "Testing",
      frontendTech: "React",
      backendTech: "Express",
      database: "PostgreSQL",
      complexity: "intermediate",
      status: "draft",
      ownerId: ASSESSOR_USER,
      tags: ["test", "integration"],
      visibility: "public",
      expiryDays: 14,
    })
    expect(res.body.id).toBeDefined()
    expect(res.body.shareToken).toBeDefined()
    expect(res.body.expiresAt).toBeDefined()
    expect(res.body.createdAt).toBeDefined()
    expect(res.body.updatedAt).toBeDefined()

    createdIds.push(res.body.id)
  })

  it("returns 403 when a Candidate tries to create a project", async () => {
    const res = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", CANDIDATE_USER)
      .set("x-test-role", "candidate")
      .send({
        name: "Unauthorized Project",
        description: "Candidates should not be allowed to create projects",
        complexity: "intermediate",
      })
      .expect(403)

    expect(res.body.error.message).toContain("assessor")
  })

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({ description: "No name provided in this payload at all" })
      .expect(400)

    expect(res.body.error.message).toContain("name")
  })

  it("returns 400 when name is too short", async () => {
    const res = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({ name: "ab", description: "Short name test with valid description" })
      .expect(400)

    expect(res.body.error.message).toContain("name")
  })

  it("returns 400 when description is too short", async () => {
    const res = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({ name: "Valid Name", description: "short" })
      .expect(400)

    expect(res.body.error.message).toContain("description")
  })

  it("returns 400 for invalid complexity value", async () => {
    const res = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({
        name: "Valid Name Here",
        description: "Valid description that is long enough",
        complexity: "legendary",
      })
      .expect(400)

    expect(res.body.error.message).toContain("complexity")
  })

  it("returns 400 when expiryDays exceeds 30", async () => {
    const res = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({
        name: "Expiry Validation Test",
        description: "Testing that expiry days cannot exceed 30 days max",
        complexity: "beginner",
        expiryDays: 99,
      })
      .expect(400)

    expect(res.body.error.message).toContain("expiryDays")
  })
})

// ---------------------------------------------------------------------------
// Project List — GET (role-aware)
// ---------------------------------------------------------------------------
describe("Project Routes — GET /api/v1/projects", () => {
  it("Assessor sees their own projects (any visibility)", async () => {
    // Create a private project first
    const createRes = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({
        name: "Private Assessor Project",
        description: "This private project should only appear for the assessor",
        complexity: "intermediate",
        visibility: "private",
        expiryDays: 7,
      })
      .expect(201)

    createdIds.push(createRes.body.id)

    const res = await request(app)
      .get(PROJECT_PATHS.full.list)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .expect(200)

    expect(Array.isArray(res.body)).toBe(true)
    // Assessor's own private project should appear
    const found = res.body.find((p: { id: string }) => p.id === createRes.body.id)
    expect(found).toBeDefined()
  })

  it("Candidate only sees public projects", async () => {
    const res = await request(app)
      .get(PROJECT_PATHS.full.list)
      .set("x-test-user-id", CANDIDATE_USER)
      .set("x-test-role", "candidate")
      .expect(200)

    expect(Array.isArray(res.body)).toBe(true)
    // All returned projects must be public
    res.body.forEach((p: { visibility: string }) => {
      expect(p.visibility).toBe("public")
    })
  })
})

// ---------------------------------------------------------------------------
// Project Detail — GET /:projectId
// ---------------------------------------------------------------------------
describe("Project Routes — GET /api/v1/projects/:projectId", () => {
  it("returns 200 with a project that exists", async () => {
    const createRes = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({
        name: "Get By Id Test Project",
        description: "Project to test the GET by ID endpoint in Phase 8",
        category: "QA",
        complexity: "beginner",
        visibility: "public",
        expiryDays: 7,
      })
      .expect(201)

    const projectId = createRes.body.id
    createdIds.push(projectId)

    const res = await request(app)
      .get(PROJECT_PATHS.full.byId(projectId))
      .expect(200)

    expect(res.body.id).toBe(projectId)
    expect(res.body.name).toBe("Get By Id Test Project")
    expect(res.body.visibility).toBe("public")
    expect(res.body.shareToken).toBeDefined()
  })

  it("returns 404 for a non-existent project", async () => {
    const res = await request(app)
      .get(PROJECT_PATHS.full.byId("does-not-exist-at-all"))
      .expect(404)

    expect(res.body.error.message).toContain("not found")
  })
})

// ---------------------------------------------------------------------------
// Project Delete — DELETE /:projectId (Assessor + Owner)
// ---------------------------------------------------------------------------
describe("Project Routes — DELETE /api/v1/projects/:projectId", () => {
  it("deletes an existing project and returns 200 when requested by owner Assessor", async () => {
    const createRes = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({
        name: "Delete Me Test Project",
        description: "This project should be deleted by the test suite",
        complexity: "advanced",
        visibility: "private",
        expiryDays: 7,
      })
      .expect(201)

    const projectId = createRes.body.id

    const deleteRes = await request(app)
      .delete(PROJECT_PATHS.full.byId(projectId))
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .expect(200)

    expect(deleteRes.body.message).toBe("Project deleted")

    await request(app)
      .get(PROJECT_PATHS.full.byId(projectId))
      .expect(404)
  })

  it("returns 403 when Candidate tries to delete a project", async () => {
    // First create a project as assessor
    const createRes = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({
        name: "Protected Delete Project",
        description: "Candidates should not be allowed to delete this project",
        complexity: "intermediate",
        visibility: "private",
        expiryDays: 7,
      })
      .expect(201)

    const projectId = createRes.body.id
    createdIds.push(projectId)

    await request(app)
      .delete(PROJECT_PATHS.full.byId(projectId))
      .set("x-test-user-id", CANDIDATE_USER)
      .set("x-test-role", "candidate")
      .expect(403)
  })

  it("returns 404 when deleting a non-existent project", async () => {
    await request(app)
      .delete(PROJECT_PATHS.full.byId("ghost-project-id"))
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .expect(404)
  })
})

// ---------------------------------------------------------------------------
// Shared Link — GET /api/v1/shared/:shareToken
// ---------------------------------------------------------------------------
describe("Shared Link Routes — GET /api/v1/shared/:shareToken", () => {
  it("returns 200 for any registered user with a valid share token", async () => {
    // Create a private project
    const createRes = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({
        name: "Shared Link Project",
        description: "This private project is accessible via its share token",
        complexity: "intermediate",
        visibility: "private",
        expiryDays: 30,
      })
      .expect(201)

    createdIds.push(createRes.body.id)
    const shareToken = createRes.body.shareToken
    expect(shareToken).toBeDefined()

    // Candidate accesses via share token
    const res = await request(app)
      .get(SHARED_PATHS.full.byToken(shareToken))
      .set("x-test-user-id", CANDIDATE_USER)
      .expect(200)

    expect(res.body.id).toBe(createRes.body.id)
    expect(res.body.name).toBe("Shared Link Project")
    // share_token is NOT exposed in shared link response
    expect(res.body.shareToken).toBeUndefined()
  })

  it("returns 404 for an unknown share token", async () => {
    const res = await request(app)
      .get(SHARED_PATHS.full.byToken("completely-unknown-token-xyz"))
      .set("x-test-user-id", CANDIDATE_USER)
      .expect(404)

    expect(res.body.error.message).toContain("not found")
  })

  it("returns 401 when no auth token is provided on shared link", async () => {
    await request(app)
      .get(SHARED_PATHS.full.byToken("any-token"))
      .expect(401)
  })
})

// ---------------------------------------------------------------------------
// Bookmarks — POST/DELETE /:projectId/bookmark (Candidates only)
// ---------------------------------------------------------------------------
describe("Bookmarks — Candidate bookmark/unbookmark", () => {
  let bookmarkProjectId: string

  it("Candidate can bookmark a public project", async () => {
    // Create a public project to bookmark
    const createRes = await request(app)
      .post(PROJECT_PATHS.full.create)
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .send({
        name: "Bookmarkable Project",
        description: "A public project that candidates can bookmark to save",
        complexity: "beginner",
        visibility: "public",
        expiryDays: 14,
      })
      .expect(201)

    bookmarkProjectId = createRes.body.id
    createdIds.push(bookmarkProjectId)

    const res = await request(app)
      .post(`${PROJECT_PATHS.full.create}/${bookmarkProjectId}/bookmark`.replace("//", "/"))
      .set("x-test-user-id", CANDIDATE_USER)
      .set("x-test-role", "candidate")
      .expect(201)

    expect(res.body.projectId).toBe(bookmarkProjectId)
    expect(res.body.clerkUserId).toBe(CANDIDATE_USER)
  })

  it("Candidate can remove a bookmark", async () => {
    if (!bookmarkProjectId) return
    await request(app)
      .delete(`${PROJECT_PATHS.full.create}/${bookmarkProjectId}/bookmark`.replace("//", "/"))
      .set("x-test-user-id", CANDIDATE_USER)
      .set("x-test-role", "candidate")
      .expect(204)
  })

  it("Assessor cannot bookmark a project (403)", async () => {
    if (!bookmarkProjectId) return
    const res = await request(app)
      .post(`${PROJECT_PATHS.full.create}/${bookmarkProjectId}/bookmark`.replace("//", "/"))
      .set("x-test-user-id", ASSESSOR_USER)
      .set("x-test-role", "assessor")
      .expect(403)

    expect(res.body.error.message).toContain("candidate")
  })
})

// ---------------------------------------------------------------------------
// User Role Routes — POST /api/v1/users/role, GET /api/v1/users/me
// ---------------------------------------------------------------------------
describe("User Role Routes", () => {
  it("sets a user role after onboarding", async () => {
    const res = await request(app)
      .post(USER_PATHS.full.role)
      .set("x-test-user-id", "onboarding-test-user")
      .send({ role: "candidate" })
      .expect(200)

    expect(res.body.clerkUserId).toBe("onboarding-test-user")
    expect(res.body.role).toBe("candidate")
  })

  it("returns 400 for an invalid role value", async () => {
    const res = await request(app)
      .post(USER_PATHS.full.role)
      .set("x-test-user-id", "bad-role-user")
      .send({ role: "admin" })
      .expect(400)

    expect(res.body.error.message).toContain("role")
  })

  it("GET /me returns null role for user who has not onboarded", async () => {
    const res = await request(app)
      .get(USER_PATHS.full.me)
      .set("x-test-user-id", "brand-new-no-role-user")
      .expect(200)

    expect(res.body.role).toBeNull()
  })

  it("GET /me returns role after onboarding", async () => {
    const userId = "me-test-user"
    await request(app)
      .post(USER_PATHS.full.role)
      .set("x-test-user-id", userId)
      .send({ role: "assessor" })
      .expect(200)

    const res = await request(app)
      .get(USER_PATHS.full.me)
      .set("x-test-user-id", userId)
      .expect(200)

    expect(res.body.role).toBe("assessor")
    expect(res.body.isAssessorRegistered).toBe(true)
  })

  it("activates assessor persona for candidate with organization and title", async () => {
    const userId = "candidate-to-assessor-user"
    // Initially candidate
    await request(app)
      .post(USER_PATHS.full.role)
      .set("x-test-user-id", userId)
      .send({ role: "candidate" })
      .expect(200)

    // Activate assessor
    const res = await request(app)
      .post("/api/v1/users/activate-assessor")
      .set("x-test-user-id", userId)
      .send({
        organization: "TechCorp Labs",
        title: "Staff Systems Architect",
      })
      .expect(200)

    expect(res.body.role).toBe("assessor")
    expect(res.body.isAssessorRegistered).toBe(true)
    expect(res.body.organization).toBe("TechCorp Labs")
    expect(res.body.title).toBe("Staff Systems Architect")
  })

  it("returns 400 when activating assessor without mandatory organization or title", async () => {
    const userId = "missing-fields-user"
    const res = await request(app)
      .post("/api/v1/users/activate-assessor")
      .set("x-test-user-id", userId)
      .send({ organization: "" })
      .expect(400)

    expect(res.body.error.message).toContain("Organization")
  })

  it("activates assessor with optional extended profile fields", async () => {
    const userId = "extended-assessor-user"
    const res = await request(app)
      .post("/api/v1/users/activate-assessor")
      .set("x-test-user-id", userId)
      .send({
        organization: "DeepMind Alpha",
        title: "Principal Engineer",
        evaluationTrack: "Backend & Distributed Systems",
        targetLevel: "Senior / Staff (5+ years)",
        websiteOrLinkedin: "https://linkedin.com/in/example",
        bio: "Focused on high throughput and resilient microservices",
      })
      .expect(200)

    expect(res.body.organization).toBe("DeepMind Alpha")
    expect(res.body.title).toBe("Principal Engineer")
    expect(res.body.evaluationTrack).toBe("Backend & Distributed Systems")
    expect(res.body.targetLevel).toBe("Senior / Staff (5+ years)")
    expect(res.body.websiteOrLinkedin).toBe("https://linkedin.com/in/example")
    expect(res.body.bio).toBe("Focused on high throughput and resilient microservices")
  })
})
