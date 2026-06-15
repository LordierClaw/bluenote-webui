import type { ServerOptions } from "./server/index.js"
import http from "node:http"
import https from "node:https"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
function readPackageVersion(): string {
  try {
    return (require("../package.json") as { version: string }).version
  } catch {
    return (require("../../package.json") as { version: string }).version
  }
}

export interface WebCommandOutput {
  write(message: string): unknown
}

export interface WebServerHandle {
  listen(port: number, hostname: string, listeningListener?: () => void): WebServerHandle
  once?(eventName: "error", listener: (error: Error) => void): WebServerHandle
}

export interface WebCommandOptions {
  createServer?: (options: ServerOptions) => WebServerHandle
  env?: Partial<Record<string, string | undefined>>
  stdout?: WebCommandOutput
  stderr?: WebCommandOutput
}

interface ParsedWebCommand {
  checkDaemon: boolean
  daemonToken?: string
  daemonUrl?: string
  help: boolean
  host: string
  port?: number
  version: boolean
}

const DEFAULT_HOST = "127.0.0.1"
const DEFAULT_PORT = 4174

function webCommandHelp(): string {
  return [
    "Usage: bluenote web [options]",
    "",
    "Start the local BlueNote WebUI server.",
    "",
    "Options:",
    "  --host <host>    Host to bind (default: BLUENOTE_WEBUI_HOST or 127.0.0.1)",
    "  --port <port>    Port to bind (default: PORT, BLUENOTE_WEBUI_PORT, or 4174)",
    "  --daemon-url <url>     BlueNote daemon URL (default: BLUENOTE_DAEMON_URL)",
    "  --daemon-token <token> BlueNote daemon token (default: BLUENOTE_DAEMON_TOKEN)",
    "  --check-daemon        Check daemon health/capabilities without starting a browser server",
    "  --help, -h       Show this help",
    "",
  ].join("\n")
}

function parsePort(value: string, source: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${source} must be an integer port`)
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${source} must be between 1 and 65535`)
  }

  return port
}

function parseWebCommand(args: string[], env: Partial<Record<string, string | undefined>>): ParsedWebCommand {
  const parsed: ParsedWebCommand = {
    checkDaemon: false,
    daemonToken: env.BLUENOTE_DAEMON_TOKEN,
    daemonUrl: env.BLUENOTE_DAEMON_URL,
    help: false,
    host: env.BLUENOTE_WEBUI_HOST ?? DEFAULT_HOST,
    version: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--help" || arg === "-h") {
      parsed.help = true
      continue
    }

    if (arg === "--version" || arg === "-v") {
      parsed.version = true
      continue
    }

    if (arg === "--check-daemon") {
      parsed.checkDaemon = true
      continue
    }

    if (arg === "--daemon-url") {
      const daemonUrl = args[index + 1]
      if (!daemonUrl) throw new Error("--daemon-url requires a value")
      parsed.daemonUrl = daemonUrl
      index += 1
      continue
    }

    if (arg.startsWith("--daemon-url=")) {
      const daemonUrl = arg.slice("--daemon-url=".length)
      if (!daemonUrl) throw new Error("--daemon-url requires a value")
      parsed.daemonUrl = daemonUrl
      continue
    }

    if (arg === "--daemon-token") {
      const daemonToken = args[index + 1]
      if (!daemonToken) throw new Error("--daemon-token requires a value")
      parsed.daemonToken = daemonToken
      index += 1
      continue
    }

    if (arg.startsWith("--daemon-token=")) {
      const daemonToken = arg.slice("--daemon-token=".length)
      if (!daemonToken) throw new Error("--daemon-token requires a value")
      parsed.daemonToken = daemonToken
      continue
    }

    if (arg === "--host") {
      const host = args[index + 1]
      if (!host) throw new Error("--host requires a value")
      parsed.host = host
      index += 1
      continue
    }

    if (arg.startsWith("--host=")) {
      const host = arg.slice("--host=".length)
      if (!host) throw new Error("--host requires a value")
      parsed.host = host
      continue
    }

    if (arg === "--port") {
      const port = args[index + 1]
      if (!port) throw new Error("--port requires a value")
      parsed.port = parsePort(port, "--port")
      index += 1
      continue
    }

    if (arg.startsWith("--port=")) {
      parsed.port = parsePort(arg.slice("--port=".length), "--port")
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  if (parsed.port === undefined && !parsed.help && !parsed.version && !parsed.checkDaemon) {
    parsed.port = parsePort(env.PORT ?? env.BLUENOTE_WEBUI_PORT ?? String(DEFAULT_PORT), "port")
  }

  return parsed
}

function daemonRequest(url: URL, token: string | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http
    const request = client.request(url, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      method: "GET",
      timeout: 5_000,
    }, (response) => {
      response.resume()
      response.on("end", () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          resolve()
          return
        }

        reject(new Error(`HTTP ${response.statusCode ?? "unknown"}`))
      })
    })

    request.on("error", reject)
    request.on("timeout", () => {
      request.destroy(new Error("request timed out"))
    })
    request.end()
  })
}

function daemonEndpoint(baseUrl: string, path: string): URL {
  const url = new URL(baseUrl)
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`
  url.search = ""
  url.hash = ""
  return url
}

async function checkDaemon(parsed: ParsedWebCommand): Promise<void> {
  if (!parsed.daemonUrl) {
    throw new Error("--check-daemon requires --daemon-url or BLUENOTE_DAEMON_URL")
  }

  await daemonRequest(daemonEndpoint(parsed.daemonUrl, "/health"), parsed.daemonToken)
  await daemonRequest(daemonEndpoint(parsed.daemonUrl, "/capabilities"), parsed.daemonToken)
}

export async function runWebCommand(args: string[], options: WebCommandOptions = {}): Promise<void | number> {
  const stdout = options.stdout ?? process.stdout
  const stderr = options.stderr ?? process.stderr
  const env = options.env ?? process.env

  let parsed: ParsedWebCommand
  try {
    parsed = parseWebCommand(args, env)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    stderr.write(`${message}\nRun with --help for usage.\n`)
    return 1
  }

  if (parsed.help) {
    stdout.write(webCommandHelp())
    return 0
  }

  if (parsed.version) {
    stdout.write(`${readPackageVersion()}\n`)
    return 0
  }

  if (parsed.checkDaemon) {
    try {
      await checkDaemon(parsed)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      stderr.write(`BlueNote daemon check failed: ${message}\n`)
      return 1
    }

    stdout.write("BlueNote daemon check passed\n")
    return 0
  }

  const port = parsed.port ?? DEFAULT_PORT
  const makeServer = options.createServer ?? (await import("./server/index.js")).createServer
  const server = makeServer({ host: parsed.host })

  await new Promise<void>((resolve, reject) => {
    server.once?.("error", reject)
    server.listen(port, parsed.host, () => {
      stdout.write(`bluenote-webui server listening on http://${parsed.host}:${port}\n`)
      resolve()
    })
  })
}
