import { createServer as createNodeServer, type IncomingMessage, type ServerResponse } from "node:http"
import { URL } from "node:url"

import type { ApiErrorBody } from "../../shared/types.js"

export interface RequestContext<TBody = unknown> {
  request: IncomingMessage
  response: ServerResponse
  url: URL
  params: Record<string, string>
  body: TBody
}

export type RouteHandler<TBody = unknown> = (context: RequestContext<TBody>) => unknown | Promise<unknown>

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: RouteHandler
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public hint?: string) {
    super(message)
  }
}

export class Router {
  private routes: Route[] = []

  get(path: string, handler: RouteHandler): void {
    this.add("GET", path, handler)
  }

  post(path: string, handler: RouteHandler): void {
    this.add("POST", path, handler)
  }

  patch(path: string, handler: RouteHandler): void {
    this.add("PATCH", path, handler)
  }

  delete(path: string, handler: RouteHandler): void {
    this.add("DELETE", path, handler)
  }

  private add(method: string, path: string, handler: RouteHandler): void {
    const keys: string[] = []
    const pattern = new RegExp(`^${path.replace(/:[^/]+/g, (part) => {
      keys.push(part.slice(1))
      return "([^/]+)"
    })}$`)
    this.routes.push({ method, pattern, keys, handler })
  }

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`)
      const route = this.match(request.method ?? "GET", url.pathname)
      if (!route) {
        throw new HttpError(404, "not_found", "Route not found.")
      }
      const body = await readJsonBody(request)
      const result = await route.handler({ request, response, url, params: route.params, body })
      if (!response.headersSent) {
        sendJson(response, 200, result ?? { ok: true })
      }
    } catch (error) {
      sendError(response, error)
    }
  }

  private match(method: string, pathname: string): (Route & { params: Record<string, string> }) | undefined {
    for (const route of this.routes) {
      if (route.method !== method) continue
      const match = route.pattern.exec(pathname)
      if (!match) continue
      const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1] ?? "")]))
      return { ...route, params }
    }
    return undefined
  }
}

export function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  response.end(JSON.stringify(payload))
}

function sendError(response: ServerResponse, error: unknown): void {
  if (response.headersSent) return
  const status = error instanceof HttpError ? error.status : 500
  const body: ApiErrorBody = {
    error: {
      code: error instanceof HttpError ? error.code : "internal_error",
      message: error instanceof Error ? error.message : "Unexpected server error.",
      hint: error instanceof HttpError ? error.hint : undefined,
    },
  }
  sendJson(response, status, body)
}

const MAX_JSON_BODY_BYTES = 1024 * 1024

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (!["POST", "PATCH", "PUT"].includes(request.method ?? "")) return undefined
  const chunks: Buffer[] = []
  let totalBytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.byteLength
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new HttpError(413, "request_too_large", "Request body must be 1 MiB or smaller.")
    }
    chunks.push(buffer)
  }
  if (chunks.length === 0) return undefined
  const raw = Buffer.concat(chunks).toString("utf8")
  if (raw.trim().length === 0) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON.")
  }
}

export function createHttpServer(router: Router) {
  return createNodeServer((request, response) => {
    void router.handle(request, response)
  })
}
