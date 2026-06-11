import type { ReactNode } from "react"

type UtilityPaneProps = {
  preview: ReactNode
  details?: ReactNode
  footer?: ReactNode
}

export function UtilityPane({ preview, details, footer }: UtilityPaneProps) {
  return (
    <aside className="utility-pane" aria-label="Markdown preview pane">
      <div className="utility-pane__body">{preview}</div>
      {details ? <div className="utility-pane__details">{details}</div> : null}
      {footer ? <div className="utility-pane__footer">{footer}</div> : null}
    </aside>
  )
}
