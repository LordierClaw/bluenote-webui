import { createHttpServer, Router } from "./services/http.js"
import { registerAiRoutes } from "./routes/ai.js"
import { registerHealthRoutes } from "./routes/health.js"
import { registerNoteRoutes } from "./routes/notes.js"
import { registerWorkspaceRoutes } from "./routes/workspace.js"

export interface ServerOptions {
  host?: string
}

export function createServer(options: ServerOptions = {}) {
  const host = options.host ?? process.env.BLUENOTE_WEBUI_HOST ?? "127.0.0.1"
  const router = new Router()
  registerHealthRoutes(router, host)
  registerWorkspaceRoutes(router)
  registerNoteRoutes(router)
  registerAiRoutes(router)
  return createHttpServer(router)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const host = process.env.BLUENOTE_WEBUI_HOST ?? "127.0.0.1"
  const port = Number(process.env.PORT ?? process.env.BLUENOTE_WEBUI_PORT ?? 4174)
  createServer({ host }).listen(port, host, () => {
    console.log(`bluenote-webui server listening on http://${host}:${port}`)
  })
}
