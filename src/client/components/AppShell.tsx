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

function summarizeAiButton(aiStatus?: AppShellAiStatus | null): string {
  if (!aiStatus) return "Unknown"
  const queue = "queue" in aiStatus ? aiStatus.queue : undefined
  if (queue?.running) return `${queue.running} running`
  if (queue?.pending) return `${queue.pending} queued`
  if (queue?.failed) return `${queue.failed} failed`
  return aiStatus.status
}

function normalizeAiSummary(summary: string): { label: string; tone: "ready" | "idle" | "warning" | "danger" } {
  const normalized = summary.trim().toLowerCase()
  if (!normalized || normalized === "unknown") return { label: "Unknown", tone: "idle" }
  if (normalized === "not-configured") return { label: "Setup", tone: "warning" }
  if (normalized.includes("failed")) return { label: summary, tone: "danger" }
  if (normalized.includes("running")) return { label: summary, tone: "ready" }
  if (normalized.includes("queued")) return { label: summary, tone: "warning" }
  if (normalized.includes("ready") || normalized.includes("configured") || normalized.includes("connected")) {
    return { label: summary, tone: "ready" }
  }
  return { label: summary, tone: "idle" }
}

export function AppShell({ workspace, aiStatus, noteCount, theme, panes, children, onToggleTheme, onPalette, onAi }: AppShellProps) {
  const showWorkspaceViewToolbar = !panes.managerVisible && !panes.previewVisible
  const topbarNeedsRestoreControls = !showWorkspaceViewToolbar && (!panes.managerVisible || !panes.previewVisible)
  const aiSummary = summarizeAiButton(aiStatus)
  const aiDisplay = normalizeAiSummary(aiSummary)
  const workspaceNoteCount = noteCount ?? workspace.noteCount ?? 0
  const themeLabel = theme === "light" ? "Switch to dark mode" : "Switch to light mode"

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand" aria-label="BlueNote Web">
          <strong>BlueNote</strong>
          <span className="muted">Web</span>
        </div>
        <div className="topbar-workspace" aria-label="Workspace path" title={workspace.rootPath}>
          <span className="topbar-workspace__label">Workspace</span>
          <span className="topbar-workspace__path">{workspace.rootPath}</span>
          <span className="pill topbar-workspace__count">{workspaceNoteCount} notes</span>
        </div>
        <div className="topbar-controls" aria-label="Global controls">
          <div className="topbar-command-cluster">
            <button
              type="button"
              className="primary topbar-command"
              aria-label="Search notes and commands"
              onClick={onPalette}
            >
              <span>Search</span>
              <span className="topbar-command__shortcut" aria-hidden="true">
                <kbd>Ctrl</kbd>+<kbd>K</kbd>
              </span>
            </button>
            {topbarNeedsRestoreControls ? <PaneToggleButtons {...panes} /> : null}
          </div>
          <div className="topbar-secondary-controls">
            <button className="theme-toggle" type="button" aria-label={themeLabel} onClick={onToggleTheme} title={themeLabel}>
              {theme === "light" ? "☾" : "☀"}
            </button>
            <button type="button" className="pill ai-pill" onClick={onAi} aria-label={`Open AI status and configuration (${aiSummary})`}>
              <span className="ai-pill__label">AI</span>
              <span className={`ai-pill__dot ai-pill__dot--${aiDisplay.tone}`} aria-hidden="true" />
              <span className="ai-pill__value">{aiDisplay.label}</span>
            </button>
          </div>
        </div>
      </header>
      <div className="workspace-frame">
        {showWorkspaceViewToolbar ? (
          <div className="workspace-view-toolbar" role="toolbar" aria-label="Workspace view controls">
            <span className="muted">Restore hidden panes</span>
            <PaneToggleButtons {...panes} />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
