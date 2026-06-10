import type { NoteDetailView } from "../../shared/types"
import { MarkdownPreview } from "./MarkdownPreview"

type PreviewPaneProps = {
  note?: NoteDetailView | null
  visible?: boolean
  onToggle?: () => void
}

export function PreviewPane({ note, visible = true, onToggle }: PreviewPaneProps) {
  if (!visible) {
    return onToggle ? <aside className="preview collapsed"><button onClick={onToggle}>Show preview</button></aside> : null
  }

  return (
    <section className="preview-pane-content">
      <div className="pane-header preview-pane-header">
        <strong>Preview</strong>
        {onToggle ? <button type="button" onClick={onToggle}>Hide</button> : null}
      </div>
      {note ? (
        <article>
          <h2>{note.title}</h2>
          <p className="row-path">{note.relativePath}</p>
          <MarkdownPreview body={note.body} />
        </article>
      ) : (
        <p className="empty">Select a note to preview it.</p>
      )}
    </section>
  )
}
