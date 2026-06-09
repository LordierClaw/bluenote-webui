import { createReadStream, existsSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { IncomingMessage, ServerResponse } from "node:http"

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
}

function getClientDistPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../client")
}

function safeResolveAsset(rootPath: string, pathname: string): string {
  const decodedPathname = decodeURIComponent(pathname)
  const normalizedPathname = decodedPathname === "/" ? "/index.html" : decodedPathname
  const relativePath = normalizedPathname.replace(/^\/+/, "")
  const resolvedPath = path.resolve(rootPath, relativePath)
  if (resolvedPath !== rootPath && !resolvedPath.startsWith(`${rootPath}${path.sep}`)) {
    return path.join(rootPath, "index.html")
  }
  return resolvedPath
}

export function serveStaticClient(request: IncomingMessage, response: ServerResponse): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false

  const clientDistPath = getClientDistPath()
  const url = new URL(request.url ?? "/", "http://127.0.0.1")
  let assetPath = safeResolveAsset(clientDistPath, url.pathname)

  if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
    assetPath = path.join(clientDistPath, "index.html")
  }

  if (!existsSync(assetPath) || !statSync(assetPath).isFile()) return false

  response.writeHead(200, {
    "content-type": MIME_TYPES[path.extname(assetPath)] ?? "application/octet-stream",
    "x-content-type-options": "nosniff",
  })

  if (request.method === "HEAD") {
    response.end()
    return true
  }

  createReadStream(assetPath).pipe(response)
  return true
}
