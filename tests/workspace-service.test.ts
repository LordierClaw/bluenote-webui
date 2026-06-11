import os from "node:os"
import path from "node:path"
import { existsSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"
import { autoOpenOrInitDefaultWorkspace, initWorkspace, normalizeWorkspacePath, resetWorkspaceForTests, workspaceStatus } from "../src/server/services/workspace-service.js"

const roots: string[] = []

afterEach(async () => {
  resetWorkspaceForTests()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("workspace service", () => {
  test("initializes a temp root through core layout", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-workspace-"))
    roots.push(root)
    const status = initWorkspace(root)
    expect(status).toMatchObject({ selected: true, initialized: true, rootPath: root })
    expect(workspaceStatus().noteCount).toBe(0)
  })

  test("allows a hidden default .bluenote workspace root", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-home-"))
    roots.push(home)
    const hiddenRoot = path.join(home, ".bluenote")

    expect(normalizeWorkspacePath(hiddenRoot)).toBe(path.resolve(hiddenRoot))
  })

  test("rejects paths inside BlueNote internal state on Unix and Windows separators", () => {
    expect(() => normalizeWorkspacePath("/tmp/.bluenote/.data/notes/meta.json")).toThrow(/hidden internal/i)
    expect(() => normalizeWorkspacePath(String.raw`C:\Users\Ada\.bluenote\.data\notes\meta.json`)).toThrow(/hidden internal/i)
  })

  test("auto initializes ~/.bluenote when no workspace is open", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-home-"))
    roots.push(home)

    const status = autoOpenOrInitDefaultWorkspace({ homeDir: home, cwd: home, env: {} })

    expect(status).toMatchObject({ selected: true, initialized: true, rootPath: path.join(home, ".bluenote") })
    expect(existsSync(path.join(home, ".bluenote", ".data", "manifest.json"))).toBe(true)
  })
})
