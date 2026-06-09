import type { NoteDetailView } from "../../shared/types"

export function EditorPane({ note, body, dirty, saveState, onBodyChange, onSave, onPromote }: { note?: NoteDetailView | null; body: string; dirty: boolean; saveState: string; onBodyChange: (body: string) => void; onSave: () => void; onPromote: () => void }) {
  return (
    <section className="editor-pane">
      <div className="pane-header">
        <div>
          <strong>{note?.title ?? "No note selected"}</strong>
          {dirty ? <span className="dirty"> Unsaved</span> : null}
        </div>
        <div className="button-row compact">
          <span className="muted">{saveState}</span>
          <button disabled={!note || !dirty} onClick={onSave}>Save <kbd>Ctrl</kbd>+<kbd>S</kbd></button>
          <button disabled={!note || note.folder !== "draft"} onClick={onPromote}>Save Draft As</button>
        </div>
      </div>
      <textarea aria-label="Note body" disabled={!note} value={body} onChange={(event) => onBodyChange(event.target.value)} placeholder="Open or create a note to start writing." />
    </section>
  )
}
