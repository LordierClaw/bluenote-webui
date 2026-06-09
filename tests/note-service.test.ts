import os from "node:os"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"
import { initWorkspace, resetWorkspaceForTests } from "../src/server/services/workspace-service.js"
import { createNote, getNote, listNotes, updateNote, archiveNote } from "../src/server/services/note-service.js"

const roots: string[] = []

async function setupRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-notes-"))
  roots.push(root)
  initWorkspace(root)
  return root
}

afterEach(async () => {
  resetWorkspaceForTests()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("note service", () => {
  test("creates, lists, searches, gets, updates, and archives a note through core", async () => {
    await setupRoot()
    const created = createNote({ type: "normal", title: "Alpha Note", body: "literal needle phrase", destinationFolder: "note" })
    expect(created.relativePath).toMatch(/^note\//)
    expect(listNotes({ folder: "all" })).toHaveLength(1)
    expect(listNotes({ folder: "all", query: "needle phrase" })[0]).toMatchObject({ key: created.key, source: expect.any(String) })
    expect(getNote(created.key).body).toContain("literal needle")
    const saved = updateNote(created.key, { body: "changed body remains visible" })
    expect(saved.body).toBe("changed body remains visible")
    const archived = archiveNote(created.key)
    expect(archived).toMatchObject({ archived: true })
    expect(archived.relativePath).toMatch(/^\.data\/archive\//)
    expect(listNotes({ folder: "all" })).toHaveLength(0)
    expect(listNotes({ folder: "all", query: "changed" })).toHaveLength(0)
  })
})
