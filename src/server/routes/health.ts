import { APP_NAME, type HealthResponse } from "../../shared/types.js"
import type { Router } from "../services/http.js"

export function registerHealthRoutes(router: Router, host: string): void {
  router.get("/api/health", () => ({
    app: APP_NAME,
    status: "ok",
    nodeVersion: process.version,
    host,
  } satisfies HealthResponse))
}
