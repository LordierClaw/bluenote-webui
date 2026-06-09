import type { NoteSummaryView, SearchResultView } from "../../shared/types"

export function NoteList({ notes, selectedKey, query, onQuery, onSelect }: { notes: (NoteSummaryView | SearchResultView)[]; selectedKey?: string; query: string; onQuery: (query: string) => void; onSelect: (id: string) => void }) {
  return (
    <section className="note-list" aria-label="Notes">
      <input className="search-input" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Filter/search notes" />
      <div className="rows">
        {notes.filter((note) => !note.relativePath.startsWith(".data/")).map((note) => (
          <button key={note.relativePath} className={`note-row ${selectedKey === note.key ? "selected" : ""}`} onClick={() => onSelect(note.key)}>
            <span className="row-title">{note.title}</span>
            <span className="row-path">{note.relativePath}</span>
            <span className="row-description">{note.description}</span>
          </button>
        ))}
        {notes.length === 0 ? <p className="empty">No notes yet.</p> : null}
      </div>
    </section>
  )
}
