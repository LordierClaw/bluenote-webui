import type { ReactNode } from "react"
import type { AiStatusSummary, WorkspaceStatus } from "../../shared/types"

export function AppShell({ workspace, aiStatus, children, onPalette }: { workspace: WorkspaceStatus; aiStatus?: AiStatusSummary | null; children: ReactNode; onPalette: () => void }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>BlueNote</strong>
          <span className="muted"> Web UI</span>
        </div>
        <div className="topbar-meta">
          <span>{workspace.rootPath}</span>
          <span className="pill">AI: {aiStatus?.status ?? "unknown"}</span>
          <button onClick={onPalette}>Search Everything <kbd>Ctrl</kbd>+<kbd>P</kbd></button>
        </div>
      </header>
      {children}
    </div>
  )
}
