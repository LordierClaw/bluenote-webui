import {
  CodexProviderSetupRequiredError,
  createAiConfigRepository,
  createAiQueueRepository,
  createAiTextGenerationClient,
  createCodexAuthClient,
  createCodexAuthRepository,
  dropDescribeNoteJobIfNoteMissing,
  generateNoteDescription,
  listPendingAiJobs,
  listRetryableAiJobs,
  markDescribeNoteJobFailedIfContentHashMatches,
  maskApiKey,
  sanitizeAiErrorMessage,
  type AiConfig,
  type AiQueueJob,
  type CodexAuth,
  type CodexAuthStatus,
} from "@lordierclaw/bluenote-core"

import type {
  AiConfigView,
  AiDescribeRequest,
  AiProcessQueueRequest,
  AiProcessQueueResult,
  AiQueueView,
  AiStatusSummary,
  CodexAuthStartView,
  CodexAuthStatusView,
} from "../../shared/types.js"
import { getSelectedRootPath } from "./workspace-service.js"

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
  const client = createCodexAuthClient({ repository })
  return { repository, client }
}

function getAiSecrets(config: AiConfig): string[] {
  return config.provider === "openai-compatible" ? [config.apiKey] : []
}

function getAiClient(rootPath: string, config: AiConfig) {
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

function toQueueSummary(rootPath: string): AiStatusSummary["queue"] {
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

    const queue = toQueueSummary(rootPath) ?? { pending: 0, running: 0, failed: 0 }
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
  repository.write(input as AiConfig)
  return toConfigView(repository.read())
}

export function getAiQueueView(): AiQueueView {
  const rootPath = requireRootPath()
  return {
    jobs: createAiQueueRepository(rootPath).read().jobs.map((job) => ({
      kind: job.kind,
      key: job.key,
      relativePath: job.relativePath,
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError,
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
  const rootPath = requireRootPath()
  const { client } = getCodexAuthHelpers(rootPath)
  const flow = await client.startDeviceFlow()
  return {
    verificationUrl: flow.verificationUrl,
    userCode: flow.userCode,
    intervalSeconds: flow.intervalSeconds,
  }
}

export function deleteCodexAuth(): { ok: true } {
  const rootPath = requireRootPath()
  createCodexAuthRepository(rootPath).delete()
  return { ok: true }
}

export async function describeNoteWithAi(request: AiDescribeRequest) {
  const selector = typeof request.selector === "string" ? request.selector.trim() : ""
  if (!selector) {
    throw new Error("Missing required selector for AI describe.")
  }

  const rootPath = requireRootPath()
  const config = readConfig(rootPath)
  if (!config) {
    throw new Error("AI is not configured for this workspace.")
  }

  try {
    return await generateNoteDescription({
      rootPath,
      selector,
      client: getAiClient(rootPath, config),
    })
  } catch (error) {
    throw new Error(`AI provider request failed: ${sanitizeAiErrorMessage(error, getAiSecrets(config))}`)
  }
}

export async function processAiQueue(request: AiProcessQueueRequest): Promise<AiProcessQueueResult> {
  const rootPath = requireRootPath()
  const config = readConfig(rootPath)
  if (!config) {
    throw new Error("AI is not configured for this workspace.")
  }

  const jobs = listRetryableAiJobs(rootPath, config.maxAttempts ?? 3)
  const limit = Number.isInteger(request.limit) && (request.limit as number) > 0 ? (request.limit as number) : jobs.length
  const selectedJobs = jobs.slice(0, limit)
  const secrets = getAiSecrets(config)
  let applied = 0
  let failed = 0
  let setupBlocked = false

  for (const job of selectedJobs) {
    try {
      if (dropDescribeNoteJobIfNoteMissing(rootPath, job)) {
        continue
      }

      const result = await generateNoteDescription({
        rootPath,
        selector: job.key,
        client: getAiClient(rootPath, config),
      })

      if (result.status === "applied") {
        applied += 1
      } else if (result.status !== "stale") {
        if (markJobFailed(rootPath, job, result.error ?? "invalid description", secrets)) {
          failed += 1
        }
      }
    } catch (error) {
      if (isCodexProviderSetupBlocked(error)) {
        setupBlocked = true
        continue
      }

      if (markJobFailed(rootPath, job, error, secrets)) {
        failed += 1
      }
    }
  }

  return {
    applied,
    failed,
    remaining: listPendingAiJobs(rootPath).length,
    setupBlocked,
  }
}
