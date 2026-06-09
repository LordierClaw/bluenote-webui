import { useEffect, useState } from "react"
import type { WorkspaceStatus } from "../../shared/types"
import { api } from "./api"

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setWorkspace(await api.workspace())
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load workspace.")
    } finally {
      setLoading(false)
    }
  }

  async function open(rootPath: string, initialize: boolean) {
    setError(null)
    try {
      setWorkspace(initialize ? await api.initWorkspace(rootPath) : await api.openWorkspace(rootPath))
    } catch (error) {
      setError(error instanceof Error ? error.message : "Workspace action failed.")
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return { workspace, loading, error, refresh, open }
}
