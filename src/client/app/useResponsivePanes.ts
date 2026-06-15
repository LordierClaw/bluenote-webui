import { useEffect, useMemo, useState } from "react"

const MANAGER_KEY = "bluenote-webui.manager-visible"
const PREVIEW_KEY = "bluenote-webui.preview-visible"
const LEGACY_PREVIEW_KEY = "bluenote-webui.utility-visible"
const MANAGER_BREAKPOINT = 1040
const PREVIEW_BREAKPOINT = 768

type PanePreference = boolean | null

function visibleByDefault(width: number, breakpoint: number): boolean {
  return width >= breakpoint
}

function readPanePreference(key: string): PanePreference {
  if (typeof window === "undefined") return null
  const value = window.localStorage.getItem(key)
  if (value === "true") return true
  if (value === "false") return false
  return null
}

function writePanePreference(key: string, value: PanePreference) {
  if (typeof window === "undefined") return
  if (value === null) {
    window.localStorage.removeItem(key)
    return
  }
  window.localStorage.setItem(key, String(value))
}

export interface ResponsivePanesState {
  managerVisible: boolean
  previewVisible: boolean
  managerAutoHidden: boolean
  previewAutoHidden: boolean
  openManager: () => void
  hideManager: () => void
  openPreview: () => void
  hidePreview: () => void
  toggleManager: () => void
  togglePreview: () => void
}

export function useResponsivePanes(): ResponsivePanesState {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth))
  const [managerPreference, setManagerPreference] = useState<PanePreference>(() => readPanePreference(MANAGER_KEY))
  const [previewPreference, setPreviewPreference] = useState<PanePreference>(() => readPanePreference(PREVIEW_KEY))

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    window.localStorage.removeItem(LEGACY_PREVIEW_KEY)
    const readWidth = () => window.visualViewport?.width ?? window.innerWidth
    const onResize = () => {
      setWidth(readWidth())
    }
    setWidth(readWidth())
    window.addEventListener("resize", onResize)
    window.visualViewport?.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      window.visualViewport?.removeEventListener("resize", onResize)
    }
  }, [])

  return useMemo(() => {
    const managerVisible = managerPreference ?? visibleByDefault(width, MANAGER_BREAKPOINT)
    const previewVisible = previewPreference ?? visibleByDefault(width, PREVIEW_BREAKPOINT)
    const managerAutoHidden = managerPreference === null && !managerVisible
    const previewAutoHidden = previewPreference === null && !previewVisible

    function openManager() {
      const nextManagerPreference = true
      setManagerPreference(nextManagerPreference)
      writePanePreference(MANAGER_KEY, nextManagerPreference)
      if (width < MANAGER_BREAKPOINT) {
        setPreviewPreference(false)
        writePanePreference(PREVIEW_KEY, false)
      }
    }

    function hideManager() {
      setManagerPreference(false)
      writePanePreference(MANAGER_KEY, false)
      if (width >= PREVIEW_BREAKPOINT) {
        setPreviewPreference(null)
        writePanePreference(PREVIEW_KEY, null)
      }
    }

    function openPreview() {
      const nextPreviewPreference = true
      setPreviewPreference(nextPreviewPreference)
      writePanePreference(PREVIEW_KEY, nextPreviewPreference)
      if (width < MANAGER_BREAKPOINT) {
        setManagerPreference(false)
        writePanePreference(MANAGER_KEY, false)
      }
    }

    function hidePreview() {
      setPreviewPreference(false)
      writePanePreference(PREVIEW_KEY, false)
    }

    return {
      managerVisible,
      previewVisible,
      managerAutoHidden,
      previewAutoHidden,
      openManager,
      hideManager,
      openPreview,
      hidePreview,
      toggleManager() {
        if (managerVisible) hideManager()
        else openManager()
      },
      togglePreview() {
        if (previewVisible) hidePreview()
        else openPreview()
      },
    }
  }, [managerPreference, previewPreference, width])
}
