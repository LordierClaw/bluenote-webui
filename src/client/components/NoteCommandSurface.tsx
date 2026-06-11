import type { ReactNode } from "react"
import { ActionDialog } from "./ActionDialog"

type NoteCommandSurfaceProps = {
  open: boolean
  title: string
  description: string
  context?: string
  busy?: boolean
  children: ReactNode
  onClose: () => void
}

export function NoteCommandSurface({
  open,
  title,
  description,
  context,
  busy = false,
  children,
  onClose,
}: NoteCommandSurfaceProps) {
  return (
    <ActionDialog open={open} title={title} onClose={onClose} busy={busy} className="note-command-surface-dialog">
      <div className="note-command-surface">
        <div className="note-command-surface__intro">
          <span className="note-command-surface__eyebrow">Command surface</span>
          <p>{description}</p>
          {context ? <div className="note-command-surface__context">{context}</div> : null}
        </div>
        {children}
      </div>
    </ActionDialog>
  )
}
