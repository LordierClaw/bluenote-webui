import path from "node:path"

import {
  createBlueNoteCore,
  createNoteRepository,
  createNoteDescription,
  selectNote,
} from "@lordierclaw/bluenote-core"

import type { CreateNoteRequest, NoteDetailView, NoteFolder, NoteSummaryView, SearchResultView, UpdateNoteRequest } from "../../shared/types.js"
import { folderFromRelativePath } from "../../shared/types.js"
import { HttpError } from "./http.js"
import { requireWorkspaceRoot } from "./workspace-service.js"

function toSummary(note: { key: string; title: string; description: string; relativePath: string; createdAt?: string }): NoteSummaryView {
  return { ...note, folder: folderFromRelativePath(note.relativePath) }
}

function validateFolder(folder: string | null): NoteFolder {
  if (folder === "note" || folder === "draft" || folder === "all") return folder
  return "all"
}

function visibilityFor(folder: NoteFolder): "normal" | "drafts" {
  if (folder === "note") return "normal"
  return "drafts"
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
      folder: folderFromRelativePath(match.relativePath),
      source: match.source ?? match.matchSource ?? "content",
      score: typeof match.score === "number" ? match.score : undefined,
      match: typeof match.match === "string" ? match.match : undefined,
    }))
  }
  return core.notes.list({ visibility: visibilityFor(folder) }).map(toSummary)
}

export function getNote(selector: string): NoteDetailView {
  const rootPath = requireWorkspaceRoot()
  const note = createBlueNoteCore({ rootPath }).notes.get(selector, { visibility: "drafts" })
  return { ...note, folder: folderFromRelativePath(note.relativePath) }
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
  createBlueNoteCore({ rootPath }).rebuild()
  return getNote(selected.frontmatter.id)
}

export function deleteNote(selector: string): { deleted: true; relativePath: string } {
  const rootPath = requireWorkspaceRoot()
  const result = createBlueNoteCore({ rootPath }).notes.delete(selector, { visibility: "drafts" })
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
  const result = createBlueNoteCore({ rootPath }).notes.promoteDraft(selector, { title, destinationFolder })
  return getNote(result.key)
}

export function rebuildWorkspace(): { rebuilt: true; noteCount: number } {
  const rootPath = requireWorkspaceRoot()
  const result = createBlueNoteCore({ rootPath }).rebuild()
  return { rebuilt: true, noteCount: result.noteCount }
}

export { createNoteDescription }
