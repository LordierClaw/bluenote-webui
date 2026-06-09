import type { Router } from "../services/http.js"
import { getAiStatus } from "../services/ai-service.js"

export function registerAiRoutes(router: Router): void {
  router.get("/api/ai/status", () => getAiStatus())
}
