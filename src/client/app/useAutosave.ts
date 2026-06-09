import { useEffect, useRef } from "react"

export function useAutosave(enabled: boolean, dirty: boolean, save: () => Promise<void>, delayMs = 1200): void {
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (!enabled || !dirty) return undefined
    const timer = window.setTimeout(() => {
      void saveRef.current()
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, dirty, enabled])
}
