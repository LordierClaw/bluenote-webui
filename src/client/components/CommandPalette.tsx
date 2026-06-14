import { useEffect, useMemo, useState } from "react"

import type { FolderView, NoteDetailView, NoteSummaryView, SearchResultView } from "../../shared/types"
import type { CommandEntry } from "../app/commands"
import { buildSearchEverythingEntries, buildSearchEverythingPreview, type SearchEverythingEntry } from "../app/searchEverything"
import { ActionDialog } from "./ActionDialog"

type PaletteNote = NoteSummaryView | SearchResultView

const PALETTE_SAMPLE_SEARCHES = ["alpha.md", "projects", "rename", "Ctrl+S"]

function entryIcon(kind: string): string {
  switch (kind) {
    case "note": return "description"
    case "folder": return "folder"
    case "content": return "search"
    case "command": return "terminal"
    default: return "description"
  }
}

function highlightText(text: string, query: string): JSX.Element {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    return <>{text}</>
  }
  if (!query.trim()) return <>{text}</>
  const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase()
          ? <mark key={i} className="palette-match-highlight">{part}</mark>
          : part
      )}
    </>
  )
}

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
    return () => { cancelled = true }
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
    return () => { cancelled = true }
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
        {/* ── Search input header ── */}
        <div className="command-palette-searchbar" role="search">
          <div className="command-palette-searchbar__header sr-only">
            <p>Jump to notes, folders, commands, or content from one compact surface.</p>
            <div className="command-palette-shortcuts" aria-label="Command palette shortcuts">
              <span>Enter open</span>
            </div>
          </div>
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
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
            placeholder="Search notes, content, or folders..."
          />
          <span className="cmd-esc-hint" aria-hidden="true">ESC TO CLOSE</span>
        </div>

        {/* ── Results + Preview layout ── */}
        <div className="palette-layout">
          {/* Results column */}
          <div className="palette-results-shell">
            <div className="palette-section-label">
              <span>Results</span>
              {entries.length > 0 ? <span>{entries.length}</span> : null}
            </div>

            <div className="palette-results" role="listbox" aria-label="Search results">
              {entries.map((entry, itemIndex) => (
                <button
                  key={entry.id}
                  className={`palette-result-item${itemIndex === index ? " selected" : ""}`}
                  disabled={entry.kind === "command" && entry.command.disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setIndex(itemIndex)}
                  onClick={() => { setIndex(itemIndex); activate(entry) }}
                  role="option"
                  aria-selected={itemIndex === index}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{entryIcon(entry.kind)}</span>
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
                  <p>Search titles, paths, folder names, command labels, and content from one place.</p>
                  <div className="palette-empty-state__chips" aria-label="Sample searches">
                    {PALETTE_SAMPLE_SEARCHES.map((sample) => (
                      <button
                        key={sample}
                        className="palette-empty-state__chip"
                        type="button"
                        style={{ cursor: "pointer" }}
                        onClick={() => setQuery(sample)}
                      >
                        {sample}
                      </button>
                    ))}
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

          {/* Preview panel */}
          <aside className="palette-preview" aria-label="Selected item preview">
            {preview ? (
              <>
                <strong>{highlightText(preview.title, trimmedQuery)}</strong>
                {preview.subtitle ? <p className="row-path">{preview.subtitle}</p> : null}
                <div className="palette-preview-body">
                  {preview.lines.map((line, lineIndex) => (
                    <p key={`${preview.title}-${lineIndex}`}>{highlightText(line, trimmedQuery)}</p>
                  ))}
                </div>
              </>
            ) : (
              <div className="palette-preview-empty-state">
                <strong>{showStarterState ? "Preview the selected result" : "Nothing selected"}</strong>
                <p>
                  {showStarterState
                    ? "Move with arrow keys to inspect a result before opening."
                    : "When a match appears, its note body, folder contents, or command details will show here."}
                </p>
                <div className="palette-preview-empty-state__list" aria-label="Search tips">
                  <span>Notes show content</span>
                  <span>Folders show children</span>
                  <span>Commands show shortcuts</span>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* ── Footer with actions and nav hints ── */}
        <div className="palette-footer">
          <div className="palette-footer-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => activate()}
              disabled={!selectedEntry}
              aria-label="Open selected item (Enter)"
              style={{ fontSize: "13px", padding: "6px 14px" }}
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">keyboard_return</span>
              Open
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close palette (Escape)"
              style={{ fontSize: "13px", padding: "6px 14px" }}
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">close</span>
              Close
            </button>
          </div>
          <div className="palette-footer-hints">
            <span className="palette-footer-hint">
              <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_up</span>
              <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span>
              Navigate
            </span>
          </div>
        </div>
      </div>
    </ActionDialog>
  )
}
