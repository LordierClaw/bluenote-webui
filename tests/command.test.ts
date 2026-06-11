import { describe, expect, test } from "vitest"

import { runWebCommand, type WebCommandOutput, type WebServerHandle } from "../src/command.js"
import type { ServerOptions } from "../src/server/index.js"

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
