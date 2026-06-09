import { useState } from "react"

export function SetupScreen({ error, onSubmit }: { error?: string | null; onSubmit: (rootPath: string, init: boolean) => Promise<void> }) {
  const [rootPath, setRootPath] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(init: boolean) {
    setBusy(true)
    try {
      await onSubmit(rootPath, init)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <div className="brand-mark">BN</div>
        <h1>Open a local BlueNote workspace</h1>
        <p>The web UI runs against a localhost Node server. Enter a filesystem path on this machine; the browser never reads directories directly.</p>
        <label>
          Workspace path
          <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} placeholder="/home/me/.bluenote" autoFocus />
        </label>
        {error ? <p role="alert" className="error">{error}</p> : null}
        <div className="button-row">
          <button disabled={busy || !rootPath.trim()} onClick={() => void submit(false)}>Open</button>
          <button disabled={busy || !rootPath.trim()} onClick={() => void submit(true)}>Initialize</button>
        </div>
      </section>
    </main>
  )
}
