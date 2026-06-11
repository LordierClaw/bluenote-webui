import type { ResponsivePanesState } from "../app/useResponsivePanes"

type RestoreTarget = {
  key: "manager" | "preview"
  label: string
  title: string
  autoHidden: boolean
  onClick: () => void
}

export function PaneToggleButtons({
  managerVisible,
  previewVisible,
  managerAutoHidden,
  previewAutoHidden,
  openManager,
  openPreview,
}: ResponsivePanesState) {
  const targets: RestoreTarget[] = []

  if (!managerVisible) {
    targets.push({
      key: "manager",
      label: managerAutoHidden ? "Restore manager" : "Open manager",
      title: managerAutoHidden ? "Manager auto-hidden at this width" : "Open manager",
      autoHidden: managerAutoHidden,
      onClick: openManager,
    })
  }

  if (!previewVisible) {
    targets.push({
      key: "preview",
      label: previewAutoHidden ? "Restore preview" : "Open preview",
      title: previewAutoHidden ? "Preview auto-hidden at this width" : "Open preview",
      autoHidden: previewAutoHidden,
      onClick: openPreview,
    })
  }

  if (targets.length === 0) return null

  return (
    <div className="pane-toggle-buttons" aria-label="Pane restore controls">
      {targets.map((target) => (
        <button
          key={target.key}
          type="button"
          className={`pane-toggle-button${target.autoHidden ? " is-auto-hidden" : ""}`}
          aria-label={target.label}
          title={target.title}
          onClick={target.onClick}
        >
          <span>{target.label}</span>
          {target.autoHidden ? <span className="pane-toggle-button__status">Auto-hidden</span> : null}
        </button>
      ))}
    </div>
  )
}
