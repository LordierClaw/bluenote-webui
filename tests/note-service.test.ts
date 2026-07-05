import os from "node:os"
import path from "node:path"
import { existsSync } from "node:fs"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { afterEach, describe, expect, test } from "vitest"
import { createBlueNoteCore, createDirtyRecordRepository, readStateManifest } from "@lordierclaw/bluenote-core"
import { initWorkspace, resetWorkspaceForTests } from "../src/server/services/workspace-service.js"
import { archiveNote, createFolder, createNote, deleteNote, getNote, getStartupNote, listFolders, listNotes, moveNote, promoteDraft, renameFolder, updateNote } from "../src/server/services/note-service.js"

const roots: string[] = []

async function setupRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bluenote-webui-notes-"))
  roots.push(root)
  initWorkspace(root)
  return root
}

function linkSyncClient(root: string) {
  createBlueNoteCore({ rootPath: root }).sync.link({
    mode: "seed-empty-server-from-local",
    serverUrl: "https://sync.example.test/api",
    workspaceId: "workspace-webui-test",
  })
}

function dirtyRecords(root: string) {
  const manifest = readStateManifest(root)
  if (!manifest.workspaceId) throw new Error("test workspace missing workspaceId")
  return createDirtyRecordRepository(root, { role: "client", workspaceId: manifest.workspaceId }).listDirtyRecords()
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

  test("deletes a normal note through the web action", async () => {
    const root = await setupRoot()
    const created = createNote({ type: "normal", title: "Delete Me", body: "temporary", destinationFolder: "note" })

    const deleted = deleteNote(created.key)

    expect(deleted).toMatchObject({ deleted: true, relativePath: created.relativePath })
    expect(existsSync(path.join(root, created.relativePath))).toBe(false)
    expect(listNotes({ folder: "all" })).toHaveLength(0)
  })

  test("creates a startup draft when the workspace has no active notes", async () => {
    await setupRoot()

    const startup = getStartupNote()

    expect(startup.relativePath).toMatch(/^draft\//)
    expect(startup.folder).toBe("draft")
    expect(listNotes({ folder: "all" })).toHaveLength(1)
  })

  test("loads the latest updated active note or draft on startup", async () => {
    await setupRoot()
    const normal = createNote({ type: "normal", title: "Older Normal", body: "older", destinationFolder: "note" })
    const draft = createNote({ type: "draft", body: "newer draft" })
    updateNote(normal.key, { body: "still older" })
    const latest = updateNote(draft.key, { body: "latest draft body" })

    expect(getStartupNote()).toMatchObject({ key: latest.key, relativePath: latest.relativePath, body: "latest draft body" })
  })

  test("startup loads a draft after it is promoted to a normal note", async () => {
    await setupRoot()
    const draft = createNote({ type: "draft", body: "draft body promoted from startup" })
    updateNote(draft.key, { body: "latest promoted body" })

    const promoted = promoteDraft(draft.key, "Promoted Draft", "note")

    expect(promoted.folder).toBe("note")
    expect(promoted.relativePath).toMatch(/^note\//)
    expect(promoted.key).not.toBe(draft.key)
    expect(() => getStartupNote()).not.toThrow()
    expect(getStartupNote()).toMatchObject({
      key: promoted.key,
      relativePath: promoted.relativePath,
      folder: "note",
      body: "latest promoted body",
    })
  })

  test("lists empty folders and ignores .folder marker files", async () => {
    const root = await setupRoot()
    await mkdir(path.join(root, "note", "projects", "alpha"), { recursive: true })

    expect(listFolders().map((folder) => folder.relativePath)).toEqual(expect.arrayContaining(["note", "note/projects", "note/projects/alpha", "draft"]))
    expect(listNotes({ folder: "all" }).some((note) => note.relativePath.endsWith(".folder"))).toBe(false)
  })

  test("creates, renames, and moves notes between manager folders", async () => {
    const root = await setupRoot()
    const folder = createFolder("note/projects")
    const created = createNote({ type: "normal", title: "Folder Note", body: "inside folder", destinationFolder: folder.relativePath })

    expect(created.relativePath).toMatch(/^note\/projects\//)
    expect(existsSync(path.join(root, created.relativePath))).toBe(true)

    const renamed = renameFolder("note/projects", "archive")
    expect(renamed.relativePath).toBe("note/archive")

    const moved = moveNote(created.key, "note")
    expect(moved.relativePath).toMatch(/^note\/folder-note/)
    expect(getNote(created.key).relativePath).toBe(moved.relativePath)
  })

  test("marks direct WebUI folder and note edits dirty for sync clients", async () => {
    const root = await setupRoot()
    linkSyncClient(root)

    const folder = createFolder("note/projects")
    const created = createNote({ type: "normal", title: "Sync Folder Note", body: "inside folder", destinationFolder: folder.relativePath })
    const updated = updateNote(created.key, { body: "web editor update" })
    const renamed = renameFolder("note/projects", "archive")

    const records = dirtyRecords(root)
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: "folder", entityId: "note/projects", dirtyType: "delete" }),
      expect.objectContaining({ entityType: "folder", entityId: "note/archive", dirtyType: "upsert" }),
      expect.objectContaining({ entityType: "note", dirtyType: "upsert", metadata: expect.objectContaining({ key: updated.key }) }),
    ]))
    const noteRecord = records.find((record) => record.entityType === "note" && record.metadata?.key === updated.key && record.metadata.previousRelativePath === created.relativePath)
    expect(noteRecord?.metadata).toMatchObject({
      key: created.key,
      previousRelativePath: created.relativePath,
      relativePath: `${renamed.relativePath}/${path.basename(created.relativePath)}`,
      description: expect.stringContaining("web editor update"),
    })
  })
})
