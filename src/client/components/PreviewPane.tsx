import type { NoteDetailView } from "../../shared/types"

export function PreviewPane({ note, visible, onToggle }: { note?: NoteDetailView | null; visible: boolean; onToggle: () => void }) {
  if (!visible) return <aside className="preview collapsed"><button onClick={onToggle}>Show preview</button></aside>
  return (
    <aside className="preview">
      <div className="pane-header"><strong>Preview</strong><button onClick={onToggle}>Hide</button></div>
      {note ? <article><h2>{note.title}</h2><p className="row-path">{note.relativePath}</p><pre>{note.body || "Empty note"}</pre></article> : <p className="empty">Select a note to preview it.</p>}
    </aside>
  )
}
