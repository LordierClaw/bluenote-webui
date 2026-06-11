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

type ViewTab = "status" | "queue" | "config" | "auth"

function formatJobTime(value?: string): string {
  if (!value) return "Unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function summarizeQueueJobs(queue: AiQueueView | null) {
  return (queue?.jobs ?? []).reduce((summary, job) => {
    if (job.status === "running") summary.running += 1
    else if (job.status === "failed") summary.failed += 1
    else summary.pending += 1
    return summary
  }, { pending: 0, running: 0, failed: 0 })
}

function statusTone(status: AiStatusSummary | null): "good" | "warn" | "error" | "idle" {
  if (!status) return "idle"
  if (status.status === "connected" || status.status === "running") return "good"
  if (status.status === "auth-required" || status.status === "not-configured") return "warn"
  if (status.status === "error") return "error"
  return "idle"
}

function jobStateLabel(job: AiQueueJobView): string {
  return `${job.status} · attempts ${job.attempts}`
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
  const [provider, setProvider] = useState<"openai-compatible" | "codex">("openai-compatible")
  const [enabled, setEnabled] = useState(true)
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("")
  const [maxAttempts, setMaxAttempts] = useState("3")
  const [outputLanguage, setOutputLanguage] = useState("English")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<ViewTab>("status")

  const queueSummary = useMemo(() => summarizeQueueJobs(queue), [queue])
  const combinedQueue = status?.queue ?? queueSummary

  useEffect(() => {
    if (!config) return
    setProvider(config.provider ?? "openai-compatible")
    setEnabled(config.enabled ?? true)
    setBaseUrl(config.baseUrl ?? "")
    setApiKey("")
    setModel(config.model ?? "")
    setMaxAttempts(String(config.maxAttempts ?? 3))
    setOutputLanguage(config.outputLanguage ?? "English")
  }, [config, open])

  useEffect(() => {
    if (open) setTab("status")
  }, [open])

  async function run(task: () => Promise<void> | void) {
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActionDialog title="AI background jobs and configuration" open={open} onClose={onClose} busy={busy} className="ai-workspace-dialog-shell">
      <div className="ai-workspace-dialog">
        <div className="ai-workspace-dialog__hero">
          <div className="ai-workspace-dialog__intro">
            <span className="note-command-surface__eyebrow">Background workflow</span>
            <p>Keep AI off the writing surface. Inspect status, queue work, manage config, and refresh auth from one compact panel.</p>
          </div>
          <div className="ai-workspace-dialog__hero-metrics" role="list" aria-label="AI workspace summary">
            <div className="ai-metric-card" role="listitem"><span>Queued</span><strong>{combinedQueue.pending ?? 0}</strong></div>
            <div className="ai-metric-card" role="listitem"><span>Running</span><strong>{combinedQueue.running ?? 0}</strong></div>
            <div className="ai-metric-card" role="listitem"><span>Failed</span><strong>{combinedQueue.failed ?? 0}</strong></div>
          </div>
        </div>

        <div className="ai-tab-strip" role="tablist" aria-label="AI workspace sections">
          {([
            ["status", "Status"],
            ["queue", "Queue"],
            ["config", "Config"],
            ["auth", "Auth"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? "active" : undefined}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ai-tab-panel">
          {tab === "status" ? (
            <section className="ai-section">
              <div className="ai-section-header">
                <div>
                  <strong>Background status</strong>
                  <p className="muted">Live connection, provider health, and queue totals for this workspace.</p>
                </div>
                <button type="button" onClick={() => void run(async () => { await onRefresh(); setNotice("AI status refreshed.") })}>Refresh AI status</button>
              </div>
              <div className="ai-status-hero">
                <div className={`ai-status-badge tone-${statusTone(status)}`}>
                  <span className="ai-status-badge__label">State</span>
                  <strong>{status?.status ?? "unknown"}</strong>
                  <span className="muted">{status?.provider ?? "provider unknown"}{status?.model ? ` · ${status.model}` : ""}</span>
                </div>
                <div className="ai-status-grid" role="list" aria-label="AI queue summary">
                  <div className="ai-metric-card" role="listitem"><span>Queued</span><strong>{combinedQueue.pending ?? 0}</strong></div>
                  <div className="ai-metric-card" role="listitem"><span>Running</span><strong>{combinedQueue.running ?? 0}</strong></div>
                  <div className="ai-metric-card" role="listitem"><span>Failed</span><strong>{combinedQueue.failed ?? 0}</strong></div>
                </div>
              </div>
              {status?.message ? <p className="ai-inline-message">{status.message}</p> : null}
            </section>
          ) : null}

          {tab === "queue" ? (
            <section className="ai-section">
              <div className="ai-section-header">
                <div>
                  <strong>Background jobs</strong>
                  <p className="muted">Search-first queue management without taking over the editor or preview panes.</p>
                </div>
              </div>
              <div className="ai-inline-actions">
                <button type="button" onClick={() => void run(async () => { await onDescribeCurrentNote(); setNotice("Queued AI describe for the current note.") })}>Queue current note description</button>
                <button type="button" onClick={() => void run(async () => {
                  const result = await onProcessQueue()
                  if (result) setNotice(`Processed queue: ${result.applied} applied, ${result.failed} failed, ${result.remaining} remaining.`)
                })}>Run queued jobs</button>
              </div>
              {(queue?.jobs ?? []).length ? (
                <ul className="ai-queue-list" aria-label="AI queued jobs">
                  {(queue?.jobs ?? []).map((job) => (
                    <li key={`${job.kind}:${job.key}`} className={`ai-queue-item is-${job.status}`}>
                      <div>
                        <strong>{job.relativePath}</strong>
                        <span className="muted">{job.kind} · updated {formatJobTime(job.updatedAt)}</span>
                      </div>
                      <div className="ai-queue-item__meta">
                        <span className="ai-job-state">{jobStateLabel(job)}</span>
                        {job.lastError ? <span className="ai-job-error">{job.lastError}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No queued AI jobs right now.</p>
              )}
            </section>
          ) : null}

          {tab === "config" ? (
            <section className="ai-section">
              <div className="ai-section-header">
                <div>
                  <strong>Core-compatible configuration</strong>
                  <p className="muted">These settings stay aligned with BlueNote core instead of creating a web-only AI mode.</p>
                </div>
              </div>
              <div className="ai-config-form">
                <label>
                  <span>Provider</span>
                  <select aria-label="Provider" value={provider} onChange={(event) => setProvider(event.target.value as "openai-compatible" | "codex")}>
                    <option value="openai-compatible">openai-compatible</option>
                    <option value="codex">codex</option>
                  </select>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                  <span>Enabled</span>
                </label>
                {provider === "openai-compatible" ? (
                  <>
                    <label><span>Base URL</span><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" /></label>
                    <label><span>API key</span><input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config?.apiKeyMasked ?? "sk-..."} /></label>
                  </>
                ) : null}
                <label><span>Model</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-5-codex" /></label>
                <label><span>Max attempts</span><input value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} inputMode="numeric" /></label>
                <label><span>Output language</span><input value={outputLanguage} onChange={(event) => setOutputLanguage(event.target.value)} /></label>
              </div>
              <button type="button" className="primary" onClick={() => void run(async () => {
                await onSaveConfig({
                  version: 1,
                  enabled,
                  provider,
                  ...(provider === "openai-compatible" ? { baseUrl, apiKey: apiKey || undefined } : {}),
                  model,
                  logging: config?.logging ?? { usage: true, conversations: false, results: true },
                  maxAttempts: Number(maxAttempts) || 3,
                  outputLanguage,
                })
                setNotice("AI configuration saved.")
              })}>Save AI config</button>
            </section>
          ) : null}

          {tab === "auth" ? (
            <section className="ai-section">
              <div className="ai-section-header">
                <div>
                  <strong>Codex authentication</strong>
                  <p className="muted">Refresh or replace Codex credentials without disturbing the editor state.</p>
                </div>
              </div>
              <p className="muted">State: {codexAuth?.state ?? "unknown"}</p>
              {codexAuth?.hint ? <p className="muted">{codexAuth.hint}</p> : null}
              {codexAuth?.message ? <p className="muted">{codexAuth.message}</p> : null}
              <div className="ai-inline-actions">
                <button type="button" onClick={() => void run(async () => {
                  const flow = await onStartCodexAuth()
                  if (flow) setNotice(`Open ${flow.verificationUrl} and enter code ${flow.userCode}.`)
                })}>Start Codex auth</button>
                <button type="button" onClick={() => void run(async () => { await onLogoutCodex(); setNotice("Codex auth removed.") })}>Logout Codex</button>
              </div>
            </section>
          ) : null}
        </div>

        {notice ? <p className="ai-notice">{notice}</p> : null}
      </div>
    </ActionDialog>
  )
}
