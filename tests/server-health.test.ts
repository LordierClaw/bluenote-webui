import { afterEach, describe, expect, test } from "vitest"
import { createServer } from "../src/server/index.js"
import { resetWorkspaceForTests } from "../src/server/services/workspace-service.js"

function listen(server: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address && typeof address === "object") resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

afterEach(() => resetWorkspaceForTests())

describe("server health", () => {
  test("returns health and defaults to localhost", async () => {
    const server = createServer()
    const baseUrl = await listen(server)
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ app: "bluenote-webui", status: "ok", host: "127.0.0.1" })
    } finally {
      server.close()
    }
  })

  test("does not serve workspace internals", async () => {
    const server = createServer()
    const baseUrl = await listen(server)
    try {
      const response = await fetch(`${baseUrl}/.data/ai/codex-auth.json`)
      expect(response.status).toBe(404)
    } finally {
      server.close()
    }
  })
})
