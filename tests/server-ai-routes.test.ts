import os from "node:os"
import path from "node:path"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"

import { createServer } from "../src/server/index.js"
import { initWorkspace, resetWorkspaceForTests } from "../src/server/services/workspace-service.js"

const roots: string[] = []

async function setupRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-ai-routes-"))
  roots.push(root)
  await mkdir(path.join(root, ".data", "ai"), { recursive: true })
  initWorkspace(root)
  return root
}

async function startServer() {
  const server = createServer()
  const baseUrl = await new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address && typeof address === "object") resolve(`http://127.0.0.1:${address.port}`)
    })
  })
  return { server, baseUrl }
}

async function requestJson(baseUrl: string, route: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  return {
    status: response.status,
    json: await response.json(),
  }
}

afterEach(async () => {
  resetWorkspaceForTests()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("server AI routes", () => {
  test("config show/save, queue listing, and codex auth status are available", async () => {
    await setupRoot()
    const { server, baseUrl } = await startServer()

    try {
      const freshConfig = await requestJson(baseUrl, "/api/ai/config")
      expect(freshConfig.status).toBe(200)
      expect(freshConfig.json).toMatchObject({ configured: false })

      const saveConfig = await requestJson(baseUrl, "/api/ai/config", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          enabled: true,
          provider: "openai-compatible",
          baseUrl: "https://example.invalid/v1",
          apiKey: "super-secret-key",
          model: "gpt-test",
          logging: { usage: true, conversations: false, results: true },
          maxAttempts: 4,
          outputLanguage: "English",
        }),
      })
      expect(saveConfig.status).toBe(200)
      expect(saveConfig.json).toMatchObject({ configured: true, provider: "openai-compatible", apiKeyMasked: expect.any(String) })
      expect(JSON.stringify(saveConfig.json)).not.toContain("super-secret-key")

      const shownConfig = await requestJson(baseUrl, "/api/ai/config")
      expect(shownConfig.status).toBe(200)
      expect(shownConfig.json).toMatchObject({
        configured: true,
        provider: "openai-compatible",
        baseUrl: "https://example.invalid/v1",
        model: "gpt-test",
        apiKeyMasked: expect.any(String),
        maxAttempts: 4,
        outputLanguage: "English",
      })
      expect(JSON.stringify(shownConfig.json)).not.toContain("super-secret-key")

      const queue = await requestJson(baseUrl, "/api/ai/queue")
      expect(queue.status).toBe(200)
      expect(queue.json).toMatchObject({ jobs: [] })

      const authStatus = await requestJson(baseUrl, "/api/ai/codex-auth/status")
      expect(authStatus.status).toBe(200)
      expect(authStatus.json).toMatchObject({ state: "not-configured" })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
