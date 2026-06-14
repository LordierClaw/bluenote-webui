import { useEffect, useMemo, useState } from "react"
import type {
  AiConfigView,
  AiProcessQueueResult,
  AiQueueJobView,
  AiQueueView,
  AiStatusSummary,
  CodexAuthStartView,
  CodexAuthStatusView,
} from "../../shared/types"
import { ActionDialog } from "./ActionDialog"

type AiWorkspaceDialogProps = {
  open: boolean
  onClose: () => void
  status: AiStatusSummary | null
  config: AiConfigView | null
  queue: AiQueueView | null
  codexAuth: CodexAuthStatusView | null
  onRefresh: () => Promise<void> | void
  onSaveConfig: (config: unknown) => Promise<void> | void
  onDescribeCurrentNote: () => Promise<void> | void
  onProcessQueue: () => Promise<AiProcessQueueResult | void> | void
  onStartCodexAuth: () => Promise<CodexAuthStartView | void> | void
  onLogoutCodex: () => Promise<void> | void
}

type ViewTab = "status" | "config" | "queue" | "auth"

function formatJobTime(value?: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function jobStatusClass(status: string): string {
  if (status === "running") return "is-running"
  if (status === "failed") return "is-failed"
  return "is-pending"
}

function jobStatusIcon(status: string): string {
  if (status === "running") return "sync"
  if (status === "failed") return "error_outline"
  return "pending"
}

function statusTone(status: AiStatusSummary | null): string {
  if (!status) return "idle"
  if (status.status === "connected" || status.status === "running") return "ready"
  if (status.status === "error") return "danger"
  if (status.status === "not-configured" || status.status === "auth-required") return "warning"
  return "idle"
}

function summarizeQueueJobs(queue: AiQueueView | null) {
  return (queue?.jobs ?? []).reduce((s, job) => {
    if (job.status === "running") s.running += 1
    else if (job.status === "failed") s.failed += 1
    else s.pending += 1
    return s
  }, { pending: 0, running: 0, failed: 0 })
}

export function AiWorkspaceDialog({
  open,
  onClose,
  status,
  config,
  queue,
  codexAuth,
  onRefresh,
  onSaveConfig,
  onDescribeCurrentNote,
  onProcessQueue,
  onStartCodexAuth,
  onLogoutCodex,
}: AiWorkspaceDialogProps) {
  const [tab, setTab] = useState<ViewTab>("status")
  const [configMode, setConfigMode] = useState<"openai" | "codex">("openai")
  const [enabled, setEnabled] = useState(true)
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [model, setModel] = useState("")
  const [maxAttempts, setMaxAttempts] = useState("3")
  const [outputLanguage, setOutputLanguage] = useState("English")
  const [deviceCode, setDeviceCode] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  const queueSummary = useMemo(() => summarizeQueueJobs(queue), [queue])
  const combinedQueue = status?.queue ?? queueSummary
  const jobs: AiQueueJobView[] = queue?.jobs ?? []

  useEffect(() => {
    if (!config) return
    setConfigMode(config.provider === "codex" ? "codex" : "openai")
    setEnabled(config.enabled ?? true)
    setBaseUrl(config.baseUrl ?? "")
    setApiKey("")
    setModel(config.model ?? "")
    setMaxAttempts(String(config.maxAttempts ?? 3))
    setOutputLanguage(config.outputLanguage ?? "English")
  }, [config, open])

  useEffect(() => {
    if (open) { setTab("status"); setNotice("") }
  }, [open])

  async function run(task: () => Promise<void> | void) {
    setBusy(true)
    try { await task() }
    finally { setBusy(false) }
  }  const tabs: { id: ViewTab; label: string; icon: string }[] = [
    { id: "status", label: "Status", icon: "info" },
    { id: "config", label: "Config", icon: "settings" },
    { id: "queue", label: `Queue${jobs.length ? ` (${jobs.length})` : ""}`, icon: "queue" },
    { id: "auth", label: "Auth", icon: "devices" },
  ]

  return (
    <ActionDialog
      title="AI Integration"
      ariaLabel="AI background jobs and configuration"
      open={open}
      onClose={onClose}
      busy={busy}
      className="ai-dialog-shell"
    >
      <div className="ai-dialog-layout">
        {/* ── Tab nav ── */}
        <div className="ai-tab-nav" role="tablist" aria-label="AI sections">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`ai-tab-btn${tab === id ? " active" : ""}`}
              onClick={() => setTab(id)}
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── Status strip ── */}
        <div className="ai-status-strip">
          <span className={`ai-status-dot tone-${statusTone(status)}`} aria-hidden="true" />
          <span className="ai-status-strip__text">
            {status?.status ?? "unknown"}
            {status?.provider ? ` · ${status.provider}` : ""}
            {status?.model ? ` · ${status.model}` : ""}
          </span>
          <div style={{ flex: 1 }} />
          <div className="ai-status-strip__metrics">
            {combinedQueue.running > 0 && <span className="ai-queue-chip is-running">{combinedQueue.running} running</span>}
            {combinedQueue.pending > 0 && <span className="ai-queue-chip is-pending">{combinedQueue.pending} queued</span>}
            {combinedQueue.failed > 0 && <span className="ai-queue-chip is-failed">{combinedQueue.failed} failed</span>}
          </div>
        </div>

        {/* ── Tab panels ── */}
        <div className="ai-tab-panel" role="tabpanel">
          {/* STATUS TAB */}
          {tab === "status" && (
            <div className="ai-status-panel">
              <div className="ai-workspace-dialog__hero">
                <span className="material-symbols-outlined hero-icon" aria-hidden="true">smart_toy</span>
                <div>
                  <div className="hero-title">AI Workspace Integration</div>
                  <div className="hero-subtitle">background status</div>
                </div>
              </div>

              <div className="ai-status-details-card">
                {status?.message && (
                  <div className="ai-status-message-box">
                    <span className="material-symbols-outlined icon-sm" aria-hidden="true">warning</span>
                    <p>{status.message}</p>
                  </div>
                )}

                <div className="ai-status-metrics-grid">
                  <div className="metric-box">
                    <span className="metric-val">{combinedQueue.pending}</span>
                    <span className="metric-lbl">Pending Jobs</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-val">{combinedQueue.running}</span>
                    <span className="metric-lbl">Running Jobs</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-val">{combinedQueue.failed}</span>
                    <span className="metric-lbl">Failed Jobs</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void run(async () => { await onRefresh(); setNotice("Status refreshed.") })}
                  aria-label="Refresh AI status"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">refresh</span>
                  Refresh AI Status
                </button>
              </div>
            </div>
          )}

          {/* CONFIG TAB */}
          {tab === "config" && (
            <div className="ai-config-panel">
              {/* Mode selector as combobox */}
              <div className="settings-field">
                <label className="label-caps" htmlFor="ai-provider-select">Provider</label>
                <select
                  id="ai-provider-select"
                  aria-label="Provider"
                  className="ai-provider-select-box"
                  value={configMode}
                  onChange={(e) => setConfigMode(e.target.value as "openai" | "codex")}
                >
                  <option value="openai">openai-compatible</option>
                  <option value="codex">codex</option>
                </select>
              </div>

              {configMode === "openai" && (
                <div className="ai-config-form" style={{ marginTop: "12px" }}>
                  <div className="settings-toggle-row" style={{ border: "none", padding: "0 0 12px" }}>
                    <div>
                      <div style={{ fontSize: "13px", color: "var(--on-surface)", fontFamily: "var(--font-display)", fontWeight: 500 }}>Enable AI Integration</div>
                      <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px" }}>Process background AI jobs for this workspace.</div>
                    </div>
                    <button
                      type="button"
                      className={`toggle-btn${enabled ? " on" : ""}`}
                      role="switch"
                      aria-checked={enabled}
                      aria-label="Enable AI"
                      onClick={() => setEnabled((v) => !v)}
                    >
                      <span className="toggle-knob" />
                    </button>
                  </div>

                  <div className="settings-field">
                    <label className="label-caps" htmlFor="ai-base-url">Base URL</label>
                    <input
                      id="ai-base-url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>

                  <div className="settings-field">
                    <label className="label-caps" htmlFor="ai-api-key">API Key</label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="ai-api-key"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={config?.apiKeyMasked ?? "sk-..."}
                        style={{ paddingRight: "40px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey((v) => !v)}
                        aria-label={showApiKey ? "Hide API key" : "Show API key"}
                        style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "var(--on-surface-variant)", cursor: "pointer", padding: "0", display: "flex", alignItems: "center" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "17px" }} aria-hidden="true">
                          {showApiKey ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="settings-grid-2">
                    <div className="settings-field">
                      <label className="label-caps" htmlFor="ai-model">Model</label>
                      <input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o" />
                    </div>
                    <div className="settings-field">
                      <label className="label-caps" htmlFor="ai-max-attempts">Max Attempts</label>
                      <input id="ai-max-attempts" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} inputMode="numeric" />
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="label-caps" htmlFor="ai-output-lang">Output Language</label>
                    <input id="ai-output-lang" value={outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)} />
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void run(async () => {
                      await onSaveConfig({
                        version: 1, enabled, provider: "openai-compatible",
                        baseUrl, apiKey: apiKey || undefined,
                        model, maxAttempts: Number(maxAttempts) || 3, outputLanguage,
                        logging: config?.logging ?? { usage: true, conversations: false, results: true },
                      })
                      setNotice("Configuration saved.")
                    })}
                    style={{ marginTop: "4px", width: "100%", justifyContent: "center" }}
                  >
                    <span className="material-symbols-outlined icon-sm" aria-hidden="true">save</span>
                    Save Configuration
                  </button>
                </div>
              )}

              {configMode === "codex" && (
                <div className="ai-config-form" style={{ marginTop: "12px" }}>
                  <div className="ai-codex-info">
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "32px", color: "var(--primary)", flexShrink: 0 }}>devices</span>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--on-surface)", fontFamily: "var(--font-display)" }}>Codex Device Authentication</div>
                      <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "4px", lineHeight: "1.5" }}>
                        Authenticate using a device code flow. Select "Auth" tab or use device flow configuration to authenticate.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUEUE TAB */}
          {tab === "queue" && (
            <div className="ai-queue-panel">
              <div className="ai-queue-toolbar">
                <button
                  type="button"
                  onClick={() => void run(async () => { await onDescribeCurrentNote(); setNotice("Queued AI describe for current note.") })}
                >
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">add_task</span>
                  Queue describe
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  aria-label="Run queued jobs"
                  onClick={() => void run(async () => {
                    const result = await onProcessQueue()
                    if (result) setNotice(`Applied ${result.applied}, failed ${result.failed}, remaining ${result.remaining}.`)
                  })}
                >
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">play_arrow</span>
                  Run queued jobs
                </button>
              </div>

              {jobs.length > 0 ? (
                <div className="ai-queue-list-wrapper">
                  <ul className="ai-queue-table" role="list" aria-label="AI queued jobs" style={{ padding: 0, listStyle: "none" }}>
                    {/* Header */}
                    <div className="ai-queue-row ai-queue-row--header" role="row">
                      <div role="columnheader" className="ai-queue-col col-no">#</div>
                      <div role="columnheader" className="ai-queue-col col-action">Action</div>
                      <div role="columnheader" className="ai-queue-col col-status">Status</div>
                      <div role="columnheader" className="ai-queue-col col-updated">Updated</div>
                    </div>
                    {/* Rows */}
                    {jobs.map((job, i) => (
                      <li
                        key={`${job.kind}:${job.key}`}
                        className={`ai-queue-row ${jobStatusClass(job.status)}`}
                        role="listitem"
                      >
                        <div role="cell" className="ai-queue-col col-no">{i + 1}</div>
                        <div role="cell" className="ai-queue-col col-action">
                          <span className="material-symbols-outlined icon-sm" aria-hidden="true">{jobStatusIcon(job.status)}</span>
                          <span>{job.relativePath}</span>
                          <span className="ai-queue-kind">{job.kind}</span>
                        </div>
                        <div role="cell" className="ai-queue-col col-status">
                          <span className={`ai-queue-status-badge ${jobStatusClass(job.status)}`}>{job.status}</span>
                          {job.attempts > 1 && <span className="ai-queue-attempts">×{job.attempts}</span>}
                          {job.lastError && <span className="ai-queue-error" title={job.lastError}>!</span>}
                        </div>
                        <div role="cell" className="ai-queue-col col-updated">{formatJobTime(job.updatedAt)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="ai-queue-empty">
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "40px", color: "var(--outline)" }}>check_circle</span>
                  <p>No jobs in the queue</p>
                </div>
              )}
            </div>
          )}

          {/* AUTH TAB */}
          {tab === "auth" && (
            <div className="ai-auth-panel">
              <div className="ai-codex-info">
                <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "32px", color: "var(--primary)", flexShrink: 0 }}>devices</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--on-surface)", fontFamily: "var(--font-display)" }}>Codex Device Authentication</div>
                  <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "4px", lineHeight: "1.5" }}>
                    Authenticate using a device code flow. Click "Start Codex Auth" to get a verification URL and code.
                  </div>
                </div>
              </div>

              <div className="settings-field" style={{ marginTop: "12px" }}>
                <label className="label-caps">Current State</label>
                <div className="ai-codex-state-pill">
                  <span className={`ai-status-dot tone-${codexAuth?.state === "authenticated" ? "ready" : "idle"}`} aria-hidden="true" />
                  {codexAuth?.state ?? "unknown"}
                  {codexAuth?.hint ? <span style={{ color: "var(--on-surface-variant)" }}> · {codexAuth.hint}</span> : null}
                </div>
              </div>

              <div className="settings-field">
                <label className="label-caps" htmlFor="ai-device-code">Device Code (placeholder)</label>
                <input
                  id="ai-device-code"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  placeholder="Enter code from verification URL..."
                />
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  className="btn-primary"
                  aria-label="Start Codex Auth"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => void run(async () => {
                    const flow = await onStartCodexAuth()
                    if (flow) setNotice(`Open ${flow.verificationUrl} and enter code: ${flow.userCode}`)
                  })}
                >
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">login</span>
                  Start Codex Auth
                </button>
                <button
                  type="button"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => void run(async () => { await onLogoutCodex(); setNotice("Logged out.") })}
                >
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">logout</span>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Notice ── */}
        {notice ? (
          <div className="ai-notice" role="status" aria-live="polite">
            <span className="material-symbols-outlined icon-sm" aria-hidden="true">info</span>
            {notice}
          </div>
        ) : null}
      </div>
    </ActionDialog>
  )
}
