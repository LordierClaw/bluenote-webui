import os from "node:os"
import path from "node:path"
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"
import {
  CodexProviderSetupRequiredError,
  createCodexAuthRepository,
  createAiConfigRepository,
  createAiQueueRepository,
  createBlueNoteCore,
  createSidecarRepository,
  type CodexAuth,
  type CodexAuthClient,
  type AiTextGenerationClient,
} from "@lordierclaw/bluenote-core"
import {
  deleteCodexAuth,
  enqueueNoteDescription,
  getAiConfigView,
  getAiQueueView,
  getAiStatus,
  getCodexAuthStatusView,
  pollCodexAuth,
  processAiQueue,
  saveAiConfig,
  setAiClientFactoryForTests,
  setCodexAuthClientFactoryForTests,
  startCodexAuth,
} from "../src/server/services/ai-service.js"
import { initWorkspace, resetWorkspaceForTests } from "../src/server/services/workspace-service.js"

const roots: string[] = []

async function setupRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-ai-"))
  roots.push(root)
  initWorkspace(root)
  return root
}

afterEach(async () => {
  setAiClientFactoryForTests(null)
  setCodexAuthClientFactoryForTests(null)
  resetWorkspaceForTests()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function writeCodexConfig(root: string) {
  createAiConfigRepository(root).write({
    version: 1,
    enabled: true,
    provider: "codex",
    model: "gpt-5-codex",
    logging: { usage: true, conversations: false, results: true },
    maxAttempts: 3,
    outputLanguage: "English",
  })
}

function makeCodexAuth(overrides: Partial<CodexAuth> = {}): CodexAuth {
  return {
    version: 1 as const,
    provider: "codex" as const,
    authType: "device-code-oauth" as const,
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function writeEnabledConfig(root: string) {
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
}

describe("AI status service", () => {
  test("reports not configured for fresh roots", async () => {
    await setupRoot()
    expect(getAiStatus()).toMatchObject({ status: "not-configured" })
  })

  test("does not expose codex auth or token-looking fixture values", async () => {
    const root = await setupRoot()
    await mkdir(path.join(root, ".data", "ai"), { recursive: true })
    await writeFile(path.join(root, ".data", "ai", "codex-auth.json"), JSON.stringify({ accessToken: "secret-token-value" }), "utf8")
    const json = JSON.stringify(getAiStatus())
    expect(json).not.toContain("secret-token-value")
    expect(json).not.toContain("codex-auth")
  })
})

describe("AI config service", () => {
  test("fresh OpenAI-compatible config requires a non-empty API key", async () => {
    await setupRoot()

    expect(() => saveAiConfig({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://example.invalid/v1",
      apiKey: "",
      model: "gpt-test",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })).toThrow(/api key/i)
  })

  test("saveAiConfig preserves an existing OpenAI-compatible API key when omitted or blank", async () => {
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

    const savedWithBlank = saveAiConfig({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://new.example/v1",
      apiKey: "",
      model: "new-model",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 5,
      outputLanguage: "日本語",
    })

    expect(JSON.stringify(savedWithBlank)).not.toContain("secret-token-value")
    expect(savedWithBlank).toMatchObject({ configured: true, provider: "openai-compatible", model: "new-model" })
    expect(createAiConfigRepository(root).read()).toMatchObject({
      provider: "openai-compatible",
      baseUrl: "https://new.example/v1",
      apiKey: "secret-token-value",
      model: "new-model",
      maxAttempts: 5,
      outputLanguage: "日本語",
    })

    const savedWithMissing = saveAiConfig({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://newer.example/v1",
      model: "newer-model",
      logging: { usage: false, conversations: false, results: false },
      maxAttempts: 2,
      outputLanguage: "English",
    })

    expect(JSON.stringify(savedWithMissing)).not.toContain("secret-token-value")
    expect(createAiConfigRepository(root).read()).toMatchObject({
      provider: "openai-compatible",
      baseUrl: "https://newer.example/v1",
      apiKey: "secret-token-value",
      model: "newer-model",
      maxAttempts: 2,
      outputLanguage: "English",
    })
  })

  test("switching to Codex writes no OpenAI-compatible secret fields", async () => {
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

    const saved = saveAiConfig({
      version: 1,
      enabled: true,
      provider: "codex",
      baseUrl: "https://example.invalid/v1",
      apiKey: "secret-token-value",
      model: "gpt-5-codex",
      logging: { usage: true, conversations: true, results: false },
      maxAttempts: 4,
      outputLanguage: "English",
    })

    expect(JSON.stringify(saved)).not.toContain("secret-token-value")
    expect(saved).toMatchObject({ configured: true, provider: "codex", baseUrl: undefined, apiKeyMasked: undefined })
    const persisted = createAiConfigRepository(root).read()
    expect(persisted).toMatchObject({ provider: "codex", model: "gpt-5-codex" })
    expect("apiKey" in persisted).toBe(false)
    expect("baseUrl" in persisted).toBe(false)
    expect(JSON.stringify(getAiConfigView())).not.toContain("secret-token-value")
  })

  test("can overwrite malformed existing config when a fresh OpenAI-compatible API key is provided", async () => {
    const root = await setupRoot()
    await mkdir(path.join(root, ".data", "ai"), { recursive: true })
    await writeFile(path.join(root, ".data", "ai", "config.json"), "{ not valid json", "utf8")

    const saved = saveAiConfig({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://example.invalid/v1",
      apiKey: "fresh-secret-token",
      model: "gpt-test",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })

    expect(JSON.stringify(saved)).not.toContain("fresh-secret-token")
    expect(createAiConfigRepository(root).read()).toMatchObject({
      provider: "openai-compatible",
      apiKey: "fresh-secret-token",
      model: "gpt-test",
    })
  })

  test("blank API key with malformed existing config returns a safe preservation error", async () => {
    const root = await setupRoot()
    await mkdir(path.join(root, ".data", "ai"), { recursive: true })
    await writeFile(path.join(root, ".data", "ai", "config.json"), "{ not valid json", "utf8")

    expect(() => saveAiConfig({
      version: 1,
      enabled: true,
      provider: "openai-compatible",
      baseUrl: "https://example.invalid/v1",
      apiKey: "",
      model: "gpt-test",
      logging: { usage: true, conversations: false, results: true },
      maxAttempts: 3,
      outputLanguage: "English",
    })).toThrow(/existing API key could not be preserved/i)
  })
})

describe("Codex auth service", () => {
  test("startCodexAuth stores a server-side pending flow and returns no token-looking values", async () => {
    await setupRoot()
    const fakeClient: Partial<CodexAuthClient> = {
      async startDeviceFlow() {
        return {
          deviceAuthId: "server-only-device-secret",
          userCode: "ABCD-EFGH",
          verificationUrl: "https://auth.example.invalid/codex/device",
          intervalSeconds: 1,
        }
      },
    }
    setCodexAuthClientFactoryForTests(() => fakeClient as CodexAuthClient)

    const started = await startCodexAuth()

    expect(started).toEqual({
      verificationUrl: "https://auth.example.invalid/codex/device",
      userCode: "ABCD-EFGH",
      intervalSeconds: 1,
      state: "pending",
    })
    const serialized = JSON.stringify(started)
    expect(serialized).not.toContain("server-only-device-secret")
    expect(serialized).not.toContain("accessToken")
    expect(serialized).not.toContain("refreshToken")
    expect(serialized).not.toContain("idToken")
  })

  test("pollCodexAuth completes a pending device flow, persists auth server-side, and returns no tokens", async () => {
    const root = await setupRoot()
    const auth = makeCodexAuth()
    const fakeClient: Partial<CodexAuthClient> = {
      async startDeviceFlow() {
        return { deviceAuthId: "server-only-device-secret", userCode: "WXYZ-1234", verificationUrl: "https://auth.example.invalid/codex/device", intervalSeconds: 1 }
      },
      async completeDeviceFlow(flow) {
        expect(flow.deviceAuthId).toBe("server-only-device-secret")
        return auth
      },
    }
    setCodexAuthClientFactoryForTests(() => fakeClient as CodexAuthClient)

    await startCodexAuth()
    const result = await pollCodexAuth()

    expect(result).toMatchObject({ state: "authenticated", auth: { state: "authenticated", issuer: "https://auth.example.invalid" } })
    expect(createCodexAuthRepository(root).read()).toMatchObject({ accessToken: "secret-access-token-value", refreshToken: "secret-refresh-token-value" })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain("secret-access-token-value")
    expect(serialized).not.toContain("secret-refresh-token-value")
    expect(serialized).not.toContain("secret-id-token-value")
    expect(serialized).not.toContain("server-only-device-secret")
  })

  test("pollCodexAuth treats standard AbortError as pending and keeps the flow active", async () => {
    await setupRoot()
    let completeAttempts = 0
    const auth = makeCodexAuth()
    const fakeClient: Partial<CodexAuthClient> = {
      async startDeviceFlow() {
        return { deviceAuthId: "server-only-device-secret", userCode: "PEND-1234", verificationUrl: "https://auth.example.invalid/codex/device", intervalSeconds: 1 }
      },
      async completeDeviceFlow() {
        completeAttempts += 1
        if (completeAttempts === 1) {
          const error = new Error("The operation was aborted")
          error.name = "AbortError"
          throw error
        }
        return auth
      },
    }
    setCodexAuthClientFactoryForTests(() => fakeClient as CodexAuthClient)

    await startCodexAuth()
    expect(await pollCodexAuth()).toEqual({ state: "pending" })
    const completed = await pollCodexAuth()

    expect(completed).toMatchObject({ state: "authenticated", auth: { state: "authenticated" } })
  })

  test("deleteCodexAuth prevents an in-flight poll from writing auth after logout", async () => {
    const root = await setupRoot()
    const completion = deferred<CodexAuth>()
    const fakeClient: Partial<CodexAuthClient> = {
      async startDeviceFlow() {
        return { deviceAuthId: "server-only-device-secret", userCode: "LOGO-UT01", verificationUrl: "https://auth.example.invalid/codex/device", intervalSeconds: 1 }
      },
      async completeDeviceFlow() {
        return completion.promise
      },
    }
    setCodexAuthClientFactoryForTests(() => fakeClient as CodexAuthClient)

    await startCodexAuth()
    const pendingPoll = pollCodexAuth()
    deleteCodexAuth()
    completion.resolve(makeCodexAuth())
    const result = await pendingPoll

    expect(result.state).not.toBe("authenticated")
    expect(createCodexAuthRepository(root).exists()).toBe(false)
  })

  test("starting a newer Codex auth flow prevents an older in-flight poll from replacing it", async () => {
    const root = await setupRoot()
    const oldCompletion = deferred<CodexAuth>()
    let startCount = 0
    const fakeClient: Partial<CodexAuthClient> = {
      async startDeviceFlow() {
        startCount += 1
        return {
          deviceAuthId: startCount === 1 ? "old-device-secret" : "new-device-secret",
          userCode: startCount === 1 ? "OLD-FLOW" : "NEW-FLOW",
          verificationUrl: "https://auth.example.invalid/codex/device",
          intervalSeconds: 1,
        }
      },
      async completeDeviceFlow(flow) {
        if (flow.deviceAuthId === "old-device-secret") {
          return oldCompletion.promise
        }
        return makeCodexAuth({ accessToken: "new-access-token", refreshToken: "new-refresh-token", idToken: "new-id-token" })
      },
    }
    setCodexAuthClientFactoryForTests(() => fakeClient as CodexAuthClient)

    await startCodexAuth()
    const oldPoll = pollCodexAuth()
    await startCodexAuth()
    oldCompletion.resolve(makeCodexAuth({ accessToken: "old-access-token", refreshToken: "old-refresh-token", idToken: "old-id-token" }))
    const oldResult = await oldPoll
    const newResult = await pollCodexAuth()

    expect(oldResult.state).not.toBe("authenticated")
    expect(newResult).toMatchObject({ state: "authenticated" })
    expect(createCodexAuthRepository(root).read()).toMatchObject({ accessToken: "new-access-token", refreshToken: "new-refresh-token" })
  })

  test("getCodexAuthStatusView reports setup-required, authenticated, expired, and invalid without tokens", async () => {
    const root = await setupRoot()
    writeCodexConfig(root)

    expect(getCodexAuthStatusView()).toMatchObject({ state: "setup-required" })

    createCodexAuthRepository(root).write(makeCodexAuth())
    expect(getCodexAuthStatusView()).toMatchObject({ state: "authenticated", issuer: "https://auth.example.invalid" })

    createCodexAuthRepository(root).write(makeCodexAuth({ expiresAt: new Date(Date.now() - 60 * 1000).toISOString() }))
    expect(getCodexAuthStatusView()).toMatchObject({ state: "expired", hint: expect.any(String) })

    await writeFile(path.join(root, ".data", "ai", "codex-auth.json"), JSON.stringify({ accessToken: "secret-access-token-value" }), "utf8")
    const invalid = getCodexAuthStatusView()
    expect(invalid).toMatchObject({ state: "invalid", message: expect.any(String), hint: expect.any(String) })
    expect(JSON.stringify(invalid)).not.toContain("secret-access-token-value")
  })

  test("deleteCodexAuth removes auth without changing AI config", async () => {
    const root = await setupRoot()
    writeCodexConfig(root)
    createCodexAuthRepository(root).write(makeCodexAuth())

    expect(deleteCodexAuth()).toEqual({ ok: true })

    expect(createCodexAuthRepository(root).exists()).toBe(false)
    expect(createAiConfigRepository(root).read()).toMatchObject({ provider: "codex", model: "gpt-5-codex" })
  })
})

describe("AI queue-first description service", () => {
  test("enqueueNoteDescription enqueues one describe-note job without creating a provider client", async () => {
    const root = await setupRoot()
    writeEnabledConfig(root)
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Queue first note",
      body: "The body is available for AI description later.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    let providerCalls = 0
    setAiClientFactoryForTests(() => {
      providerCalls += 1
      throw new Error("provider should not be created while enqueueing")
    })

    const result = await enqueueNoteDescription({ selector: note.key })

    expect(result).toMatchObject({ key: note.key, relativePath: note.relativePath, enqueued: true })
    expect(result.queue).toMatchObject({ pending: 1, running: 0, failed: 0 })
    expect(providerCalls).toBe(0)
    const queue = createAiQueueRepository(root).read()
    expect(queue.jobs).toHaveLength(1)
    expect(queue.jobs[0]).toMatchObject({ kind: "describe-note", key: note.key, relativePath: note.relativePath, status: "pending", attempts: 0 })
  })

  test("repeated enqueue refreshes the existing describe-note job rather than duplicating it", async () => {
    const root = await setupRoot()
    writeEnabledConfig(root)
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Refresh one job",
      body: "Refresh the durable queued job instead of duplicating.",
      destinationFolder: "note",
      enqueueAi: false,
    })

    await enqueueNoteDescription({ selector: note.key })
    await enqueueNoteDescription({ selector: note.key })

    const queue = createAiQueueRepository(root).read()
    expect(queue.jobs).toHaveLength(1)
    expect(queue.jobs[0]).toMatchObject({ kind: "describe-note", key: note.key, status: "pending", attempts: 0 })
  })

  test("explicit enqueue surfaces prompt initialization failures instead of returning false", async () => {
    const root = await setupRoot()
    writeEnabledConfig(root)
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Broken prompt path",
      body: "The explicit route should fail loudly when queue setup fails.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    await mkdir(path.join(root, ".data", "ai"), { recursive: true })
    await rm(path.join(root, ".data", "ai", "prompts"), { recursive: true, force: true })
    await writeFile(path.join(root, ".data", "ai", "prompts"), "not a directory", "utf8")

    await expect(enqueueNoteDescription({ selector: note.key })).rejects.toThrow(/could not read AI prompt/i)
    expect(createAiQueueRepository(root).read().jobs).toHaveLength(0)
  })

  test("deleted-note queued jobs are dropped without creating or calling a provider", async () => {
    const root = await setupRoot()
    writeEnabledConfig(root)
    const core = createBlueNoteCore({ rootPath: root })
    const note = core.notes.create({
      type: "normal",
      title: "Deleted queued note",
      body: "This job should disappear when the note disappears.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    await enqueueNoteDescription({ selector: note.key })
    core.notes.delete(note.key, { force: true, visibility: "all" })
    let providerCreations = 0
    setAiClientFactoryForTests(() => {
      providerCreations += 1
      throw new Error("provider should not be created for a deleted note")
    })

    const processed = await processAiQueue({ limit: 1 })

    expect(processed).toMatchObject({ applied: 0, failed: 0, remaining: 0, setupBlocked: false })
    expect(providerCreations).toBe(0)
    expect(createAiQueueRepository(root).read().jobs).toHaveLength(0)
  })

  test("Codex setup/auth blockers preserve queued work and do not increment attempts", async () => {
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
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Codex setup blocked",
      body: "Auth setup should not consume this queued job.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    await enqueueNoteDescription({ selector: note.key })
    setAiClientFactoryForTests(() => {
      throw new CodexProviderSetupRequiredError()
    })

    const processed = await processAiQueue({ limit: 1 })

    expect(processed).toMatchObject({ applied: 0, failed: 0, remaining: 1, setupBlocked: true })
    const [job] = createAiQueueRepository(root).read().jobs
    expect(job).toMatchObject({ key: note.key, status: "pending", attempts: 0, lastError: null })
  })

  test("queue view redacts pre-existing durable job errors before returning them", async () => {
    const root = await setupRoot()
    writeEnabledConfig(root)
    const now = new Date().toISOString()
    createAiQueueRepository(root).write({
      version: 1,
      jobs: [{
        kind: "describe-note",
        key: "leaky-note",
        relativePath: "note/leaky.md",
        contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        promptHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        status: "failed",
        attempts: 1,
        lastError: "upstream leaked secret-token-value in a durable queue error",
        createdAt: now,
        updatedAt: now,
        nextAttemptAt: null,
      }],
    })

    const view = getAiQueueView()
    const serialized = JSON.stringify(view)

    expect(view.jobs[0]).toMatchObject({ key: "leaky-note", status: "failed", attempts: 1, lastError: expect.any(String) })
    expect(serialized).not.toContain("secret-token-value")
  })

  test("provider errors are redacted before being returned or stored on failed jobs", async () => {
    const root = await setupRoot()
    writeEnabledConfig(root)
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Redacted provider failure",
      body: "The stored error must not leak configured or bearer secrets.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    await enqueueNoteDescription({ selector: note.key })
    const fakeClient: AiTextGenerationClient = {
      async createChatCompletion() {
        throw new Error("upstream rejected secret-token-value and jwt eyJhbG...ture")
      },
    }
    setAiClientFactoryForTests(() => fakeClient)

    const processed = await processAiQueue({ limit: 1 })
    const queueAfter = createAiQueueRepository(root).read()
    const serialized = JSON.stringify({ processed, queueAfter })

    expect(processed).toMatchObject({ applied: 0, failed: 1, remaining: 0, setupBlocked: false })
    expect(queueAfter.jobs[0]).toMatchObject({ key: note.key, status: "failed", attempts: 1 })
    expect(serialized).not.toContain("secret-token-value")
    expect(serialized).not.toContain("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature")
  })

  test("invalid provider output marks the matching queued job failed", async () => {
    const root = await setupRoot()
    writeEnabledConfig(root)
    const note = createBlueNoteCore({ rootPath: root }).notes.create({
      type: "normal",
      title: "Invalid provider output",
      body: "Blank provider output should fail the matching job.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    await enqueueNoteDescription({ selector: note.key })
    const fakeClient: AiTextGenerationClient = {
      async createChatCompletion() {
        return { text: "   " }
      },
    }
    setAiClientFactoryForTests(() => fakeClient)

    const processed = await processAiQueue({ limit: 1 })

    expect(processed).toMatchObject({ applied: 0, failed: 1, remaining: 0, setupBlocked: false })
    const [job] = createAiQueueRepository(root).read().jobs
    expect(job).toMatchObject({ key: note.key, status: "failed", attempts: 1, lastError: expect.any(String) })
  })

  test("successful provider output updates sidecar description, leaves Markdown unchanged, removes the job, and refreshes list/search", async () => {
    const root = await setupRoot()
    writeEnabledConfig(root)
    const core = createBlueNoteCore({ rootPath: root })
    const note = core.notes.create({
      type: "normal",
      title: "Queued processor",
      body: "The processor should be the only path that asks a provider.",
      destinationFolder: "note",
      enqueueAi: false,
    })
    const markdownBefore = await readFile(note.notePath, "utf8")
    let providerCalls = 0
    const fakeClient: AiTextGenerationClient = {
      async createChatCompletion() {
        providerCalls += 1
        return { text: "Provider writes queued description." }
      },
    }
    setAiClientFactoryForTests(() => fakeClient)

    const enqueued = await enqueueNoteDescription({ selector: note.key })
    expect(enqueued).toMatchObject({ enqueued: true, queue: { pending: 1 } })
    expect(providerCalls).toBe(0)

    const processed = await processAiQueue({ limit: 1 })

    expect(processed).toMatchObject({ applied: 1, failed: 0, remaining: 0, setupBlocked: false })
    expect(providerCalls).toBe(1)
    expect(createSidecarRepository(root).read(note.key).description).toBe("Provider writes queued description.")
    expect(await readFile(note.notePath, "utf8")).toBe(markdownBefore)
    expect(createAiQueueRepository(root).read().jobs).toHaveLength(0)
    expect(core.notes.list({ visibility: "all" }).find((entry) => entry.key === note.key)?.description).toBe("Provider writes queued description.")
    expect(core.search.search("Provider writes queued description", { visibility: "all" }).map((match) => match.key)).toContain(note.key)
  })
})
