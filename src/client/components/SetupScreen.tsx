import { useEffect, useState } from "react"

export function SetupScreen({ error, defaultRootPath, onSubmit }: { error?: string | null; defaultRootPath?: string; onSubmit: (rootPath: string, init: boolean) => Promise<void> }) {
  const [rootPath, setRootPath] = useState(defaultRootPath ?? "")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!rootPath && defaultRootPath) setRootPath(defaultRootPath)
  }, [defaultRootPath, rootPath])

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
        <p className="eyebrow">Local workspace</p>
        <h1>Open BlueNote</h1>
        <p>BlueNote Web loads your local workspace from the Node server. The default is your home .bluenote folder.</p>
        <label className="field-block">
          <span>Workspace path</span>
          <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} placeholder={defaultRootPath ?? "/home/me/.bluenote"} autoFocus />
        </label>
        {error ? <p role="alert" className="error">{error}</p> : null}
        <div className="button-row">
          <button className="primary" disabled={busy || !rootPath.trim()} onClick={() => void submit(true)}>Use default</button>
          <button disabled={busy || !rootPath.trim()} onClick={() => void submit(false)}>Open</button>
          <button disabled={busy || !rootPath.trim()} onClick={() => void submit(true)}>Initialize</button>
        </div>
      </section>
    </main>
  )
}
