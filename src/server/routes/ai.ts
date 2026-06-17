import type { AiDescribeRequest, AiProcessQueueRequest } from "../../shared/types.js"
import type { Router } from "../services/http.js"
import {
  deleteCodexAuth,
  describeNoteWithAi,
  enqueueNoteDescription,
  getAiConfigView,
  getAiQueueView,
  getAiStatus,
  getCodexAuthStatusView,
  pollCodexAuth,
  processAiQueue,
  saveAiConfig,
  startCodexAuth,
} from "../services/ai-service.js"

export function registerAiRoutes(router: Router): void {
  router.get("/api/ai/status", () => getAiStatus())
  router.get("/api/ai/config", () => getAiConfigView())
  router.post("/api/ai/config", ({ body }) => saveAiConfig(body))
  router.get("/api/ai/queue", () => getAiQueueView())
  router.post("/api/ai/queue/describe", ({ body }) => enqueueNoteDescription((body ?? {}) as AiDescribeRequest))
  router.post("/api/ai/describe", ({ body }) => describeNoteWithAi((body ?? {}) as AiDescribeRequest))
  router.post("/api/ai/process-queue", ({ body }) => processAiQueue((body ?? {}) as AiProcessQueueRequest))
  router.get("/api/ai/codex-auth/status", () => getCodexAuthStatusView())
  router.post("/api/ai/codex-auth/start", () => startCodexAuth())
  router.post("/api/ai/codex-auth/poll", () => pollCodexAuth())
  router.delete("/api/ai/codex-auth", () => deleteCodexAuth())
}
