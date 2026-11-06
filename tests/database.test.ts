import { describe, it, expect, afterAll } from "vitest"
import { checkDbHealth, closeDbPool } from "../src/database/connection"
import {
  createProject,
  findProjectById,
  deleteProject,
} from "../src/modules/projects/project.repository"

describe("Express PostgreSQL Database Foundation (app schema)", () => {
  afterAll(async () => {
    await closeDbPool()
  })

  it("successfully connects to Neon PostgreSQL and confirms health", async () => {
    const isHealthy = await checkDbHealth()
    expect(isHealthy).toBe(true)
  })

  it("creates, retrieves, and cleans up a project record in app.projects", async () => {
    const testId = `test_proj_${Date.now()}`
    const created = await createProject({
      id: testId,
      name: "Phase 5 Test Project",
      description: "Verifying Neon app schema connection",
      difficulty: "medium",
      tech_stack: ["TypeScript", "Express", "PostgreSQL"],
      repository_url: "https://github.com/test/repo",
      created_by: "user_test_123",
    })

    expect(created.id).toBe(testId)
    expect(created.name).toBe("Phase 5 Test Project")
    expect(created.tech_stack).toEqual(["TypeScript", "Express", "PostgreSQL"])

    // Query back
    const fetched = await findProjectById(testId)
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(testId)
    expect(fetched?.name).toBe("Phase 5 Test Project")

    // Cleanup
    const deleted = await deleteProject(testId)
    expect(deleted).toBe(true)

    // Confirm deleted
    const afterDelete = await findProjectById(testId)
    expect(afterDelete).toBeNull()
  })
})
