import type { NoteDetailView } from "../../shared/types"
import { ShellActionBar } from "./ShellActionBar"

type EditorPaneProps = {
  note?: NoteDetailView | null
  body: string
  dirty: boolean
  saveState: string
  onBodyChange: (body: string) => void
  onSave: () => void
  onPromote: () => void
  onNewNote?: () => void
  onNewFolder?: () => void
  onRename?: () => void
  onMove?: () => void
  onSearch?: () => void
}

export function EditorPane({
  note,
  body,
  dirty,
  saveState,
  onBodyChange,
  onSave,
  onPromote,
  onNewNote,
  onNewFolder,
  onRename,
  onMove,
  onSearch,
}: EditorPaneProps) {
  return (
    <section className="editor-pane">
      <div className="pane-header editor-pane-header">
        <div>
          <strong>{note?.title ?? "No note selected"}</strong>
          {dirty ? <span className="dirty"> Unsaved</span> : null}
        </div>
        <div className="button-row compact">
          <span className="muted">{saveState}</span>
        </div>
      </div>
      <ShellActionBar
        canMutate={Boolean(note)}
        canPromoteDraft={Boolean(note && note.folder === "draft")}
        onNewNote={onNewNote ?? (() => undefined)}
        onNewFolder={onNewFolder ?? (() => undefined)}
        onRename={onRename ?? (() => undefined)}
        onMove={onMove ?? (() => undefined)}
        onSearch={onSearch ?? (() => undefined)}
        onSave={onSave}
        onPromote={onPromote}
      />
      <textarea aria-label="Note body" disabled={!note} value={body} onChange={(event) => onBodyChange(event.target.value)} placeholder="Open or create a note to start writing." />
    </section>
  )
}
