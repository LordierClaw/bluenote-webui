import os from "node:os"
import path from "node:path"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"
import { createAiConfigRepository, createAiQueueRepository, createBlueNoteCore, createCodexAuthRepository, type AiTextGenerationClient, type CodexAuth, type CodexAuthClient } from "@lordierclaw/bluenote-core"

import { createServer } from "../src/server/index.js"
import { setAiClientFactoryForTests, setCodexAuthClientFactoryForTests } from "../src/server/services/ai-service.js"
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
  setAiClientFactoryForTests(null)
  setCodexAuthClientFactoryForTests(null)
  resetWorkspaceForTests()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function makeCodexAuth(overrides: Partial<CodexAuth> = {}): CodexAuth {
  return {
    version: 1,
    provider: "codex",
    authType: "device-code-oauth",
    idToken: "secret-id-token-value",
    accessToken: "secret-access-token-value",
    refreshToken: "secret-refresh-token-value",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issuer: "https://auth.example.invalid",
    clientId: "test-client",
    ...overrides,
  }
}

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

  test("config save preserves omitted or blank OpenAI-compatible API keys without exposing raw secrets", async () => {
    const root = await setupRoot()
    createAiConfigRepository(root).write({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://old.example/v1",
      apiKey: "secret-token-value",
      model: "old-model",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })
    const { server, baseUrl } = await startServer()

    try {
      const savedMissing = await requestJson(baseUrl, "/api/ai/config", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          enabled: true,
          provider: "openai-compatible",
          baseUrl: "https://new.example/v1",
          model: "new-model",
          logging: { usage: false, conversations: false, results: true },
          maxAttempts: 5,
          outputLanguage: "日本語",
        }),
      })
      expect(savedMissing.status).toBe(200)
      expect(JSON.stringify(savedMissing.json)).not.toContain("secret-token-value")
      expect(createAiConfigRepository(root).read()).toMatchObject({
        provider: "openai-compatible",
        apiKey: "secret-token-value",
        baseUrl: "https://new.example/v1",
        model: "new-model",
      })

      const savedBlank = await requestJson(baseUrl, "/api/ai/config", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          enabled: true,
          provider: "openai-compatible",
          baseUrl: "https://blank.example/v1",
          apiKey: "",
          model: "blank-model",
          logging: { usage: true, conversations: false, results: false },
          maxAttempts: 2,
          outputLanguage: "English",
        }),
      })
      expect(savedBlank.status).toBe(200)
      expect(JSON.stringify(savedBlank.json)).not.toContain("secret-token-value")
      expect(createAiConfigRepository(root).read()).toMatchObject({
        provider: "openai-compatible",
        apiKey: "secret-token-value",
        baseUrl: "https://blank.example/v1",
        model: "blank-model",
      })

      const shownConfig = await requestJson(baseUrl, "/api/ai/config")
      expect(shownConfig.status).toBe(200)
      expect(JSON.stringify(shownConfig.json)).not.toContain("secret-token-value")
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  test("switching to Codex via route drops OpenAI-compatible secret fields", async () => {
    const root = await setupRoot()
    createAiConfigRepository(root).write({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://old.example/v1",
      apiKey: "secret-token-value",
      model: "old-model",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })
    const { server, baseUrl } = await startServer()

    try {
      const saved = await requestJson(baseUrl, "/api/ai/config", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          enabled: true,
          provider: "codex",
          baseUrl: "https://old.example/v1",
          apiKey: "secret-token-value",
          model: "gpt-5-codex",
          logging: { usage: true, conversations: false, results: true },
          maxAttempts: 3,
          outputLanguage: "English",
        }),
      })

      expect(saved.status).toBe(200)
      expect(JSON.stringify(saved.json)).not.toContain("secret-token-value")
      expect(saved.json).toMatchObject({ configured: true, provider: "codex" })
      const persisted = createAiConfigRepository(root).read()
      expect("apiKey" in persisted).toBe(false)
      expect("baseUrl" in persisted).toBe(false)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  test("invalid config returns a safe structured API error", async () => {
    await setupRoot()
    const { server, baseUrl } = await startServer()

    try {
      const result = await requestJson(baseUrl, "/api/ai/config", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          enabled: true,
          provider: "openai-compatible",
          baseUrl: "https://example.invalid/v1",
          apiKey: "",
          model: "gpt-test",
          logging: { usage: true, conversations: false, results: true },
          maxAttempts: 3,
          outputLanguage: "English",
        }),
      })

      expect(result.status).toBe(400)
      expect(result.json).toMatchObject({
        error: {
          code: "invalid_ai_config",
          message: expect.stringMatching(/api key/i),
        },
      })
      expect(JSON.stringify(result.json)).not.toContain("secret-token-value")
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  test("route can repair malformed existing config when a fresh API key is provided", async () => {
    const root = await setupRoot()
    await writeFile(path.join(root, ".data", "ai", "config.json"), "{ not valid json", "utf8")
    const { server, baseUrl } = await startServer()

    try {
      const saved = await requestJson(baseUrl, "/api/ai/config", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          enabled: true,
          provider: "openai-compatible",
          baseUrl: "https://example.invalid/v1",
          apiKey: "fresh-secret-token",
          model: "gpt-test",
          logging: { usage: true, conversations: false, results: true },
          maxAttempts: 3,
          outputLanguage: "English",
        }),
      })

      expect(saved.status).toBe(200)
      expect(JSON.stringify(saved.json)).not.toContain("fresh-secret-token")
      expect(createAiConfigRepository(root).read()).toMatchObject({
        provider: "openai-compatible",
        apiKey: "fresh-secret-token",
      })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  test("blank API key with malformed existing config returns a safe structured preservation error", async () => {
    const root = await setupRoot()
    await writeFile(path.join(root, ".data", "ai", "config.json"), "{ not valid json", "utf8")
    const { server, baseUrl } = await startServer()

    try {
      const result = await requestJson(baseUrl, "/api/ai/config", {
        method: "POST",
        body: JSON.stringify({
          version: 1,
          enabled: true,
          provider: "openai-compatible",
          baseUrl: "https://example.invalid/v1",
          apiKey: "",
          model: "gpt-test",
          logging: { usage: true, conversations: false, results: true },
          maxAttempts: 3,
          outputLanguage: "English",
        }),
      })

      expect(result.status).toBe(400)
      expect(result.json).toMatchObject({
        error: {
          code: "invalid_ai_config",
          message: expect.stringMatching(/existing API key could not be preserved/i),
        },
      })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  test("codex auth start, poll, status, and delete routes never expose tokens and keep AI config", async () => {
    const root = await setupRoot()
    createAiConfigRepository(root).write({
      version: 1,
      enabled: true,
      provider: "codex",
      model: "gpt-5-codex",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })
    const auth = makeCodexAuth()
    const fakeClient: Partial<CodexAuthClient> = {
      async startDeviceFlow() {
        return { deviceAuthId: "server-only-device-secret", userCode: "ABCD-EFGH", verificationUrl: "https://auth.example.invalid/codex/device", intervalSeconds: 1 }
      },
      async completeDeviceFlow(flow) {
        expect(flow.deviceAuthId).toBe("server-only-device-secret")
        return auth
      },
    }
    setCodexAuthClientFactoryForTests(() => fakeClient as CodexAuthClient)
    const { server, baseUrl } = await startServer()

    try {
      const setupRequired = await requestJson(baseUrl, "/api/ai/codex-auth/status")
      expect(setupRequired.status).toBe(200)
      expect(setupRequired.json).toMatchObject({ state: "setup-required" })

      const start = await requestJson(baseUrl, "/api/ai/codex-auth/start", { method: "POST" })
      expect(start.status).toBe(200)
      expect(start.json).toEqual({ verificationUrl: "https://auth.example.invalid/codex/device", userCode: "ABCD-EFGH", intervalSeconds: 1, state: "pending" })
      expect(JSON.stringify(start.json)).not.toContain("server-only-device-secret")

      const poll = await requestJson(baseUrl, "/api/ai/codex-auth/poll", { method: "POST" })
      expect(poll.status).toBe(200)
      expect(poll.json).toMatchObject({ state: "authenticated", auth: { state: "authenticated", issuer: "https://auth.example.invalid" } })
      expect(createCodexAuthRepository(root).read()).toMatchObject({ accessToken: "secret-access-token-value" })

      const status = await requestJson(baseUrl, "/api/ai/codex-auth/status")
      expect(status.status).toBe(200)
      expect(status.json).toMatchObject({ state: "authenticated", issuer: "https://auth.example.invalid" })

      const deleted = await requestJson(baseUrl, "/api/ai/codex-auth", { method: "DELETE" })
      expect(deleted.status).toBe(200)
      expect(deleted.json).toEqual({ ok: true })
      expect(createCodexAuthRepository(root).exists()).toBe(false)
      expect(createAiConfigRepository(root).read()).toMatchObject({ provider: "codex", model: "gpt-5-codex" })

      const serialized = JSON.stringify({ start: start.json, poll: poll.json, status: status.json, deleted: deleted.json })
      expect(serialized).not.toContain("secret-access-token-value")
      expect(serialized).not.toContain("secret-refresh-token-value")
      expect(serialized).not.toContain("secret-id-token-value")
      expect(serialized).not.toContain("server-only-device-secret")
      expect(serialized).not.toContain("accessToken")
      expect(serialized).not.toContain("refreshToken")
      expect(serialized).not.toContain("idToken")
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  test("queue describe route enqueues selected note without provider access", async () => {
    const root = await setupRoot()
    createAiConfigRepository(root).write({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://example.invalid/v1",
      apiKey: "secret-token-value",
      model: "gpt-test",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Route queue note",
      body: "Route enqueue should not call the provider.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    const { server, baseUrl } = await startServer()

    try {
      const result = await requestJson(baseUrl, "/api/ai/queue/describe", {
        method: "POST",
        body: JSON.stringify({ selector: note.key }),
      })

      expect(result.status).toBe(200)
      expect(result.json).toMatchObject({ key: note.key, relativePath: note.relativePath, enqueued: true, queue: { pending: 1, running: 0, failed: 0 } })
      const queue = createAiQueueRepository(root).read()
      expect(queue.jobs).toHaveLength(1)
      expect(queue.jobs[0]).toMatchObject({ kind: "describe-note", key: note.key, status: "pending", attempts: 0 })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  test("legacy describe route is enqueue-only and refreshes one queued job", async () => {
    const root = await setupRoot()
    createAiConfigRepository(root).write({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://example.invalid/v1",
      apiKey: "secret-token-value",
      model: "gpt-test",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Legacy queue note",
      body: "The legacy route should enqueue instead of generating now.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    const { server, baseUrl } = await startServer()

    try {
      const first = await requestJson(baseUrl, "/api/ai/describe", {
        method: "POST",
        body: JSON.stringify({ selector: note.key }),
      })
      const second = await requestJson(baseUrl, "/api/ai/describe", {
        method: "POST",
        body: JSON.stringify({ selector: note.key }),
      })

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(second.json).toMatchObject({ key: note.key, enqueued: true, queue: { pending: 1 } })
      const queue = createAiQueueRepository(root).read()
      expect(queue.jobs).toHaveLength(1)
      expect(queue.jobs[0]).toMatchObject({ kind: "describe-note", key: note.key, status: "pending", attempts: 0 })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  test("process queue route redacts provider errors in response and queue view", async () => {
    const root = await setupRoot()
    createAiConfigRepository(root).write({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://example.invalid/v1",
      apiKey: "secret-token-value",
      model: "gpt-test",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Route redaction note",
      body: "Provider failures should be safe through HTTP routes.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    const fakeClient: AiTextGenerationClient = {
      async createChatCompletion() {
        throw new Error("provider leaked secret-token-value and Bearer abc.def.ghi")
      },
    }
    setAiClientFactoryForTests(() => fakeClient)
    const { server, baseUrl } = await startServer()

    try {
      const enqueued = await requestJson(baseUrl, "/api/ai/queue/describe", {
        method: "POST",
        body: JSON.stringify({ selector: note.key }),
      })
      expect(enqueued.status).toBe(200)

      const processed = await requestJson(baseUrl, "/api/ai/process-queue", {
        method: "POST",
        body: JSON.stringify({ limit: 1 }),
      })
      const queue = await requestJson(baseUrl, "/api/ai/queue")
      const serialized = JSON.stringify({ processed: processed.json, queue: queue.json })

      expect(processed.status).toBe(200)
      expect(processed.json).toMatchObject({ applied: 0, failed: 1, remaining: 0, setupBlocked: false })
      expect(queue.status).toBe(200)
      expect(queue.json.jobs[0]).toMatchObject({ key: note.key, status: "failed", attempts: 1 })
      expect(serialized).not.toContain("secret-token-value")
      expect(serialized).not.toContain("Bearer abc.def.ghi")
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
