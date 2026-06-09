import type { Router } from "../services/http.js"
import { initWorkspace, openWorkspace, workspaceStatus } from "../services/workspace-service.js"

export function registerWorkspaceRoutes(router: Router): void {
  router.get("/api/workspace", () => workspaceStatus())
  router.post("/api/workspace/open", ({ body }) => openWorkspace((body as { rootPath?: unknown } | undefined)?.rootPath))
  router.post("/api/workspace/init", ({ body }) => initWorkspace((body as { rootPath?: unknown } | undefined)?.rootPath))
}
