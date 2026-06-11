import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons"
import type { NoteDetailView } from "../../shared/types"
import { MarkdownPreview } from "./MarkdownPreview"

type PreviewPaneProps = {
  note?: NoteDetailView | null
  visible?: boolean
  onToggle?: () => void
}

export function PreviewPane({ note, visible = true, onToggle }: PreviewPaneProps) {
  if (!visible) {
    return onToggle ? (
      <aside className="preview-pane preview-pane--collapsed">
        <button type="button" className="preview-pane__toggle preview-pane__toggle--collapsed" onClick={onToggle}>
          <FontAwesomeIcon icon={faEye} aria-hidden="true" />
          <span>Show preview</span>
        </button>
      </aside>
    ) : null
  }

  return (
    <aside className="preview-pane" aria-label="Markdown preview pane">
      <div className="pane-header preview-pane-header">
        <strong>Preview</strong>
        {onToggle ? (
          <button type="button" className="preview-pane__toggle" onClick={onToggle}>
            <FontAwesomeIcon icon={faEyeSlash} aria-hidden="true" />
            <span>Hide preview</span>
          </button>
        ) : null}
      </div>
      {note ? (
        <div className="preview-pane__body">
          <article className="preview-pane__article">
            <header className="preview-pane__context">
              <p className="preview-pane__context-path">{note.relativePath}</p>
            </header>
            <MarkdownPreview body={note.body} />
          </article>
        </div>
      ) : (
        <div className="preview-pane__empty-state">
          <p className="empty">Select a note to preview its markdown output.</p>
        </div>
      )}
    </aside>
  )
}
