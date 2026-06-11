import { useEffect, useMemo, useState } from "react"

import type { FolderView, NoteDetailView, NoteSummaryView, SearchResultView } from "../../shared/types"
import type { CommandEntry } from "../app/commands"
import { buildSearchEverythingEntries, buildSearchEverythingPreview, type SearchEverythingEntry } from "../app/searchEverything"
import { ActionDialog } from "./ActionDialog"

type PaletteNote = NoteSummaryView | SearchResultView

const PALETTE_SHORTCUT_HINTS = ["↑↓ move", "Enter open", "Esc close"]
const PALETTE_SAMPLE_SEARCHES = ["alpha.md", "projects", "rename", "Ctrl+S"]

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
    if (!open) return
    setQuery("")
    setIndex(0)
    setRemoteNotes([])
    setPreviewNotes({})
  }, [open])

  useEffect(() => {
    if (!open || !onSearchNotes || query.trim().length === 0) {
      setRemoteNotes([])
      return
    }

    let cancelled = false
    void onSearchNotes(query)
      .then((results) => {
        if (cancelled) return
        setRemoteNotes(results)
        setIndex(0)
      })
      .catch(() => {
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
    if (!selectedEntry || selectedEntry.kind !== "note" || !onLoadNotePreview || previewNotes[selectedEntry.note.key]) return

    let cancelled = false
    void onLoadNotePreview(selectedEntry.note.key)
      .then((note) => {
        if (!cancelled) setPreviewNotes((current) => ({ ...current, [note.key]: note }))
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [onLoadNotePreview, previewNotes, selectedEntry])

  const preview = buildSearchEverythingPreview(
    selectedEntry,
    selectedEntry?.kind === "note" ? (previewNotes[selectedEntry.note.key] ?? null) : null,
  )
  const trimmedQuery = query.trim()
  const showStarterState = trimmedQuery.length === 0
  const showNoResultsState = trimmedQuery.length > 0 && entries.length === 0

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
    <ActionDialog open={open} title="Search and commands" onClose={onClose} className="command-palette-shell">
      <div className="action-form command-palette-form">
        <div className="command-palette-searchbar">
          <div className="command-palette-searchbar__header">
            <div className="command-palette-searchbar__intro">
              <span className="note-command-surface__eyebrow">Search Everything</span>
              <p>Jump to notes, folders, commands, or content from one compact surface.</p>
            </div>
            <div className="command-palette-shortcuts" aria-label="Command palette shortcuts">
              {PALETTE_SHORTCUT_HINTS.map((hint) => <span key={hint} className="command-palette-shortcut">{hint}</span>)}
            </div>
          </div>
          <label className="sr-only" htmlFor="search-everything-input">Search Everything</label>
          <input
            id="search-everything-input"
            autoFocus
            aria-label="Search Everything"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") setIndex((value) => Math.min(value + 1, Math.max(entries.length - 1, 0)))
              if (event.key === "ArrowUp") setIndex((value) => Math.max(value - 1, 0))
              if (event.key === "Enter") activate()
            }}
            placeholder="Search notes, folders, commands, descriptions"
          />
        </div>
        <div className="palette-layout">
          <div className="palette-results-shell">
            <div className="palette-section-label">{entries.length > 0 ? `Results · ${entries.length}` : "Results"}</div>
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
              {showStarterState ? (
                <div className="palette-empty-state" aria-live="polite">
                  <strong>Start typing to search everything</strong>
                  <p>Search titles, paths, folder names, command labels, and server-backed content matches from one place.</p>
                  <div className="palette-empty-state__chips" aria-label="Sample searches">
                    {PALETTE_SAMPLE_SEARCHES.map((sample) => <span key={sample} className="palette-empty-state__chip">{sample}</span>)}
                  </div>
                </div>
              ) : null}
              {showNoResultsState ? (
                <div className="palette-empty-state" aria-live="polite">
                  <strong>No results for “{trimmedQuery}”</strong>
                  <p>Try a note title, file path, folder name, command label, or shortcut.</p>
                </div>
              ) : null}
            </div>
          </div>
          <aside className="palette-preview" aria-label="Selected search preview">
            <div className="palette-section-label">Preview</div>
            {preview ? (
              <>
                <strong>{preview.title}</strong>
                {preview.subtitle ? <p className="row-path">{preview.subtitle}</p> : null}
                <div className="palette-preview-body">
                  {preview.lines.map((line, lineIndex) => <p key={`${preview.title}-${lineIndex}`}>{line}</p>)}
                </div>
              </>
            ) : (
              <div className="palette-preview-empty-state">
                <strong>{showStarterState ? "Preview the selected result" : "Nothing selected yet"}</strong>
                <p>
                  {showStarterState
                    ? "Use the examples on the left, then move with the arrow keys to inspect a result before opening it."
                    : "When a match appears, its note body, folder contents, or command details will show here."}
                </p>
                <div className="palette-preview-empty-state__list" aria-label="Search tips">
                  <span>Notes show markdown context.</span>
                  <span>Folders show child items.</span>
                  <span>Commands show shortcuts.</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </ActionDialog>
  )
}
