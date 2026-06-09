import { createAiConfigRepository, createAiQueueRepository } from "@lordierclaw/bluenote-core"

import type { AiStatusSummary } from "../../shared/types.js"
import { getSelectedRootPath } from "./workspace-service.js"

function mask(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined
  if (value.length <= 4) return "••••"
  return `${value.slice(0, 2)}••••${value.slice(-2)}`
}

export function getAiStatus(): AiStatusSummary {
  const rootPath = getSelectedRootPath()
  if (!rootPath) return { status: "workspace-not-open", message: "Open a workspace to inspect AI status." }

  try {
    const configRepository = createAiConfigRepository(rootPath)
    if (!configRepository.exists()) {
      return { status: "not-configured", message: "AI is not configured for this workspace." }
    }
    const config = configRepository.read() as any
    const queueRepository = createAiQueueRepository(rootPath)
    const jobs = queueRepository.exists() ? queueRepository.read().jobs : []
    const queue = {
      pending: jobs.filter((job) => job.status === "pending").length,
      running: jobs.filter((job) => job.status === "running").length,
      failed: jobs.filter((job) => job.status === "failed").length,
    }
    const provider = mask(config.provider ?? config.kind ?? config.type)
    const model = mask(config.model)
    const status = queue.running > 0 ? "running" : config.requiresAuth ? "auth-required" : "connected"
    return { status, provider, model, queue }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message.replace(/(api[_-]?key|token|bearer)\s*[:=]\s*\S+/gi, "$1=••••") : "Could not read safe AI status.",
    }
  }
}
