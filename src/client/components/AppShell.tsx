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
  onSettings?: () => void
  currentNotePath?: string | null
}

function summarizeAiStatus(aiStatus?: AppShellAiStatus | null): { label: string; tone: "ready" | "idle" | "warning" | "danger" } {
  if (!aiStatus) return { label: "Unknown", tone: "idle" }
  const queue = "queue" in aiStatus ? aiStatus.queue : undefined
  if (queue?.running) return { label: `${queue.running} running`, tone: "ready" }
  if (queue?.pending) return { label: `${queue.pending} queued`, tone: "warning" }
  if (queue?.failed) return { label: `${queue.failed} failed`, tone: "danger" }
  const status = aiStatus.status.trim().toLowerCase()
  if (!status || status === "unknown") return { label: "Unknown", tone: "idle" }
  if (status === "not-configured") return { label: "Not configured", tone: "idle" }
  if (status.includes("failed")) return { label: aiStatus.status, tone: "danger" }
  if (status.includes("running")) return { label: aiStatus.status, tone: "ready" }
  if (status.includes("queued")) return { label: aiStatus.status, tone: "warning" }
  if (status.includes("ready") || status.includes("configured") || status.includes("connected")) {
    return { label: aiStatus.status, tone: "ready" }
  }
  return { label: aiStatus.status, tone: "idle" }
}

export function AppShell({
  workspace,
  aiStatus,
  theme,
  panes,
  children,
  onToggleTheme,
  onPalette,
  onAi,
  onSettings,
  currentNotePath,
}: AppShellProps) {
  const showWorkspaceViewToolbar = !panes.managerVisible && !panes.previewVisible
  const topbarNeedsRestoreControls = !showWorkspaceViewToolbar && (!panes.managerVisible || !panes.previewVisible)
  const ai = summarizeAiStatus(aiStatus)
  const themeLabel = theme === "light" ? "Switch to dark mode" : "Switch to light mode"
  const themeIcon = theme === "light" ? "dark_mode" : "light_mode"
  const displayPath = currentNotePath ?? workspace.rootPath

  return (
    <div className="app-shell">
      {/* ── Top Nav Bar ── */}
      <header className="topbar" role="banner">
        {/* Left: brand + file path */}
        <div className="topbar-left">
          <div className="topbar-brand" aria-label="BlueNote Web">
            <span className="topbar-brand__name">BlueNote</span>
            <span className="topbar-brand__suffix">Web</span>
          </div>
          {displayPath ? (
            <div className="topbar-filepath" aria-label="Current file path" title={displayPath}>
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">folder_open</span>
              <span className="topbar-filepath__path">{displayPath}</span>
            </div>
          ) : null}
          {topbarNeedsRestoreControls ? (
            <div style={{ marginLeft: "8px" }}>
              <PaneToggleButtons {...panes} />
            </div>
          ) : null}
        </div>

        {/* Right: AI status + search + settings + theme */}
        <div className="topbar-right" role="toolbar" aria-label="Global controls">
          {/* AI status indicator */}
          <button
            type="button"
            className="topbar-ai-status"
            onClick={onAi}
            aria-label={`AI status: ${ai.label}. Click to open AI configuration`}
            title="AI Integration"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: "2px" }}
          >
            <span className={`topbar-ai-dot topbar-ai-dot--${ai.tone}`} aria-hidden="true" />
            <span>AI: {ai.label}</span>
          </button>

          {/* Search */}
          <button
            type="button"
            className="topbar-icon-btn"
            aria-label="Search notes and commands (Ctrl+K)"
            title="Search (Ctrl+K)"
            onClick={onPalette}
          >
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
          </button>

          {/* Settings */}
          {onSettings ? (
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Open settings"
              title="Settings"
              onClick={onSettings}
            >
              <span className="material-symbols-outlined" aria-hidden="true">settings</span>
            </button>
          ) : null}

          {/* Theme toggle */}
          <button
            type="button"
            className="topbar-icon-btn"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={onToggleTheme}
          >
            <span className="material-symbols-outlined" aria-hidden="true">{themeIcon}</span>
          </button>
        </div>
      </header>

      {/* ── Workspace ── */}
      <div className="workspace-frame">
        {showWorkspaceViewToolbar ? (
          <div className="workspace-view-toolbar" role="toolbar" aria-label="Workspace view controls">
            <span className="muted">All panes hidden — restore one to get started</span>
            <PaneToggleButtons {...panes} />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
