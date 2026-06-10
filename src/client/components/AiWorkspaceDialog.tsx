import { useEffect, useState } from "react"

import type {
  AiConfigView,
  AiProcessQueueResult,
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

  async function run(task: () => Promise<void> | void) {
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActionDialog title="AI workspace" open={open} onClose={onClose} busy={busy}>
      <div className="ai-workspace-dialog">
        <section className="ai-section">
          <div className="ai-section-header">
            <strong>AI status</strong>
            <button type="button" onClick={() => void run(async () => { await onRefresh(); setNotice("AI status refreshed.") })}>Refresh AI status</button>
          </div>
          <p className="muted">Status: {status?.status ?? "unknown"} {status?.provider ? `· ${status.provider}` : ""} {status?.model ? `· ${status.model}` : ""}</p>
          <p className="muted">Pending jobs: {status?.queue?.pending ?? 0} · Failed jobs: {status?.queue?.failed ?? 0}</p>
        </section>

        <section className="ai-section">
          <div className="ai-section-header"><strong>Configuration</strong></div>
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

        <section className="ai-section">
          <div className="ai-section-header"><strong>Codex auth</strong></div>
          <p className="muted">State: {codexAuth?.state ?? "unknown"}</p>
          {codexAuth?.hint ? <p className="muted">{codexAuth.hint}</p> : null}
          <div className="ai-inline-actions">
            <button type="button" onClick={() => void run(async () => {
              const flow = await onStartCodexAuth()
              if (flow) {
                setNotice(`Open ${flow.verificationUrl} and enter code ${flow.userCode}.`)
              }
            })}>Start Codex auth</button>
            <button type="button" onClick={() => void run(async () => { await onLogoutCodex(); setNotice("Codex auth removed.") })}>Logout Codex</button>
          </div>
        </section>

        <section className="ai-section">
          <div className="ai-section-header"><strong>Queue</strong></div>
          <p className="muted">Pending jobs: {queue?.jobs.length ?? 0}</p>
          <div className="ai-inline-actions">
            <button type="button" onClick={() => void run(async () => { await onDescribeCurrentNote(); setNotice("Triggered AI describe for current note.") })}>Describe current note</button>
            <button type="button" onClick={() => void run(async () => {
              const result = await onProcessQueue()
              if (result) {
                setNotice(`Processed queue: ${result.applied} applied, ${result.failed} failed, ${result.remaining} remaining.`)
              }
            })}>Process queue</button>
          </div>
          <ul className="ai-queue-list">
            {(queue?.jobs ?? []).map((job) => (
              <li key={`${job.kind}:${job.key}`}>
                <strong>{job.key}</strong>
                <span className="muted">{job.relativePath} · {job.status} · attempts={job.attempts}</span>
              </li>
            ))}
          </ul>
        </section>

        {notice ? <p className="ai-notice">{notice}</p> : null}
      </div>
    </ActionDialog>
  )
}
