import os from "node:os"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"
import { initWorkspace, resetWorkspaceForTests, workspaceStatus } from "../src/server/services/workspace-service.js"

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
})
