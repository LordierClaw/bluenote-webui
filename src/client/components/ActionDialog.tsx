import { useEffect, type MouseEvent, type ReactNode } from "react"

export function ActionDialog({
  open,
  title,
  children,
  onClose,
  busy = false,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}) {
  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [busy, onClose, open])

  if (!open) return null

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (!busy && event.currentTarget === event.target) onClose()
  }

  return (
    <div className="action-backdrop" onClick={onBackdropClick}>
      <div className="action-box" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="action-box-header">
          <h2>{title}</h2>
          <button type="button" aria-label={`Close ${title}`} onClick={() => onClose()} disabled={busy}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
