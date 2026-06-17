import {
  CodexProviderSetupRequiredError,
  createAiConfigRepository,
  createAiQueueRepository,
  createBlueNoteCore,
  createAiTextGenerationClient,
  createCodexAuthClient,
  createCodexAuthRepository,
  dropDescribeNoteJobIfNoteMissing,
  enqueueDescribeNoteJob,
  ensureDescribeNotePrompt,
  generateNoteDescription,
  listPendingAiJobs,
  listRetryableAiJobs,
  markDescribeNoteJobFailedIfContentHashMatches,
  maskApiKey,
  sanitizeAiErrorMessage,
  UsageError,
  type AiConfig,
  type AiTextGenerationClient,
  type AiQueueJob,
  type CodexAuth,
  type CodexAuthClient,
  type CodexDeviceFlow,
  type CodexAuthStatus,
  systemClock,
} from "@lordierclaw/bluenote-core"

import type {
  AiConfigView,
  AiDescribeRequest,
  AiEnqueueDescribeResult,
  AiProcessQueueRequest,
  AiProcessQueueResult,
  AiQueueView,
  AiStatusSummary,
  CodexAuthPollView,
  CodexAuthStartView,
  CodexAuthStatusView,
} from "../../shared/types.js"
import { getSelectedRootPath } from "./workspace-service.js"
import { HttpError } from "./http.js"

function getRootPath(): string | null {
  return getSelectedRootPath() ?? null
}

function requireRootPath(): string {
  const rootPath = getRootPath()
  if (!rootPath) {
    throw new Error("Open a workspace before using AI features.")
  }
  return rootPath
}

function readConfig(rootPath: string): AiConfig | null {
  const repository = createAiConfigRepository(rootPath)
  return repository.exists() ? repository.read() : null
}

function toConfigView(config: AiConfig | null): AiConfigView {
  if (!config) {
    return { configured: false }
  }

  return {
    configured: true,
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    baseUrl: config.provider === "openai-compatible" ? config.baseUrl : undefined,
    apiKeyMasked: config.provider === "openai-compatible" ? maskApiKey(config.apiKey) : undefined,
    logging: config.logging,
    maxAttempts: config.maxAttempts,
    outputLanguage: config.outputLanguage,
  }
}

function getCodexAuthHelpers(rootPath: string) {
  const repository = createCodexAuthRepository(rootPath)
  const client = getCodexAuthClient(rootPath, repository)
  return { repository, client }
}

type CodexAuthClientFactory = (rootPath: string, repository: ReturnType<typeof createCodexAuthRepository>) => CodexAuthClient

let codexAuthClientFactoryOverride: CodexAuthClientFactory | null = null

export function setCodexAuthClientFactoryForTests(factory: CodexAuthClientFactory | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Codex auth client factory override is only available in tests.")
  }
  codexAuthClientFactoryOverride = factory
}

function getCodexAuthClient(rootPath: string, repository: ReturnType<typeof createCodexAuthRepository>): CodexAuthClient {
  return codexAuthClientFactoryOverride?.(rootPath, repository) ?? createCodexAuthClient({ repository })
}

function getAiSecrets(config: AiConfig): string[] {
  return config.provider === "openai-compatible" ? [config.apiKey] : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getInputApiKey(input: unknown): string | undefined {
  if (!isRecord(input) || typeof input.apiKey !== "string") {
    return undefined
  }
  return input.apiKey
}

function readExistingConfigForSave(repository: ReturnType<typeof createAiConfigRepository>): {
  config: AiConfig | null
  error: unknown
} {
  if (!repository.exists()) {
    return { config: null, error: null }
  }

  try {
    return { config: repository.read(), error: null }
  } catch (error) {
    return { config: null, error }
  }
}

function normalizeAiConfigInput(input: unknown, existing: AiConfig | null, existingReadError: unknown): AiConfig {
  if (!isRecord(input)) {
    return input as unknown as AiConfig
  }

  if (input.provider === "codex") {
    const codexConfig = { ...input }
    delete codexConfig.apiKey
    delete codexConfig.baseUrl
    return {
      ...codexConfig,
      provider: "codex",
    } as unknown as AiConfig
  }

  if (input.provider === "openai-compatible") {
    const inputApiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : ""
    const apiKey = inputApiKey.length > 0
      ? input.apiKey
      : existing?.provider === "openai-compatible"
        ? existing.apiKey
        : undefined

    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      if (existingReadError) {
        throw new HttpError(
          400,
          "invalid_ai_config",
          "OpenAI-compatible API key is required because the existing API key could not be preserved.",
        )
      }

      throw new HttpError(
        400,
        "invalid_ai_config",
        "OpenAI-compatible API key is required when no existing API key is configured.",
      )
    }

    return {
      ...input,
      provider: "openai-compatible",
      apiKey,
    } as unknown as AiConfig
  }

  return input as unknown as AiConfig
}

function toInvalidAiConfigError(error: unknown, secrets: string[]): HttpError {
  if (error instanceof HttpError) {
    return error
  }

  if (error instanceof UsageError && !error.message.startsWith("Invalid AI config")) {
    throw error
  }

  const message = sanitizeAiErrorMessage(error, secrets)
  return new HttpError(
    400,
    "invalid_ai_config",
    message || "Invalid AI config.",
  )
}

type AiClientFactory = (rootPath: string, config: AiConfig) => AiTextGenerationClient

let aiClientFactoryOverride: AiClientFactory | null = null

type PendingCodexDeviceFlow = {
  id: string
  rootPath: string
  flow: CodexDeviceFlow
  startedAt: number
}

const pendingCodexDeviceFlows = new Map<string, PendingCodexDeviceFlow>()
const CODEX_PENDING_FLOW_TTL_MS = 15 * 60 * 1000

function createPendingCodexFlowId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function pruneExpiredCodexDeviceFlows(now = Date.now()): void {
  for (const [rootPath, pending] of pendingCodexDeviceFlows) {
    if (now - pending.startedAt > CODEX_PENDING_FLOW_TTL_MS) {
      pendingCodexDeviceFlows.delete(rootPath)
    }
  }
}

function isSamePendingCodexFlow(rootPath: string, pending: PendingCodexDeviceFlow): boolean {
  return pendingCodexDeviceFlows.get(rootPath)?.id === pending.id
}

export function setAiClientFactoryForTests(factory: AiClientFactory | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("AI client factory override is only available in tests.")
  }
  aiClientFactoryOverride = factory
}

function createDefaultAiClient(rootPath: string, config: AiConfig): AiTextGenerationClient {
  if (config.provider !== "codex") {
    return createAiTextGenerationClient(config)
  }

  const { repository, client } = getCodexAuthHelpers(rootPath)
  return createAiTextGenerationClient(config, {
    codexAuth: {
      hasAuth: () => repository.exists(),
      getAuth: async () => (repository.exists() ? repository.read() : null),
      refreshAuth: async (auth: CodexAuth) => {
        const refreshed = await client.refreshAuth(auth)
        repository.write(refreshed)
        return refreshed
      },
    },
  })
}

function getAiClient(rootPath: string, config: AiConfig): AiTextGenerationClient {
  return aiClientFactoryOverride?.(rootPath, config) ?? createDefaultAiClient(rootPath, config)
}

type AiQueueSummary = NonNullable<AiStatusSummary["queue"]>

function toQueueSummary(rootPath: string): AiQueueSummary {
  const jobs = createAiQueueRepository(rootPath).read().jobs
  return {
    pending: jobs.filter((job) => job.status === "pending").length,
    running: jobs.filter((job) => job.status === "running").length,
    failed: jobs.filter((job) => job.status === "failed").length,
  }
}

function toCodexAuthStatusView(status: CodexAuthStatus): CodexAuthStatusView {
  switch (status.state) {
    case "authenticated":
      return { state: status.state, expiresAt: status.expiresAt, issuer: status.issuer }
    case "expired":
      return { state: status.state, hint: status.hint }
    case "invalid":
      return { state: status.state, message: status.message, hint: status.hint }
    default:
      return { state: status.state }
  }
}

function markJobFailed(rootPath: string, job: AiQueueJob, error: unknown, secrets: string[] = []): boolean {
  const message = sanitizeAiErrorMessage(error, secrets)
  return markDescribeNoteJobFailedIfContentHashMatches({
    rootPath,
    key: job.key,
    contentHash: job.contentHash,
    lastError: message,
  })
}

function isCodexProviderSetupBlocked(error: unknown): boolean {
  if (error instanceof CodexProviderSetupRequiredError) {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes("codex auth setup is required")
    || message.includes("codex auth refresh failed")
    || message.includes("codex auth is expired")
    || message.includes("run bn ai codex auth login")
}

export function getAiStatus(): AiStatusSummary {
  const rootPath = getRootPath()
  if (!rootPath) {
    return { status: "workspace-not-open", message: "Open a workspace to inspect AI status." }
  }

  try {
    const config = readConfig(rootPath)
    if (!config) {
      return { status: "not-configured", message: "AI is not configured for this workspace." }
    }

    const queue = toQueueSummary(rootPath)
    if (config.provider === "codex") {
      const auth = createCodexAuthRepository(rootPath).getStatus({ provider: "codex" })
      if (auth.state !== "authenticated") {
        return {
          status: "auth-required",
          provider: config.provider,
          model: config.model,
          queue,
          message: auth.state === "invalid"
            ? auth.message
            : auth.state === "expired"
              ? auth.hint
              : undefined,
        }
      }
    }
    return {
      status: queue.running > 0 ? "running" : "connected",
      provider: config.provider,
      model: config.model,
      queue,
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not read AI status.",
    }
  }
}

export function getAiConfigView(): AiConfigView {
  return toConfigView(readConfig(requireRootPath()))
}

export function saveAiConfig(input: unknown): AiConfigView {
  const rootPath = requireRootPath()
  const repository = createAiConfigRepository(rootPath)
  const { config: existing, error: existingReadError } = readExistingConfigForSave(repository)
  const secrets = [
    ...(existing ? getAiSecrets(existing) : []),
    getInputApiKey(input),
  ].filter((value): value is string => typeof value === "string" && value.length > 0)

  try {
    const config = normalizeAiConfigInput(input, existing, existingReadError)
    repository.write(config)
    return toConfigView(repository.read())
  } catch (error) {
    throw toInvalidAiConfigError(error, secrets)
  }
}

export function getAiQueueView(): AiQueueView {
  const rootPath = requireRootPath()
  const config = readConfig(rootPath)
  const secrets = config ? getAiSecrets(config) : []
  return {
    jobs: createAiQueueRepository(rootPath).read().jobs.map((job) => ({
      kind: job.kind,
      key: job.key,
      relativePath: job.relativePath,
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError ? sanitizeAiErrorMessage(job.lastError, secrets) : job.lastError,
      updatedAt: job.updatedAt,
    })),
  }
}

export function getCodexAuthStatusView(): CodexAuthStatusView {
  const rootPath = requireRootPath()
  const config = readConfig(rootPath)
  const selection = { provider: config?.provider ?? "openai-compatible" }
  return toCodexAuthStatusView(createCodexAuthRepository(rootPath).getStatus(selection))
}

export async function startCodexAuth(): Promise<CodexAuthStartView> {
  pruneExpiredCodexDeviceFlows()
  const rootPath = requireRootPath()
  const { client } = getCodexAuthHelpers(rootPath)
  const flow = await client.startDeviceFlow()
  pendingCodexDeviceFlows.set(rootPath, { id: createPendingCodexFlowId(), rootPath, flow, startedAt: Date.now() })
  return {
    verificationUrl: flow.verificationUrl,
    userCode: flow.userCode,
    intervalSeconds: flow.intervalSeconds,
    state: "pending",
  }
}

function getCodexPollErrorState(error: unknown, secrets: string[] = []): CodexAuthPollView {
  const message = sanitizeAiErrorMessage(error, secrets)
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code)
    if (code === "expired") {
      return { state: "expired", message: message || "Codex device auth expired." }
    }
    if (code === "aborted" || code === "ABORT_ERR") {
      return { state: "pending" }
    }
    if (code === "denied" || code === "cancelled") {
      return { state: "cancelled", message: message || "Codex device auth was cancelled." }
    }
  }

  if (error instanceof Error && error.name === "AbortError") {
    return { state: "pending" }
  }

  return { state: "invalid", message: message || "Codex device auth failed." }
}

export async function pollCodexAuth(): Promise<CodexAuthPollView> {
  pruneExpiredCodexDeviceFlows()
  const rootPath = requireRootPath()
  const pending = pendingCodexDeviceFlows.get(rootPath)
  if (!pending) {
    return { state: "expired", message: "No pending Codex auth flow. Start Codex auth again." }
  }

  const { repository, client } = getCodexAuthHelpers(rootPath)
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1000, Math.min((pending.flow.intervalSeconds || 5) * 1000, 5000)),
  )
  try {
    const auth = await client.completeDeviceFlow(pending.flow, { signal: controller.signal })
    if (!isSamePendingCodexFlow(rootPath, pending)) {
      return { state: "expired", message: "Codex auth flow is no longer active. Start Codex auth again." }
    }
    repository.write(auth)
    pendingCodexDeviceFlows.delete(rootPath)
    return {
      state: "authenticated",
      auth: toCodexAuthStatusView(repository.getStatus({ provider: "codex" })),
    }
  } catch (error) {
    const result = getCodexPollErrorState(error, [pending.flow.deviceAuthId, pending.flow.userCode])
    if (result.state !== "pending" && isSamePendingCodexFlow(rootPath, pending)) {
      pendingCodexDeviceFlows.delete(rootPath)
    }
    return result
  } finally {
    clearTimeout(timeout)
  }
}

export function deleteCodexAuth(): { ok: true } {
  const rootPath = requireRootPath()
  pendingCodexDeviceFlows.delete(rootPath)
  createCodexAuthRepository(rootPath).delete()
  return { ok: true }
}

export async function enqueueNoteDescription(request: AiDescribeRequest): Promise<AiEnqueueDescribeResult> {
  const selector = typeof request.selector === "string" ? request.selector.trim() : ""
  if (!selector) {
    throw new Error("Missing required selector for AI describe.")
  }

  const rootPath = requireRootPath()
  const config = readConfig(rootPath)
  if (!config) {
    throw new Error("AI is not configured for this workspace.")
  }

  const note = createBlueNoteCore({ rootPath }).notes.get(selector, { visibility: "all" })
  if (!config.enabled) {
    return {
      key: note.key,
      relativePath: note.relativePath,
      enqueued: false,
      queue: toQueueSummary(rootPath),
    }
  }

  const prompt = ensureDescribeNotePrompt(rootPath)
  enqueueDescribeNoteJob(rootPath, {
    key: note.key,
    relativePath: note.relativePath,
    title: note.title,
    body: note.body,
    currentDescription: note.description,
    promptHash: prompt.hash,
  }, {
    clock: systemClock,
  })

  return {
    key: note.key,
    relativePath: note.relativePath,
    enqueued: true,
    queue: toQueueSummary(rootPath),
  }
}

export async function describeNoteWithAi(request: AiDescribeRequest): Promise<AiEnqueueDescribeResult> {
  return enqueueNoteDescription(request)
}

export async function processAiQueue(request: AiProcessQueueRequest): Promise<AiProcessQueueResult> {
  const rootPath = requireRootPath()
  const config = readConfig(rootPath)
  if (!config) {
    throw new Error("AI is not configured for this workspace.")
  }

  const jobs = listRetryableAiJobs(rootPath, config.maxAttempts ?? 3)
  if (!config.enabled) {
    return {
      applied: 0,
      failed: 0,
      remaining: listPendingAiJobs(rootPath).length,
      setupBlocked: false,
    }
  }

  const limit = Number.isInteger(request.limit) && (request.limit as number) > 0 ? (request.limit as number) : jobs.length
  const selectedJobs = jobs.slice(0, limit)
  const secrets = getAiSecrets(config)
  let applied = 0
  let failed = 0
  let setupBlocked = false
  let client: AiTextGenerationClient | null = null

  for (const job of selectedJobs) {
    try {
      if (dropDescribeNoteJobIfNoteMissing(rootPath, job)) {
        continue
      }

      client ??= getAiClient(rootPath, config)
      const result = await generateNoteDescription({
        rootPath,
        selector: job.key,
        client,
      })

      if (result.status === "applied") {
        applied += 1
      } else if (result.status === "stale") {
        // Leave refreshed queue jobs pending; this provider response was for older content.
      } else {
        if (markJobFailed(rootPath, job, result.error ?? "invalid description", secrets)) {
          failed += 1
        }
      }
    } catch (error) {
      if (config.provider === "codex" && isCodexProviderSetupBlocked(error)) {
        setupBlocked = true
        continue
      }

      if (markJobFailed(rootPath, job, error, secrets)) {
        failed += 1
      }
    }
  }

  if (applied > 0) {
    createBlueNoteCore({ rootPath }).rebuild()
  }

  return {
    applied,
    failed,
    remaining: listPendingAiJobs(rootPath).length,
    setupBlocked,
  }
}
