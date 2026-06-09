import os from "node:os"
import path from "node:path"
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"
import { getAiStatus } from "../src/server/services/ai-service.js"
import { initWorkspace, resetWorkspaceForTests } from "../src/server/services/workspace-service.js"

const roots: string[] = []

async function setupRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-ai-"))
  roots.push(root)
  initWorkspace(root)
  return root
}

afterEach(async () => {
  resetWorkspaceForTests()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("AI status service", () => {
  test("reports not configured for fresh roots", async () => {
    await setupRoot()
    expect(getAiStatus()).toMatchObject({ status: "not-configured" })
  })

  test("does not expose codex auth or token-looking fixture values", async () => {
    const root = await setupRoot()
    await mkdir(path.join(root, ".data", "ai"), { recursive: true })
    await writeFile(path.join(root, ".data", "ai", "codex-auth.json"), JSON.stringify({ accessToken: "secret-token-value" }), "utf8")
    const json = JSON.stringify(getAiStatus())
    expect(json).not.toContain("secret-token-value")
    expect(json).not.toContain("codex-auth")
  })
})
