import { useEffect } from "react"

export function useAutosave(enabled: boolean, dirty: boolean, save: () => Promise<void>, delayMs = 1200): void {
  useEffect(() => {
    if (!enabled || !dirty) return undefined
    const timer = window.setTimeout(() => {
      void save()
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, dirty, enabled, save])
}
