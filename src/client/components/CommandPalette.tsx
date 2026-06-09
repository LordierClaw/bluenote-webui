import { useEffect, useMemo, useState } from "react"
import type { CommandEntry } from "../app/commands"
import type { NoteSummaryView, SearchResultView } from "../../shared/types"

type PaletteNote = NoteSummaryView | SearchResultView

export function CommandPalette({
  open,
  commands,
  notes,
  onClose,
  onSelectNote,
  onSearchNotes,
}: {
  open: boolean
  commands: CommandEntry[]
  notes: PaletteNote[]
  onClose: () => void
  onSelectNote: (id: string) => void
  onSearchNotes?: (query: string) => Promise<PaletteNote[]>
}) {
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState(0)
  const [remoteNotes, setRemoteNotes] = useState<PaletteNote[]>([])

  useEffect(() => {
    if (open) {
      setQuery("")
      setIndex(0)
      setRemoteNotes([])
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

  const entries = useMemo(() => {
    const normalized = query.toLowerCase()
    const sourceNotes = query.trim().length > 0 && onSearchNotes ? remoteNotes : notes
    return [
      ...commands.filter((command) => command.label.toLowerCase().includes(normalized)).map((command) => ({ kind: "command" as const, command })),
      ...sourceNotes.filter((note) => `${note.title} ${note.relativePath} ${note.description}`.toLowerCase().includes(normalized)).map((note) => ({ kind: "note" as const, note })),
    ]
  }, [commands, notes, onSearchNotes, query, remoteNotes])

  if (!open) return null

  function activate(entryIndex = index) {
    const entry = entries[entryIndex]
    if (!entry) return
    if (entry.kind === "command") {
      if (!entry.command.disabled) void entry.command.run()
    } else {
      onSelectNote(entry.note.key)
    }
    onClose()
  }

  return (
    <div className="palette-backdrop" role="dialog" aria-modal="true">
      <div className="palette">
        <input autoFocus aria-label="Search Everything" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Escape") onClose()
          if (event.key === "ArrowDown") setIndex((value) => Math.min(value + 1, Math.max(entries.length - 1, 0)))
          if (event.key === "ArrowUp") setIndex((value) => Math.max(value - 1, 0))
          if (event.key === "Enter") activate()
        }} placeholder="Search notes or run a command" />
        <div className="palette-results">
          {entries.map((entry, itemIndex) => (
            <button key={entry.kind === "command" ? entry.command.id : entry.note.relativePath} className={itemIndex === index ? "selected" : ""} disabled={entry.kind === "command" && entry.command.disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { setIndex(itemIndex); activate(itemIndex) }}>
              {entry.kind === "command" ? entry.command.label : entry.note.title}
              <span>{entry.kind === "command" ? entry.command.shortcut : entry.note.relativePath}</span>
            </button>
          ))}
          {entries.length === 0 ? <p className="empty">No commands or notes found.</p> : null}
        </div>
      </div>
    </div>
  )
}
