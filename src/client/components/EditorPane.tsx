import { useId, useMemo, useRef, useState } from "react"
import type { NoteDetailView } from "../../shared/types"

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

type CursorState = {
  line: number
  column: number
  selectionLength: number
}

function formatTimestamp(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function measureCursor(text: string, offset: number, selectionLength = 0): CursorState {
  const safeOffset = Math.max(0, Math.min(offset, text.length))
  const beforeCursor = text.slice(0, safeOffset)
  const lines = beforeCursor.split("\n")
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
    selectionLength,
  }
}

function compactStatusLabel(dirty: boolean, saveState: string): string {
  if (dirty) return "Unsaved"
  return saveState === "Loaded" ? "Saved" : saveState
}

export function EditorPane({
  note,
  body,
  dirty,
  saveState,
  onBodyChange,
  onSave,
}: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const bodyId = useId()
  const [wrapEnabled, setWrapEnabled] = useState(true)
  const [cursor, setCursor] = useState<CursorState>(() => measureCursor(body, 0))

  const updatedAt = formatTimestamp(note?.updatedAt ?? note?.createdAt)
  const lineCount = useMemo(() => (body.length ? body.split("\n").length : 1), [body])
  const compactStatus = compactStatusLabel(dirty, saveState)
  const wordCount = useMemo(() => {
    const trimmed = body.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }, [body])

  function syncCursorFromTextarea() {
    const element = textareaRef.current
    if (!element) return
    setCursor(measureCursor(body, element.selectionStart, Math.max(0, element.selectionEnd - element.selectionStart)))
  }

  return (
    <section className="editor-pane" aria-label="Editor">
      {/* ── Editor Header ── */}
      <header className="editor-header">
        {/* Title – matches Stitch "Deep Work Session" editable header */}
        <input
          className="editor-title-input"
          type="text"
          readOnly
          value={note?.title ?? ""}
          placeholder="No note selected"
          aria-label="Note title"
        />
        {/* Timestamp right-aligned */}
        {updatedAt ? (
          <span className="editor-timestamp" aria-label={`Last updated ${updatedAt}`}>
            Updated {updatedAt}
          </span>
        ) : null}
      </header>

      {/* ── Editor Body ── */}
      <div className="editor-body-shell">
        <label className="sr-only" htmlFor={bodyId}>Note body</label>
        <textarea
          id={bodyId}
          ref={textareaRef}
          className={`editor-textarea${wrapEnabled ? "" : " is-unwrapped"}`}
          aria-label="Note body"
          aria-describedby={`${bodyId}-status`}
          disabled={!note}
          value={body}
          wrap={wrapEnabled ? "soft" : "off"}
          spellCheck={false}
          onChange={(event) => {
            onBodyChange(event.target.value)
            setCursor(measureCursor(event.target.value, event.target.selectionStart, Math.max(0, event.target.selectionEnd - event.target.selectionStart)))
          }}
          onClick={syncCursorFromTextarea}
          onFocus={syncCursorFromTextarea}
          onKeyUp={syncCursorFromTextarea}
          onSelect={syncCursorFromTextarea}
          placeholder="Open or create a note to start writing."
        />
      </div>

      {/* ── Status Bar Footer ── */}
      <footer
        className="editor-status-bar"
        id={`${bodyId}-status`}
        aria-label="Editor status bar"
      >
        {/* Left: position + line count + word count */}
        <div className="editor-status-bar__tokens">
          <span className="editor-status-token">Ln {cursor.line}, Col {cursor.column}</span>
          <span className="editor-status-token">Words: {wordCount}</span>
          {cursor.selectionLength > 0 ? (
            <span className="editor-status-token">Sel {cursor.selectionLength}</span>
          ) : null}
        </div>

        {/* Right: controls */}
        <div className="editor-status-bar__actions">
          <button
            type="button"
            className="editor-status-action"
            onClick={() => setWrapEnabled((v) => !v)}
            aria-label={wrapEnabled ? "Disable word wrap" : "Enable word wrap"}
            aria-pressed={wrapEnabled}
          >
            Wrap: {wrapEnabled ? "On" : "Off"}
          </button>
          <span className="editor-status-sep" aria-hidden="true" />
          <button
            type="button"
            className="editor-status-action"
            onClick={onSave}
            disabled={!note || !dirty}
            aria-label="Save note (Ctrl+S)"
            title="Save (Ctrl+S)"
          >
            {compactStatus}
          </button>
          <span className="editor-status-sep" aria-hidden="true" />
          <span className="editor-status-token" style={{ padding: "0 10px", color: "var(--on-surface-variant)", opacity: 0.6 }}>
            Lines: {lineCount}
          </span>
        </div>
      </footer>
    </section>
  )
}
