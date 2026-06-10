import type { ResponsivePanesState } from "../app/useResponsivePanes"

export function PaneToggleButtons({
  managerVisible,
  previewVisible,
  managerAutoHidden,
  previewAutoHidden,
  toggleManager,
  togglePreview,
}: ResponsivePanesState) {
  return (
    <div className="pane-toggle-buttons" aria-label="Pane visibility controls">
      <button
        type="button"
        className={managerVisible ? "active" : ""}
        aria-label={managerVisible ? "Hide manager" : "Show manager"}
        title={managerAutoHidden ? "Manager auto-hidden at this width" : "Toggle manager"}
        onClick={toggleManager}
      >
        {managerVisible ? "Hide manager" : "Show manager"}
      </button>
      <button
        type="button"
        className={previewVisible ? "active" : ""}
        aria-label={previewVisible ? "Hide preview" : "Show preview"}
        title={previewAutoHidden ? "Preview auto-hidden at this width" : "Toggle preview"}
        onClick={togglePreview}
      >
        {previewVisible ? "Hide preview" : "Show preview"}
      </button>
    </div>
  )
}
