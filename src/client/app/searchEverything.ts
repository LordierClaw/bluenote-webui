import { collectContainsFieldMatches, scoreContainsMatch } from "@lordierclaw/bluenote-core/search/contains-match"

import type { FolderView, NoteDetailView, NoteSummaryView, SearchResultView } from "../../shared/types"
import type { CommandEntry } from "./commands"

export type SearchEverythingEntry =
  | {
      kind: "command"
      id: string
      score: number
      label: string
      detail: string
      command: CommandEntry
    }
  | {
      kind: "note"
      id: string
      score: number
      label: string
      detail: string
      note: NoteSummaryView
    }
  | {
      kind: "content"
      id: string
      score: number
      label: string
      detail: string
      result: SearchResultView
    }
  | {
      kind: "folder"
      id: string
      score: number
      label: string
      detail: string
      folder: FolderView
      previewLines: string[]
    }

export interface SearchEverythingPreviewModel {
  title: string
  subtitle: string
  lines: string[]
}

export function buildSearchEverythingEntries(query: string, options: {
  commands: readonly CommandEntry[]
  notes: readonly NoteSummaryView[]
  folders: readonly FolderView[]
  remoteResults: readonly SearchResultView[]
}): SearchEverythingEntry[] {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length === 0) return []

  const folderEntries = options.folders.flatMap((folder) => {
    const score = Math.max(
      scoreContainsMatch(folder.relativePath, trimmedQuery, 1.15),
      scoreContainsMatch(folder.name, trimmedQuery, 1),
    )
    if (score === 0) return []
    return [{
      kind: "folder" as const,
      id: `folder:${folder.relativePath}`,
      score,
      label: folder.name,
      detail: folder.relativePath,
      folder,
      previewLines: buildFolderPreviewLines(folder.relativePath, options.folders, options.notes),
    }]
  })

  const noteEntries = options.notes.flatMap((note) => {
    const matches = collectContainsFieldMatches(trimmedQuery, [
      { field: "title", value: note.title, weight: 1.4 },
      { field: "path", value: note.relativePath, weight: 1.15 },
      { field: "filename", value: filenameFromRelativePath(note.relativePath), weight: 1.1 },
      { field: "description", value: note.description, weight: 1 },
      { field: "key", value: note.key, weight: 0.8 },
    ])
    const score = Math.max(...matches.map((match) => match.score), 0)
    if (score === 0) return []
    return [{
      kind: "note" as const,
      id: `note:${note.key}`,
      score,
      label: note.title,
      detail: note.relativePath,
      note,
    }]
  })

  const contentEntries = options.remoteResults.flatMap((result) => {
    if ((result.source ?? "content") !== "content") return []
    return [{
      kind: "content" as const,
      id: `content:${result.key}:${result.source}`,
      score: result.score ?? scoreContainsMatch(result.match ?? result.title, trimmedQuery),
      label: result.title,
      detail: `content — ${result.relativePath}`,
      result,
    }]
  })

  const commandEntries = options.commands.flatMap((command) => {
    const score = Math.max(
      scoreContainsMatch(command.label, trimmedQuery, 1.2),
      scoreContainsMatch(command.shortcut ?? "", trimmedQuery, 0.8),
    )
    if (score === 0) return []
    return [{
      kind: "command" as const,
      id: `command:${command.id}`,
      score,
      label: command.label,
      detail: command.shortcut ?? "Run command",
      command,
    }]
  })

  return [...folderEntries, ...noteEntries, ...contentEntries, ...commandEntries].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    const kindOrder = kindPriority(left.kind) - kindPriority(right.kind)
    if (kindOrder !== 0) return kindOrder
    return left.label.localeCompare(right.label)
  })
}

export function buildSearchEverythingPreview(entry: SearchEverythingEntry | null | undefined, loadedNote?: NoteDetailView | null): SearchEverythingPreviewModel | null {
  if (!entry) return null

  if (entry.kind === "command") {
    return {
      title: entry.command.label,
      subtitle: entry.command.shortcut ?? "",
      lines: [entry.command.disabled ? "Currently unavailable." : "Run this command from Search Everything."],
    }
  }

  if (entry.kind === "folder") {
    return {
      title: entry.folder.relativePath,
      subtitle: `${entry.folder.noteCount} note${entry.folder.noteCount === 1 ? "" : "s"}`,
      lines: entry.previewLines.length > 0 ? entry.previewLines : ["No immediate children yet."],
    }
  }

  if (entry.kind === "content") {
    return {
      title: entry.result.relativePath,
      subtitle: entry.detail,
      lines: entry.result.match ? [entry.result.match] : [entry.result.description || entry.result.relativePath],
    }
  }

  const note = loadedNote ?? null
  const lines = note
    ? note.body.split(/\r?\n/u).filter((line, index, source) => !(index === source.length - 1 && line.length === 0)).slice(0, 12)
    : [entry.note.description || filenameFromRelativePath(entry.note.relativePath)]

  return {
    title: entry.note.relativePath,
    subtitle: entry.note.description,
    lines: lines.length > 0 ? lines : [entry.note.title],
  }
}

function filenameFromRelativePath(relativePath: string): string {
  return relativePath.split("/").at(-1) ?? relativePath
}

function buildFolderPreviewLines(folderPath: string, folders: readonly FolderView[], notes: readonly NoteSummaryView[]): string[] {
  const folderPrefix = folderPath.endsWith("/") ? folderPath : `${folderPath}/`
  const childFolders = folders
    .filter((folder) => folder.relativePath.startsWith(folderPrefix))
    .map((folder) => folder.relativePath.slice(folderPrefix.length))
    .filter((value) => value.length > 0 && !value.includes("/"))
    .sort((left, right) => left.localeCompare(right))

  const childFiles = notes
    .filter((note) => note.relativePath.startsWith(folderPrefix))
    .map((note) => note.relativePath.slice(folderPrefix.length))
    .filter((value) => value.length > 0 && !value.includes("/"))
    .sort((left, right) => left.localeCompare(right))

  return [...childFolders, ...childFiles].slice(0, 8)
}

function kindPriority(kind: SearchEverythingEntry["kind"]): number {
  switch (kind) {
    case "folder": return 0
    case "note": return 1
    case "content": return 2
    case "command": return 3
  }
}
