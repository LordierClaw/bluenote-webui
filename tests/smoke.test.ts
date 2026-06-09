import os from "node:os"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { describe, expect, test } from "vitest"
import { createServer } from "../src/server/index.js"

function listen(server: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address && typeof address === "object") resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

async function json<T>(baseUrl: string, route: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  const response = await fetch(`${baseUrl}${route}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
  expect(response.ok).toBe(true)
  return response.json() as Promise<T>
}

describe("local smoke", () => {
  test("initializes, creates, searches, gets, and saves a draft", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-smoke-"))
    const server = createServer()
    const baseUrl = await listen(server)
    try {
      await json(baseUrl, "/api/health")
      await json(baseUrl, "/api/workspace/init", { rootPath: root })
      const created = await json<{ key: string }>(baseUrl, "/api/notes", { type: "draft", body: "smoke literal" })
      const search = await json<unknown[]>(baseUrl, "/api/notes?query=smoke")
      expect(search.length).toBe(1)
      await json(baseUrl, `/api/notes/${created.key}`)
      const saved = await json<{ body: string }>(baseUrl, `/api/notes/${created.key}`, { body: "saved smoke literal" }, "PATCH")
      expect(saved.body).toBe("saved smoke literal")
    } finally {
      server.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
