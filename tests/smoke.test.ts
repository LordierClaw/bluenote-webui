import os from "node:os"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"
import type { AiTextGenerationClient } from "@lordierclaw/bluenote-core"
import { createServer } from "../src/server/index.js"
import { setAiClientFactoryForTests } from "../src/server/services/ai-service.js"
import { resetWorkspaceForTests } from "../src/server/services/workspace-service.js"

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

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

afterEach(() => {
  setAiClientFactoryForTests(null)
  resetWorkspaceForTests()
})

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
      await closeServer(server)
      await rm(root, { recursive: true, force: true })
    }
  })

  test("runs queue-first AI description flow through real server without exposing secrets or changing Markdown", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-ai-smoke-"))
    const server = createServer()
    const baseUrl = await listen(server)
    const rawApiKey = "smoke-raw-api-key-value"
    const generatedDescription = "Smoke queued AI description from fake provider."
    const savedBody = "Saved markdown body remains unchanged."
    const responseBodies: string[] = []
    let providerCalls = 0
    const fakeClient: AiTextGenerationClient = {
      async createChatCompletion() {
        providerCalls += 1
        return { text: generatedDescription }
      },
    }
    setAiClientFactoryForTests(() => fakeClient)

    async function smokeJson<T>(route: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
      const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const text = await response.text()
      responseBodies.push(text)
      expect(response.ok).toBe(true)
      return JSON.parse(text) as T
    }

    try {
      await smokeJson("/api/health")
      await smokeJson("/api/workspace/init", { rootPath: root })
      const created = await smokeJson<{ key: string; body: string }>("/api/notes", { type: "draft", body: "Original markdown body." })
      expect(created.body).toBe("Original markdown body.")

      const savedConfig = await smokeJson<{ configured: true; apiKeyMasked: string }>("/api/ai/config", {
        version: 1,
        enabled: true,
        provider: "openai-compatible",
        baseUrl: "https://example.invalid/v1",
        apiKey: rawApiKey,
        model: "gpt-smoke",
        logging: { usage: true, conversations: false, results: true },
        maxAttempts: 3,
        outputLanguage: "English",
      })
      expect(savedConfig).toMatchObject({ configured: true, apiKeyMasked: expect.any(String) })

      const saved = await smokeJson<{ key: string; body: string }>(`/api/notes/${created.key}`, { body: savedBody }, "PATCH")
      expect(saved.body).toBe(savedBody)

      const enqueued = await smokeJson<{ enqueued: boolean; queue: { pending: number } }>("/api/ai/queue/describe", { selector: created.key })
      expect(enqueued).toMatchObject({ enqueued: true, queue: { pending: 1 } })
      expect(providerCalls).toBe(0)

      const processed = await smokeJson<{ applied: number; failed: number; remaining: number; setupBlocked: boolean }>("/api/ai/process-queue", { limit: 1 })
      expect(processed).toEqual({ applied: 1, failed: 0, remaining: 0, setupBlocked: false })
      expect(providerCalls).toBe(1)

      const fetched = await smokeJson<{ key: string; body: string; description: string }>(`/api/notes/${created.key}`)
      expect(fetched.body).toBe(savedBody)
      expect(fetched.description).toBe(generatedDescription)

      const notes = await smokeJson<Array<{ key: string; description: string }>>("/api/notes?folder=all")
      expect(notes.find((note) => note.key === created.key)?.description).toBe(generatedDescription)

      const search = await smokeJson<Array<{ key: string }>>(`/api/notes?folder=all&query=${encodeURIComponent(generatedDescription)}`)
      expect(search.map((note) => note.key)).toContain(created.key)
      const searchedNote = await smokeJson<{ key: string; description: string }>(`/api/notes/${search.find((note) => note.key === created.key)?.key}`)
      expect(searchedNote.description).toBe(generatedDescription)

      expect(responseBodies.join("\n")).not.toContain(rawApiKey)
    } finally {
      await closeServer(server)
      await rm(root, { recursive: true, force: true })
    }
  })
})
