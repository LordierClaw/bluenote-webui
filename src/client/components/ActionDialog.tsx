import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from "react"

export function ActionDialog({
  open,
  title,
  children,
  onClose,
  busy = false,
  className,
  ariaLabel,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
  className?: string
  ariaLabel?: string
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const focusFrameRef = useRef<number | null>(null)
  const restoreTimeoutRef = useRef<number | null>(null)
  const wasOpenRef = useRef(false)

  if (open && !wasOpenRef.current && restoreFocusRef.current === null) {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }

  useEffect(() => {
    if (open) {
      if (restoreTimeoutRef.current !== null) {
        window.clearTimeout(restoreTimeoutRef.current)
        restoreTimeoutRef.current = null
      }
      focusFrameRef.current = window.requestAnimationFrame(() => {
        const dialog = dialogRef.current
        if (!dialog) return
        const activeElement = document.activeElement
        if (activeElement instanceof HTMLElement && dialog.contains(activeElement) && activeElement !== dialog) return
        dialog.focus()
      })
      wasOpenRef.current = true
      return () => {
        if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current)
        focusFrameRef.current = null
      }
    }

    if (wasOpenRef.current) {
      const restoreTarget = restoreFocusRef.current
      restoreTimeoutRef.current = window.setTimeout(() => {
        restoreTarget?.focus()
        restoreTimeoutRef.current = null
      }, 0)
      restoreFocusRef.current = null
    }
    wasOpenRef.current = false
    return () => {
      if (restoreTimeoutRef.current !== null) {
        window.clearTimeout(restoreTimeoutRef.current)
        restoreTimeoutRef.current = null
      }
    }
  }, [open])

  const requestClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) requestClose()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [busy, open, requestClose])

  if (!open) return null

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (!busy && event.currentTarget === event.target) requestClose()
  }

  return (
    <div className="action-backdrop" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className={`action-box${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="action-box-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="action-box-close"
            aria-label={`Close ${ariaLabel || title}`}
            onClick={() => requestClose()}
            disabled={busy}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <div className="action-box-body">{children}</div>
      </div>
    </div>
  )
}
