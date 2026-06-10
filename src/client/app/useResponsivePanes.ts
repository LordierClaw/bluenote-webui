import { useEffect, useMemo, useState } from "react"

const MANAGER_KEY = "bluenote-webui.manager-visible"
const PREVIEW_KEY = "bluenote-webui.preview-visible"
const MANAGER_BREAKPOINT = 980
const PREVIEW_BREAKPOINT = 760

function readPreference(key: string, fallback = true): boolean {
  if (typeof window === "undefined") return fallback
  return window.localStorage.getItem(key) !== "false"
}

export interface ResponsivePanesState {
  managerVisible: boolean
  previewVisible: boolean
  managerAutoHidden: boolean
  previewAutoHidden: boolean
  toggleManager: () => void
  togglePreview: () => void
}

export function useResponsivePanes(): ResponsivePanesState {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth))
  const [managerPreference, setManagerPreference] = useState(() => readPreference(MANAGER_KEY, typeof window === "undefined" ? true : window.innerWidth >= MANAGER_BREAKPOINT))
  const [previewPreference, setPreviewPreference] = useState(() => readPreference(PREVIEW_KEY, typeof window === "undefined" ? true : window.innerWidth >= PREVIEW_BREAKPOINT))

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return useMemo(() => {
    const managerVisible = managerPreference
    const previewVisible = previewPreference

    return {
      managerVisible,
      previewVisible,
      managerAutoHidden: width < MANAGER_BREAKPOINT && !managerVisible,
      previewAutoHidden: width < PREVIEW_BREAKPOINT && !previewVisible,
      toggleManager() {
        setManagerPreference((value) => {
          const next = !value
          if (typeof window !== "undefined") window.localStorage.setItem(MANAGER_KEY, String(next))
          return next
        })
      },
      togglePreview() {
        setPreviewPreference((value) => {
          const next = !value
          if (typeof window !== "undefined") window.localStorage.setItem(PREVIEW_KEY, String(next))
          return next
        })
      },
    }
  }, [managerPreference, previewPreference, width])
}
