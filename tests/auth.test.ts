import { describe, it, expect, afterAll } from "vitest"
import request from "supertest"
import { app } from "../src/app"
import { PROJECT_PATHS } from "../src/utils/project.paths"
import { closeDbPool } from "../src/database/connection"

const cleanUpIds: string[] = []

afterAll(async () => {
  for (const id of cleanUpIds) {
    await request(app)
      .delete(PROJECT_PATHS.full.byId(id))
      .set("x-test-user-id", "owner_user_1")
      .set("x-test-role", "assessor")
  }
  await closeDbPool()
})

describe("Authentication & Resource Authorization (Phase 7)", () => {
  describe("Authentication (AuthN) — 401 Unauthorized", () => {
    it("returns 401 when creating a project without an auth token", async () => {
      const res = await request(app)
        .post(PROJECT_PATHS.full.create)
        .send({
          name: "Unauthenticated Project",
          description: "This should fail because no session token is provided",
          complexity: "intermediate",
        })
        .expect(401)

      expect(res.body.error).toBeDefined()
      expect(res.body.error.statusCode).toBe(401)
      expect(res.body.error.message).toContain("Authentication required")
    })

    it("returns 401 when deleting a project without an auth token", async () => {
      const res = await request(app)
        .delete(PROJECT_PATHS.full.byId("any-project-id"))
        .expect(401)

      expect(res.body.error.statusCode).toBe(401)
      expect(res.body.error.message).toContain("Authentication required")
    })
  })

  describe("Authorization (AuthZ) & Ownership — 403 Forbidden", () => {
    it("assigns verified user identity to created project and blocks non-owner from deleting it", async () => {
      const ownerId = "owner_user_1"
      const attackerId = "malicious_user_2"

      // 1. Owner creates the project
      const createRes = await request(app)
        .post(PROJECT_PATHS.full.create)
        .set("x-test-user-id", ownerId)
        .set("x-test-role", "assessor")
        .send({
          name: "Ownership Protected Project",
          description: "Testing that only the legitimate creator can delete this",
          complexity: "advanced",
          category: "Security",
        })
        .expect(201)

      const projectId = createRes.body.id
      cleanUpIds.push(projectId)
      expect(createRes.body.ownerId).toBe(ownerId)

      // 2. Another user (attacker) tries to delete it -> Must return 403 Forbidden
      const unauthorizedDeleteRes = await request(app)
        .delete(PROJECT_PATHS.full.byId(projectId))
        .set("x-test-user-id", attackerId)
        .set("x-test-role", "assessor")
        .expect(403)

      expect(unauthorizedDeleteRes.body.error.statusCode).toBe(403)
      expect(unauthorizedDeleteRes.body.error.message).toContain("Forbidden")

      // 3. Confirm project still exists
      const checkRes = await request(app)
        .get(PROJECT_PATHS.full.byId(projectId))
        .expect(200)

      expect(checkRes.body.id).toBe(projectId)

      // 4. Legitimate owner deletes it -> Succeeds with 200 OK
      const ownerDeleteRes = await request(app)
        .delete(PROJECT_PATHS.full.byId(projectId))
        .set("x-test-user-id", ownerId)
        .set("x-test-role", "assessor")
        .expect(200)

      expect(ownerDeleteRes.body.message).toBe("Project deleted")

      // 5. Confirm project is gone
      await request(app)
        .get(PROJECT_PATHS.full.byId(projectId))
        .expect(404)
    })
  })
})
