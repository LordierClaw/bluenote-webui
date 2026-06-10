import type { ReactNode } from "react"
import type { AiStatusSummary, WorkspaceStatus } from "../../shared/types"
import type { ResponsivePanesState } from "../app/useResponsivePanes"
import type { ThemePreference } from "../app/useThemePreference"
import { PaneToggleButtons } from "./PaneToggleButtons"

type AppShellWorkspace = Pick<WorkspaceStatus, "initialized" | "rootPath" | "noteCount">
type AppShellAiStatus = AiStatusSummary | { status: string }

type AppShellProps = {
  workspace: AppShellWorkspace
  aiStatus?: AppShellAiStatus | null
  noteCount?: number
  theme: ThemePreference
  panes: ResponsivePanesState
  children: ReactNode
  onToggleTheme: () => void
  onPalette: () => void
  onAi: () => void
}

export function AppShell({ workspace, aiStatus, noteCount, theme, panes, children, onToggleTheme, onPalette, onAi }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>BlueNote</strong>
          <span className="muted"> Web</span>
        </div>
        <div className="topbar-meta">
          <span title={workspace.rootPath}>{workspace.rootPath}</span>
          <span className="pill">{noteCount ?? workspace.noteCount ?? 0} notes</span>
          <button type="button" className="pill ai-pill" onClick={onAi}>AI {aiStatus?.status ?? "unknown"}</button>
          <PaneToggleButtons {...panes} />
          <button className="theme-toggle" type="button" aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"} onClick={onToggleTheme} title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
            {theme === "light" ? "☾" : "☀"}
          </button>
          <button className="primary" onClick={onPalette}>Search <kbd>Ctrl</kbd>+<kbd>P</kbd></button>
        </div>
      </header>
      {children}
    </div>
  )
}
