import http from "node:http"

import { describe, expect, test } from "vitest"

import { runWebCommand, type WebCommandOutput, type WebServerHandle } from "../src/command.js"
import type { ServerOptions } from "../src/server/index.js"
import packageJson from "../package.json"

function bufferedOutput() {
  let text = ""
  const output: WebCommandOutput = {
    write(message: string) {
      text += message
    },
  }

  return {
    output,
    text() {
      return text
    },
  }
}

function fakeServer(onListen: (port: number, host: string) => void): WebServerHandle {
  return {
    listen(port: number, host: string, listeningListener?: () => void) {
      onListen(port, host)
      listeningListener?.()
      return this
    },
    once() {
      return this
    },
  }
}

async function withFakeDaemon<T>(handler: http.RequestListener, run: (url: string) => Promise<T>): Promise<T> {
  const server = http.createServer(handler)

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    server.close()
    throw new Error("fake daemon did not bind to a TCP port")
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

describe("package bin", () => {
  test("exposes a stable bluenote-webui executable", () => {
    expect(packageJson.bin).toEqual({ "bluenote-webui": "./bin/bluenote-webui.js" })
  })
})

describe("runWebCommand", () => {
  test("parses host and port args and delegates to server listen", async () => {
    const stdout = bufferedOutput()
    let createdOptions: ServerOptions | undefined
    const listens: Array<{ port: number; host: string }> = []

    const result = await runWebCommand(["--host", "0.0.0.0", "--port", "5123"], {
      createServer(options) {
        createdOptions = options
        return fakeServer((port, host) => listens.push({ port, host }))
      },
      stdout: stdout.output,
    })

    expect(result).toBeUndefined()
    expect(createdOptions).toEqual({ host: "0.0.0.0" })
    expect(listens).toEqual([{ port: 5123, host: "0.0.0.0" }])
    expect(stdout.text()).toContain("http://0.0.0.0:5123")
  })

  test("uses environment defaults when args are omitted", async () => {
    let createdOptions: ServerOptions | undefined
    const listens: Array<{ port: number; host: string }> = []

    await runWebCommand([], {
      createServer(options) {
        createdOptions = options
        return fakeServer((port, host) => listens.push({ port, host }))
      },
      env: {
        BLUENOTE_WEBUI_HOST: "127.0.0.2",
        BLUENOTE_WEBUI_PORT: "6123",
      },
      stdout: bufferedOutput().output,
    })

    expect(createdOptions).toEqual({ host: "127.0.0.2" })
    expect(listens).toEqual([{ port: 6123, host: "127.0.0.2" }])
  })

  test("prints help without creating a server", async () => {
    const stdout = bufferedOutput()
    let createServerCalled = false

    const result = await runWebCommand(["--help"], {
      createServer() {
        createServerCalled = true
        return fakeServer(() => undefined)
      },
      stdout: stdout.output,
    })

    expect(result).toBe(0)
    expect(createServerCalled).toBe(false)
    expect(stdout.text()).toContain("Usage: bluenote web [options]")
    expect(stdout.text()).toContain("--daemon-url <url>")
    expect(stdout.text()).toContain("--check-daemon")
  })

  test("prints help even when environment port is invalid", async () => {
    const stdout = bufferedOutput()
    const stderr = bufferedOutput()
    let createServerCalled = false

    const result = await runWebCommand(["--help"], {
      createServer() {
        createServerCalled = true
        return fakeServer(() => undefined)
      },
      env: { PORT: "not-a-port" },
      stdout: stdout.output,
      stderr: stderr.output,
    })

    expect(result).toBe(0)
    expect(createServerCalled).toBe(false)
    expect(stdout.text()).toContain("Usage: bluenote web [options]")
    expect(stderr.text()).toBe("")
  })

  test("CLI port overrides invalid environment port", async () => {
    const stdout = bufferedOutput()
    const stderr = bufferedOutput()
    const listens: Array<{ port: number; host: string }> = []

    const result = await runWebCommand(["--port", "4174"], {
      createServer() {
        return fakeServer((port, host) => listens.push({ port, host }))
      },
      env: { PORT: "not-a-port" },
      stdout: stdout.output,
      stderr: stderr.output,
    })

    expect(result).toBeUndefined()
    expect(listens).toEqual([{ port: 4174, host: "127.0.0.1" }])
    expect(stderr.text()).toBe("")
  })

  test("prints version without creating a server", async () => {
    const stdout = bufferedOutput()
    let createServerCalled = false

    const result = await runWebCommand(["--version"], {
      createServer() {
        createServerCalled = true
        return fakeServer(() => undefined)
      },
      stdout: stdout.output,
    })

    expect(result).toBe(0)
    expect(createServerCalled).toBe(false)
    expect(stdout.text()).toBe(`${packageJson.version}\n`)
  })

  test("accepts daemon flags without crashing", async () => {
    const stdout = bufferedOutput()
    let createServerCalled = false

    const result = await runWebCommand(["--daemon-url", "http://127.0.0.1:9", "--daemon-token", "secret-token", "--help"], {
      createServer() {
        createServerCalled = true
        return fakeServer(() => undefined)
      },
      stdout: stdout.output,
    })

    expect(result).toBe(0)
    expect(createServerCalled).toBe(false)
    expect(stdout.text()).toContain("Usage: bluenote web [options]")
  })

  test("starts the server without probing daemon when daemon URL is provided for normal launches", async () => {
    const stdout = bufferedOutput()
    let createdOptions: ServerOptions | undefined
    const listens: Array<{ port: number; host: string }> = []

    const result = await runWebCommand(["--daemon-url", "http://127.0.0.1:9", "--daemon-token", "secret-token"], {
      createServer(options) {
        createdOptions = options
        return fakeServer((port, host) => listens.push({ port, host }))
      },
      env: {},
      stdout: stdout.output,
    })

    expect(result).toBeUndefined()
    expect(createdOptions).toEqual({ host: "127.0.0.1" })
    expect(listens).toEqual([{ port: 4174, host: "127.0.0.1" }])
    expect(stdout.text()).toContain("bluenote-webui server listening")
    expect(stdout.text()).not.toContain("secret-token")
  })

  test("checks daemon health and capabilities in smoke mode", async () => {
    const stdout = bufferedOutput()
    const stderr = bufferedOutput()
    const seenRequests: Array<{ url?: string; authorization?: string }> = []

    const result = await withFakeDaemon((request, response) => {
      seenRequests.push({ url: request.url, authorization: request.headers.authorization })
      response.setHeader("content-type", "application/json")
      response.end(JSON.stringify({ ok: true }))
    }, async (daemonUrl) => runWebCommand(["--check-daemon", "--daemon-url", daemonUrl, "--daemon-token", "secret-token"], {
      stdout: stdout.output,
      stderr: stderr.output,
    }))

    expect(result).toBe(0)
    expect(seenRequests).toEqual([
      { url: "/health", authorization: "Bearer secret-token" },
      { url: "/capabilities", authorization: "Bearer secret-token" },
    ])
    expect(stdout.text()).toContain("BlueNote daemon check passed")
    expect(stdout.text()).not.toContain("secret-token")
    expect(stderr.text()).toBe("")
  })

  test("checks daemon environment variables in smoke mode", async () => {
    const stdout = bufferedOutput()

    const result = await withFakeDaemon((_request, response) => {
      response.setHeader("content-type", "application/json")
      response.end(JSON.stringify({ ok: true }))
    }, async (daemonUrl) => runWebCommand(["--check-daemon"], {
      env: {
        BLUENOTE_DAEMON_URL: daemonUrl,
        BLUENOTE_DAEMON_TOKEN: "env-token",
      },
      stdout: stdout.output,
    }))

    expect(result).toBe(0)
    expect(stdout.text()).toContain("BlueNote daemon check passed")
    expect(stdout.text()).not.toContain("env-token")
  })

  test("fails daemon smoke mode when daemon is unreachable", async () => {
    const stdout = bufferedOutput()
    const stderr = bufferedOutput()

    const result = await runWebCommand(["--check-daemon", "--daemon-url", "http://127.0.0.1:9", "--daemon-token", "secret-token"], {
      stdout: stdout.output,
      stderr: stderr.output,
    })

    expect(result).toBe(1)
    expect(stdout.text()).toBe("")
    expect(stderr.text()).toContain("BlueNote daemon check failed")
    expect(stderr.text()).not.toContain("secret-token")
  })

  test("reports invalid args without creating a server", async () => {
    const stderr = bufferedOutput()
    let createServerCalled = false

    const result = await runWebCommand(["--port", "not-a-port"], {
      createServer() {
        createServerCalled = true
        return fakeServer(() => undefined)
      },
      stderr: stderr.output,
    })

    expect(result).toBe(1)
    expect(createServerCalled).toBe(false)
    expect(stderr.text()).toContain("--port must be an integer port")
  })
})
