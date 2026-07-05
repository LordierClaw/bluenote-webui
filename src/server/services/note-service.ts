import fs from "node:fs"
import path from "node:path"

import {
  assertPathInsideRoot,
  createBlueNoteCore,
  createNoteRepository,
  createSidecarRepository,
  createNoteDescription,
  getNoteSyncEntityId,
  recordSyncMutationBestEffort,
  selectNote,
} from "@lordierclaw/bluenote-core"

import type { CreateNoteRequest, FolderView, NoteDetailView, NoteFolder, NoteSummaryView, SearchResultView, UpdateNoteRequest } from "../../shared/types.js"
import { folderFromRelativePath } from "../../shared/types.js"
import { HttpError } from "./http.js"
import { requireWorkspaceRoot } from "./workspace-service.js"

function sidecarUpdatedAt(rootPath: string, key: string): string | undefined {
  try {
    return createSidecarRepository(rootPath).read(key).updatedAt
  } catch {
    return undefined
  }
}

function toSummary(note: { key: string; title: string; description: string; relativePath: string; createdAt?: string }, rootPath = requireWorkspaceRoot()): NoteSummaryView {
  return { ...note, folder: folderFromRelativePath(note.relativePath), updatedAt: sidecarUpdatedAt(rootPath, note.key) }
}

function validateFolder(folder: string | null): NoteFolder {
  if (folder === "note" || folder === "draft" || folder === "all") return folder
  return "all"
}

function visibilityFor(folder: NoteFolder): "normal" | "drafts" {
  if (folder === "note") return "normal"
  return "drafts"
}

function normalizeManagedRelativePath(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new HttpError(400, "invalid_path", "A folder path is required.")
  }
  return input.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
}

function assertManagedFolderInput(rootPath: string, input: unknown, options: { allowDraft?: boolean } = {}): string {
  const relativePath = normalizeManagedRelativePath(input)
  const parts = relativePath.split("/").filter(Boolean)
  const area = parts[0]
  if (
    parts.length === 0 ||
    (area !== "note" && (!options.allowDraft || area !== "draft")) ||
    parts.some((part) => part.startsWith("."))
  ) {
    throw new HttpError(400, "invalid_folder", "Choose a folder under note/.")
  }
  assertPathInsideRoot(rootPath, path.join(rootPath, relativePath))
  return relativePath
}

function walkFolders(rootPath: string, absolutePath: string, folders: string[]): void {
  if (!fs.existsSync(absolutePath)) return
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue
    const childPath = path.join(absolutePath, entry.name)
    const relativePath = path.relative(rootPath, childPath).replace(/\\/g, "/")
    folders.push(relativePath)
    walkFolders(rootPath, childPath, folders)
  }
}

function folderDisplayName(relativePath: string): string {
  return relativePath.split("/").filter(Boolean).at(-1) ?? relativePath
}

function noteCountForFolder(notes: readonly NoteSummaryView[], folderRelativePath: string): number {
  const prefix = folderRelativePath.endsWith("/") ? folderRelativePath : `${folderRelativePath}/`
  return notes.filter((note) => note.relativePath.startsWith(prefix)).length
}

export function listFolders(): FolderView[] {
  const rootPath = requireWorkspaceRoot()
  const folderPaths = ["note", "draft"]
  walkFolders(rootPath, path.join(rootPath, "note"), folderPaths)
  walkFolders(rootPath, path.join(rootPath, "draft"), folderPaths)
  const notes = listNotes({ folder: "all" }) as NoteSummaryView[]
  return Array.from(new Set(folderPaths))
    .sort((left, right) => left.localeCompare(right))
    .map((relativePath) => ({
      relativePath,
      name: folderDisplayName(relativePath),
      noteCount: noteCountForFolder(notes, relativePath),
    }))
}

export function createFolder(folderPathInput: unknown): FolderView {
  const rootPath = requireWorkspaceRoot()
  const relativePath = assertManagedFolderInput(rootPath, folderPathInput)
  const markedAt = new Date().toISOString()
  fs.mkdirSync(assertPathInsideRoot(rootPath, path.join(rootPath, relativePath)), { recursive: true })
  recordSyncMutationBestEffort(rootPath, { folders: [{ relativePath, markedAt }] })
  return listFolders().find((folder) => folder.relativePath === relativePath) ?? { relativePath, name: folderDisplayName(relativePath), noteCount: 0 }
}

export function renameFolder(folderPathInput: unknown, nextName: unknown): { previousRelativePath: string; relativePath: string } {
  const rootPath = requireWorkspaceRoot()
  if (typeof nextName !== "string" || nextName.trim().length === 0) {
    throw new HttpError(400, "invalid_folder_name", "A folder name is required.")
  }
  const relativePath = assertManagedFolderInput(rootPath, folderPathInput)
  const markedAt = new Date().toISOString()
  const notesBeforeRename = createNoteRepository(rootPath).list().filter((note) =>
    note.sourcePath === relativePath || note.sourcePath.startsWith(`${relativePath}/`),
  )
  const result = createNoteRepository(rootPath).renameFolder(relativePath, nextName)
  recordSyncMutationBestEffort(rootPath, {
    folders: [
      { relativePath: result.previousRelativePath, markedAt, dirtyType: "delete" },
      { relativePath: result.relativePath, markedAt },
    ],
    notes: notesBeforeRename.map((note) => {
      const nextRelativePath = `${result.relativePath}${note.sourcePath.slice(result.previousRelativePath.length)}`
      return {
        entityId: getNoteSyncEntityId(rootPath, note),
        markedAt,
        metadata: {
          key: note.frontmatter.id,
          previousRelativePath: note.sourcePath,
          relativePath: nextRelativePath,
          title: note.frontmatter.title,
          description: createNoteDescription(note.body),
        },
      }
    }),
  })
  createBlueNoteCore({ rootPath }).rebuild()
  return result
}

export function moveNote(selector: string, destinationFolderInput: unknown): NoteDetailView {
  const rootPath = requireWorkspaceRoot()
  const destinationFolder = assertManagedFolderInput(rootPath, destinationFolderInput)
  const core = createBlueNoteCore({ rootPath })
  const result = core.notes.move(selector, { destinationFolder })
  return getNote(result.key)
}

export function listNotes(options: { folder?: string | null; query?: string | null }): NoteSummaryView[] | SearchResultView[] {
  const rootPath = requireWorkspaceRoot()
  const core = createBlueNoteCore({ rootPath })
  const folder = validateFolder(options.folder ?? "all")
  const query = options.query?.trim()
  if (query) {
    return core.search.search(query, { visibility: visibilityFor(folder) }).map((match: any) => ({
      key: match.key,
      title: match.title,
      description: match.description,
      relativePath: match.relativePath,
      createdAt: match.createdAt,
      updatedAt: sidecarUpdatedAt(rootPath, match.key),
      folder: folderFromRelativePath(match.relativePath),
      source: match.source ?? match.matchSource ?? "content",
      score: typeof match.score === "number" ? match.score : undefined,
      match: typeof match.match === "string" ? match.match : undefined,
    }))
  }
  return core.notes.list({ visibility: visibilityFor(folder) }).map((note) => toSummary(note, rootPath))
}

export function getNote(selector: string): NoteDetailView {
  const rootPath = requireWorkspaceRoot()
  const note = createBlueNoteCore({ rootPath }).notes.get(selector, { visibility: "all" })
  return { ...note, folder: folderFromRelativePath(note.relativePath), updatedAt: sidecarUpdatedAt(rootPath, note.key) }
}

export function createNote(request: CreateNoteRequest): NoteDetailView {
  const rootPath = requireWorkspaceRoot()
  const core = createBlueNoteCore({ rootPath })
  const type = request.type ?? "draft"
  const created = core.notes.create({
    type,
    title: request.title,
    body: request.body ?? "",
    destinationFolder: type === "normal" ? request.destinationFolder ?? "note" : request.destinationFolder,
    enqueueAi: false,
  })
  return getNote(created.key)
}

export function updateNote(selector: string, request: UpdateNoteRequest): NoteDetailView {
  const rootPath = requireWorkspaceRoot()
  if (typeof request.body !== "string") {
    throw new HttpError(400, "invalid_body", "A note body string is required.")
  }
  // Core exposes create/delete/archive/promote but no high-level save-body façade yet.
  // This isolated adapter uses core's repository/select helpers, preserving storage layout and plain Markdown format.
  const repository = createNoteRepository(rootPath)
  const selected = selectNote({ repository, selector, visibility: "drafts" })
  const title = request.title?.trim() || selected.frontmatter.title
  repository.syncEditedNote(path.join(rootPath, selected.sourcePath), {
    title,
    body: request.body,
    updatedAt: new Date().toISOString(),
  })
  recordSyncMutationBestEffort(rootPath, {
    notes: [{
      entityId: getNoteSyncEntityId(rootPath, selected),
      markedAt: new Date().toISOString(),
      metadata: {
        key: selected.frontmatter.id,
        relativePath: selected.sourcePath,
        title,
        description: createNoteDescription(request.body),
      },
    }],
  })
  createBlueNoteCore({ rootPath }).rebuild()
  return getNote(selected.frontmatter.id)
}

export function deleteNote(selector: string): { deleted: true; relativePath: string } {
  const rootPath = requireWorkspaceRoot()
  const result = createBlueNoteCore({ rootPath }).notes.delete(selector, { visibility: "all", force: true })
  return { deleted: true, relativePath: result.relativePath }
}

export function archiveNote(selector: string): { archived: true; relativePath: string } {
  const rootPath = requireWorkspaceRoot()
  const result = createBlueNoteCore({ rootPath }).notes.archive(selector, { visibility: "normal" })
  return { archived: true, relativePath: result.relativePath }
}

export function promoteDraft(selector: string, title: string, destinationFolder = "note"): NoteDetailView {
  const rootPath = requireWorkspaceRoot()
  if (title.trim().length === 0) {
    throw new HttpError(400, "invalid_title", "A title is required to save a draft as a normal note.")
  }
  const core = createBlueNoteCore({ rootPath })
  const result = core.notes.promoteDraft(selector, { title, destinationFolder })
  core.rebuild()
  return getNote(result.key)
}

export function rebuildWorkspace(): { rebuilt: true; noteCount: number } {
  const rootPath = requireWorkspaceRoot()
  const result = createBlueNoteCore({ rootPath }).rebuild()
  return { rebuilt: true, noteCount: result.noteCount }
}

function timestampValue(value: string | undefined): number {
  const parsed = Date.parse(value ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}

export function getStartupNote(): NoteDetailView {
  const notes = listNotes({ folder: "all" }) as NoteSummaryView[]
  if (notes.length === 0) {
    return createNote({ type: "draft", body: "" })
  }
  const latest = [...notes].sort((left, right) => {
    const timeComparison = timestampValue(right.updatedAt ?? right.createdAt) - timestampValue(left.updatedAt ?? left.createdAt)
    return timeComparison !== 0 ? timeComparison : right.relativePath.localeCompare(left.relativePath)
  })[0]
  return getNote(latest.key)
}

export { createNoteDescription }
