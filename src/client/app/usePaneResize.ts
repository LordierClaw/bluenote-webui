import { useCallback, useEffect, useState } from "react"

const MANAGER_WIDTH_KEY = "bluenote-webui.manager-width"
const PREVIEW_WIDTH_KEY = "bluenote-webui.preview-width"
const DEFAULT_MANAGER_WIDTH = 300
const MIN_PANE_WIDTH = 180
const DIVIDER_WIDTH_TOTAL = 8

function viewportWidth(): number {
  if (typeof window === "undefined") return 1440
  return window.visualViewport?.width ?? window.innerWidth
}

export function clampPaneWidth(width: number, availableViewport = viewportWidth()): number {
  const maxPaneWidth = Math.max(MIN_PANE_WIDTH, Math.floor((availableViewport - MIN_PANE_WIDTH - DIVIDER_WIDTH_TOTAL) / 2))
  return Math.min(maxPaneWidth, Math.max(MIN_PANE_WIDTH, width))
}

function readWidth(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? parseInt(raw, 10) : NaN
    return clampPaneWidth(Number.isFinite(parsed) && parsed >= MIN_PANE_WIDTH ? parsed : fallback)
  } catch { return fallback }
}

function saveWidth(key: string, value: number) {
  try { localStorage.setItem(key, String(Math.round(value))) } catch { /* ignore */ }
}

export interface PaneWidths {
  managerWidth: number
  previewWidth: number
  setManagerWidth: (w: number) => void
  setPreviewWidth: (w: number) => void
}

/** Returns stable callbacks to start drag-resize on each divider */
export function usePaneResize(): PaneWidths & {
  onManagerDividerMouseDown: (e: React.MouseEvent) => void
  onPreviewDividerMouseDown: (e: React.MouseEvent) => void
} {
  const [managerWidth, setManagerWidthState] = useState(() => readWidth(MANAGER_WIDTH_KEY, DEFAULT_MANAGER_WIDTH))
  const [previewWidth, setPreviewWidthState] = useState(() => readWidth(PREVIEW_WIDTH_KEY, DEFAULT_MANAGER_WIDTH + 60))

  useEffect(() => {
    const onResize = () => {
      setManagerWidthState((width) => clampPaneWidth(width))
      setPreviewWidthState((width) => clampPaneWidth(width))
    }
    window.addEventListener("resize", onResize)
    window.visualViewport?.addEventListener("resize", onResize)
    onResize()
    return () => {
      window.removeEventListener("resize", onResize)
      window.visualViewport?.removeEventListener("resize", onResize)
    }
  }, [])

  const setManagerWidth = useCallback((w: number) => {
    const clamped = clampPaneWidth(w)
    setManagerWidthState(clamped)
    saveWidth(MANAGER_WIDTH_KEY, clamped)
  }, [])

  const setPreviewWidth = useCallback((w: number) => {
    const clamped = clampPaneWidth(w)
    setPreviewWidthState(clamped)
    saveWidth(PREVIEW_WIDTH_KEY, clamped)
  }, [])

  // Manager divider drag
  const onManagerDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = managerWidth

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX
      setManagerWidth(startW + delta)
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [managerWidth, setManagerWidth])

  // Preview divider drag
  const onPreviewDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = previewWidth

    function onMove(ev: MouseEvent) {
      // Moving divider left increases preview width
      const delta = startX - ev.clientX
      setPreviewWidth(startW + delta)
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [previewWidth, setPreviewWidth])

  return {
    managerWidth,
    previewWidth,
    setManagerWidth,
    setPreviewWidth,
    onManagerDividerMouseDown,
    onPreviewDividerMouseDown,
  }
}
