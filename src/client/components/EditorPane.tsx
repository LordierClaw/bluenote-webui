import { useId, useMemo, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faCircle,
  faClockRotateLeft,
  faFileLines,
  faFilePen,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons"
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

function editorKindIcon(note?: NoteDetailView | null) {
  if (!note) return faFolderOpen
  return note.folder === "draft" ? faFilePen : faFileLines
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
}: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const bodyId = useId()
  const [wrapEnabled, setWrapEnabled] = useState(true)
  const [cursor, setCursor] = useState<CursorState>(() => measureCursor(body, 0))

  const noteKind = note?.folder === "draft" ? "Draft" : note ? "Note" : "Workspace"
  const updatedAt = formatTimestamp(note?.updatedAt ?? note?.createdAt)
  const lineCount = useMemo(() => (body.length ? body.split("\n").length : 1), [body])
  const statusLabel = dirty ? "Unsaved changes" : saveState
  const compactStatus = compactStatusLabel(dirty, saveState)

  function syncCursorFromTextarea() {
    const element = textareaRef.current
    if (!element) return
    setCursor(measureCursor(body, element.selectionStart, Math.max(0, element.selectionEnd - element.selectionStart)))
  }

  return (
    <section className="editor-pane" aria-label="Editor">
      <header className="editor-header">
        <div className="editor-header__meta">
          <div className="editor-header__eyebrow">
            <span className="editor-meta-chip editor-meta-chip--kind">
              <FontAwesomeIcon icon={editorKindIcon(note)} aria-hidden="true" />
              <span>{noteKind}</span>
            </span>
            {note ? (
              <span className={`editor-meta-chip editor-meta-chip--status${dirty ? " is-dirty" : ""}`}>
                <FontAwesomeIcon icon={faCircle} aria-hidden="true" />
                <span>{compactStatus}</span>
              </span>
            ) : null}
          </div>
          <h1>{note?.title ?? "No note selected"}</h1>
          <div className="editor-header__meta-line">
            {note ? (
              <>
                <span className="editor-header__path">
                  <FontAwesomeIcon icon={editorKindIcon(note)} aria-hidden="true" />
                  <span>{note.relativePath}</span>
                </span>
                {updatedAt ? (
                  <span className="editor-header__updated">
                    <FontAwesomeIcon icon={faClockRotateLeft} aria-hidden="true" />
                    <span>Updated {updatedAt}</span>
                  </span>
                ) : null}
              </>
            ) : (
              <span className="editor-header__empty">Open or create a note to start writing.</span>
            )}
          </div>
        </div>
      </header>
      <div className="editor-body-shell">
        <label className="sr-only" htmlFor={bodyId}>Note body</label>
        <textarea
          id={bodyId}
          ref={textareaRef}
          className={`editor-textarea${wrapEnabled ? " is-wrapped" : " is-unwrapped"}`}
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
      <footer className="editor-status-bar" id={`${bodyId}-status`} aria-label="Editor status bar">
        <div className="editor-status-bar__tokens">
          <span className="editor-status-token">{noteKind}</span>
          <span className="editor-status-token">{statusLabel}</span>
          <span className="editor-status-token">Lines {lineCount}</span>
          <span className="editor-status-token">Ln {cursor.line}, Col {cursor.column}</span>
          {cursor.selectionLength > 0 ? <span className="editor-status-token">Sel {cursor.selectionLength}</span> : null}
        </div>
        <button type="button" className="editor-status-bar__toggle" onClick={() => setWrapEnabled((value) => !value)}>
          Wrap {wrapEnabled ? "On" : "Off"}
        </button>
      </footer>
    </section>
  )
}
