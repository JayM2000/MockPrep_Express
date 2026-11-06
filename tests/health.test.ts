import { describe, it, expect } from "vitest"
import request from "supertest"
import { app } from "../src/app"

describe("Express API Foundation Tests", () => {
  it("GET /health should return 200 OK with service details", async () => {
    const res = await request(app).get("/health")

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("status", "ok")
    expect(res.body).toHaveProperty("service", "mockprep-express-api")
    expect(res.body).toHaveProperty("timestamp")
    expect(res.body).toHaveProperty("uptimeSeconds")
  })

  it("GET /non-existent-route should trigger 404 AppError", async () => {
    const res = await request(app).get("/non-existent-route")

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty("error")
    expect(res.body.error.statusCode).toBe(404)
    expect(res.body.error.message).toContain("Cannot GET /non-existent-route")
  })
})
