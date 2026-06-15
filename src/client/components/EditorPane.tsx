import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
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
  // Preview toggle
  previewVisible?: boolean
  onTogglePreview?: () => void
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

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return target.isContentEditable || tag === "input" || tag === "select" || tag === "textarea"
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
  const underlayRef = useRef<HTMLDivElement | null>(null)
  const bodyId = useId()
  const [wrapEnabled, setWrapEnabled] = useState(true)
  const [cursor, setCursor] = useState<CursorState>(() => measureCursor(body, 0))

  // Find & Replace State
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [replaceQuery, setReplaceQuery] = useState("")
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const findInputRef = useRef<HTMLInputElement | null>(null)

  const matches = useMemo(() => {
    if (!findQuery) return []
    const q = findQuery.toLowerCase()
    const b = body.toLowerCase()
    const results: { start: number; end: number }[] = []
    let idx = b.indexOf(q)
    while (idx !== -1) {
      results.push({ start: idx, end: idx + q.length })
      idx = b.indexOf(q, idx + q.length)
    }
    return results
  }, [body, findQuery])

  const jumpToMatch = useCallback((index: number) => {
    if (matches.length === 0) return
    const safeIndex = Math.min(Math.max(index, 0), matches.length - 1)
    setCurrentMatchIndex(safeIndex)
    const match = matches[safeIndex]
    const ta = textareaRef.current
    if (ta) {
      ta.setSelectionRange(match.start, match.end)
      setCursor(measureCursor(body, match.start, match.end - match.start))
    }
  }, [body, matches])

  const nextMatch = useCallback(() => {
    jumpToMatch((currentMatchIndex + 1) % matches.length)
  }, [currentMatchIndex, jumpToMatch, matches.length])

  const prevMatch = useCallback(() => {
    jumpToMatch((currentMatchIndex - 1 + matches.length) % matches.length)
  }, [currentMatchIndex, jumpToMatch, matches.length])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!note) return
      // Ctrl+F or Cmd+F
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        if (isEditableElement(e.target) && e.target !== textareaRef.current) return
        e.preventDefault()
        setShowFindReplace(true)
        setTimeout(() => {
          if (findInputRef.current) {
            findInputRef.current.focus()
            findInputRef.current.select()
          }
        }, 0)
        return
      }
      
      // F3 or Ctrl+G / Cmd+G for Find Next/Prev
      const isG = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g"
      const isF3 = e.key === "F3"
      if ((isG || isF3) && showFindReplace) {
        e.preventDefault()
        if (e.shiftKey) {
          prevMatch()
        } else {
          nextMatch()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [note, showFindReplace, nextMatch, prevMatch])

  // Scroll to active match when it changes
  useEffect(() => {
    if (showFindReplace && matches.length > 0) {
      // Use setTimeout to ensure DOM has updated with the .is-active class
      const timer = setTimeout(() => {
        const activeMark = underlayRef.current?.querySelector('.search-match.is-active') as HTMLElement
        const ta = textareaRef.current
        if (activeMark && ta) {
          const markTop = activeMark.offsetTop
          const markBottom = markTop + activeMark.offsetHeight
          
          const taTop = ta.scrollTop
          const taHeight = ta.clientHeight
          const padding = 40 // keep it somewhat centered
          
          if (markTop < taTop + padding) {
            ta.scrollTop = Math.max(0, markTop - padding)
          } else if (markBottom > taTop + taHeight - padding) {
            ta.scrollTop = markBottom - taHeight + padding
          }
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [currentMatchIndex, matches, showFindReplace])


  function replaceMatch() {
    if (matches.length === 0) return
    const safeIndex = Math.min(Math.max(currentMatchIndex, 0), matches.length - 1)
    const match = matches[safeIndex]
    const newBody = body.substring(0, match.start) + replaceQuery + body.substring(match.end)
    onBodyChange(newBody)
    // Focus textarea to show the replacement effect
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function replaceAllMatches() {
    if (matches.length === 0) return
    const escapedQuery = findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const newBody = body.replace(new RegExp(escapedQuery, "gi"), replaceQuery)
    onBodyChange(newBody)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (underlayRef.current) {
      underlayRef.current.scrollTop = e.currentTarget.scrollTop
      underlayRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  // Generate the highlighted underlay elements
  const underlayNodes = useMemo(() => {
    if (!showFindReplace || matches.length === 0) {
      return body
    }
    const nodes: React.ReactNode[] = []
    let lastIndex = 0
    matches.forEach((match, i) => {
      if (match.start > lastIndex) {
        nodes.push(body.substring(lastIndex, match.start))
      }
      nodes.push(
        <mark key={i} className={`search-match ${i === currentMatchIndex ? "is-active" : ""}`}>
          {body.substring(match.start, match.end)}
        </mark>
      )
      lastIndex = match.end
    })
    if (lastIndex < body.length) {
      nodes.push(body.substring(lastIndex))
    }
    return nodes
  }, [body, matches, currentMatchIndex, showFindReplace])

  const updatedAt = formatTimestamp(note?.updatedAt ?? note?.createdAt)
  const lineCount = useMemo(() => (body.length ? body.split("\n").length : 1), [body])
  const compactStatus = compactStatusLabel(dirty, saveState)
  const noteKind = note?.folder === "draft" ? "Draft" : note ? "Note" : "Workspace"
  const statusLabel = dirty ? "Unsaved changes" : saveState
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
        {/* Note title */}
        <h1 className="editor-title-h1" aria-label={note?.title ?? "No note selected"}>
          <input
            className="editor-title-input"
            type="text"
            readOnly
            value={note?.title ?? ""}
            placeholder="No note selected"
            aria-label="Document heading"
          />
        </h1>

        {note?.relativePath ? (
          <span className="sr-only">{note.relativePath}</span>
        ) : null}

        {/* Timestamp */}
        {updatedAt ? (
          <span className="editor-timestamp" aria-label={`Last updated ${updatedAt}`}>
            Updated {updatedAt}
          </span>
        ) : null}
      </header>

      {/* ── Find and Replace Bar ── */}
      {showFindReplace && note ? (
        <div className="editor-find-replace">
          <div className="editor-find-replace-row">
            <span className="material-symbols-outlined icon-sm">search</span>
            <input
              ref={findInputRef}
              type="text"
              placeholder="Find..."
              value={findQuery}
              onChange={(e) => {
                setFindQuery(e.target.value)
                setCurrentMatchIndex(0)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (e.shiftKey) prevMatch()
                  else nextMatch()
                }
                if (e.key === "Escape") {
                  setShowFindReplace(false)
                  textareaRef.current?.focus()
                }
              }}
              className="find-replace-input"
            />
            <span className="find-replace-count">
              {matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : "No results"}
            </span>
            <div className="find-replace-actions">
              <button className="editor-header-icon-btn" onClick={prevMatch} title="Previous (Shift+Enter)">
                <span className="material-symbols-outlined icon-sm">keyboard_arrow_up</span>
              </button>
              <button className="editor-header-icon-btn" onClick={nextMatch} title="Next (Enter)">
                <span className="material-symbols-outlined icon-sm">keyboard_arrow_down</span>
              </button>
              <button className="editor-header-icon-btn close-btn" onClick={() => setShowFindReplace(false)} title="Close (Escape)">
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>
          </div>
          <div className="editor-find-replace-row">
            <span className="material-symbols-outlined icon-sm">find_replace</span>
            <input
              type="text"
              placeholder="Replace..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  replaceMatch()
                }
              }}
              className="find-replace-input"
            />
            <div className="find-replace-actions">
              <button className="find-replace-btn" onClick={replaceMatch} disabled={matches.length === 0}>Replace</button>
              <button className="find-replace-btn" onClick={replaceAllMatches} disabled={matches.length === 0}>Replace All</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Editor Body ── */}
      <div className="editor-body-shell">
        <label className="sr-only" htmlFor={bodyId}>Note body</label>
        
        {/* Underlay for search highlights */}
        <div 
          ref={underlayRef}
          className={`editor-underlay${wrapEnabled ? "" : " is-unwrapped"}`} 
          aria-hidden="true"
        >
          {underlayNodes}
          {/* Append a space to ensure trailing newlines render correctly in the underlay */}
          {" "}
        </div>

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
          onScroll={handleScroll}
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
        <div className="editor-status-bar__tokens">
          <span className="editor-status-token">{noteKind}</span>
          <span className="editor-status-token">{statusLabel}</span>
          <span className="editor-status-token">Lines {lineCount}</span>
          <span className="editor-status-token">Ln {cursor.line}, Col {cursor.column}</span>
          <span className="editor-status-token">Words: {wordCount}</span>
          {cursor.selectionLength > 0 ? (
            <span className="editor-status-token">Sel {cursor.selectionLength}</span>
          ) : null}
        </div>

        <div className="editor-status-bar__actions">
          <button
            type="button"
            className="editor-status-action"
            onClick={() => setWrapEnabled((v) => !v)}
            aria-pressed={wrapEnabled}
          >
            Wrap {wrapEnabled ? "On" : "Off"}
          </button>
          <span className="editor-status-sep" aria-hidden="true" />
          <button
            type="button"
            className="editor-status-action"
            onClick={onSave}
            disabled={!note || !dirty}
            aria-label="Save (Ctrl+S)"
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
