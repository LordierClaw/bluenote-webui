import type { NoteDetailView } from "../../shared/types"
import { MarkdownPreview } from "./MarkdownPreview"

type PreviewPaneProps = {
  note?: NoteDetailView | null
  visible?: boolean
  onToggle?: () => void
}

function filenameOf(relativePath: string): string {
  return relativePath.split("/").filter(Boolean).at(-1) ?? relativePath
}

export function PreviewPane({ note, visible = true, onToggle }: PreviewPaneProps) {
  if (!visible) {
    return onToggle ? (
      <aside className="preview-pane preview-pane--collapsed" aria-label="Preview pane (collapsed)">
        <button
          type="button"
          className="preview-pane__toggle preview-pane__toggle--collapsed"
          onClick={onToggle}
          aria-label="Show preview pane"
        >
          <span className="material-symbols-outlined icon-sm" aria-hidden="true">visibility</span>
          <span>Preview</span>
        </button>
      </aside>
    ) : null
  }

  const filename = note ? filenameOf(note.relativePath) : null

  return (
    <aside className="preview-pane" aria-label="Markdown preview pane">
      {/* ── Header matching Stitch ── */}
      <header className="preview-pane-header">
        <div className="preview-pane-header-left">
          <span className="preview-pane-title">Preview</span>
          {filename ? (
            <span className="preview-pane-filename" aria-hidden="true">{filename}</span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="preview-pane-readonly" aria-label="Read-only preview">
            <span className="material-symbols-outlined" aria-hidden="true">lock</span>
            Read-only
          </span>
        </div>
      </header>

      {/* ── Body ── */}
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
        <div className="preview-pane__body">
          <div className="preview-pane__empty-state">
            <p className="empty">Select a note to preview its rendered markdown.</p>
          </div>
        </div>
      )}
    </aside>
  )
}
