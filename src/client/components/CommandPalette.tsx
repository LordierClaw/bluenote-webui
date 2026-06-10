import { useEffect, useMemo, useState } from "react"

import type { FolderView, NoteDetailView, NoteSummaryView, SearchResultView } from "../../shared/types"
import type { CommandEntry } from "../app/commands"
import { buildSearchEverythingEntries, buildSearchEverythingPreview, type SearchEverythingEntry } from "../app/searchEverything"
import { ActionDialog } from "./ActionDialog"

type PaletteNote = NoteSummaryView | SearchResultView

export function CommandPalette({
  open,
  commands,
  notes,
  folders = [],
  onClose,
  onSelectNote,
  onSelectFolder,
  onSearchNotes,
  onLoadNotePreview,
}: {
  open: boolean
  commands: CommandEntry[]
  notes: PaletteNote[]
  folders?: FolderView[]
  onClose: () => void
  onSelectNote: (id: string) => void
  onSelectFolder?: (relativePath: string) => void
  onSearchNotes?: (query: string) => Promise<SearchResultView[]>
  onLoadNotePreview?: (id: string) => Promise<NoteDetailView>
}) {
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState(0)
  const [remoteNotes, setRemoteNotes] = useState<SearchResultView[]>([])
  const [previewNotes, setPreviewNotes] = useState<Record<string, NoteDetailView>>({})

  useEffect(() => {
    if (open) {
      setQuery("")
      setIndex(0)
      setRemoteNotes([])
      setPreviewNotes({})
    }
  }, [open])

  useEffect(() => {
    if (!open || !onSearchNotes || query.trim().length === 0) {
      setRemoteNotes([])
      return
    }

    let cancelled = false
    void onSearchNotes(query).then((results) => {
      if (!cancelled) {
        setRemoteNotes(results)
        setIndex(0)
      }
    }).catch(() => {
      if (!cancelled) setRemoteNotes([])
    })

    return () => {
      cancelled = true
    }
  }, [onSearchNotes, open, query])

  const entries = useMemo(() => buildSearchEverythingEntries(query, {
    commands,
    notes,
    folders,
    remoteResults: remoteNotes,
  }), [commands, folders, notes, query, remoteNotes])

  const selectedEntry = entries[index] ?? null

  useEffect(() => {
    if (!selectedEntry || selectedEntry.kind !== "note" || !onLoadNotePreview || previewNotes[selectedEntry.note.key]) {
      return
    }

    let cancelled = false
    void onLoadNotePreview(selectedEntry.note.key).then((note) => {
      if (!cancelled) {
        setPreviewNotes((current) => ({ ...current, [note.key]: note }))
      }
    }).catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [onLoadNotePreview, previewNotes, selectedEntry])

  const preview = buildSearchEverythingPreview(
    selectedEntry,
    selectedEntry?.kind === "note" ? (previewNotes[selectedEntry.note.key] ?? null) : null,
  )

  if (!open) return null

  function activate(entry: SearchEverythingEntry | null = selectedEntry) {
    if (!entry) return
    if (entry.kind === "command") {
      if (!entry.command.disabled) void entry.command.run()
      onClose()
      return
    }
    if (entry.kind === "folder") {
      onSelectFolder?.(entry.folder.relativePath)
      onClose()
      return
    }
    if (entry.kind === "content") {
      onSelectNote(entry.result.key)
      onClose()
      return
    }
    onSelectNote(entry.note.key)
    onClose()
  }

  return (
    <ActionDialog open={open} title="Search and commands" onClose={onClose}>
      <div className="action-form command-palette-form">
        <input autoFocus aria-label="Search Everything" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === "ArrowDown") setIndex((value) => Math.min(value + 1, Math.max(entries.length - 1, 0)))
          if (event.key === "ArrowUp") setIndex((value) => Math.max(value - 1, 0))
          if (event.key === "Enter") activate()
        }} placeholder="Search notes, folders, or commands" />
        <div className="palette-layout">
          <div className="palette-results" role="listbox" aria-label="Search results">
            {entries.map((entry, itemIndex) => (
              <button
                key={entry.id}
                className={itemIndex === index ? "selected palette-result-item" : "palette-result-item"}
                disabled={entry.kind === "command" && entry.command.disabled}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setIndex(itemIndex)}
                onClick={() => {
                  setIndex(itemIndex)
                  activate(entry)
                }}
              >
                <div>
                  <strong>{entry.label}</strong>
                  <span>{entry.detail}</span>
                </div>
                <small>{entry.kind}</small>
              </button>
            ))}
            {entries.length === 0 ? <p className="empty">Search notes, folders, content, or commands.</p> : null}
          </div>
          <aside className="palette-preview" aria-label="Selected search preview">
            {preview ? (
              <>
                <strong>{preview.title}</strong>
                {preview.subtitle ? <p className="row-path">{preview.subtitle}</p> : null}
                <div className="palette-preview-body">
                  {preview.lines.map((line, lineIndex) => <p key={`${preview.title}-${lineIndex}`}>{line}</p>)}
                </div>
              </>
            ) : (
              <p className="empty">Select a result to preview it.</p>
            )}
          </aside>
        </div>
      </div>
    </ActionDialog>
  )
}
