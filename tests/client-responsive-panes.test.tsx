import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { useResponsivePanes } from "../src/client/app/useResponsivePanes"

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  })
}

function ResponsivePanesHarness() {
  const panes = useResponsivePanes()

  return (
    <div>
      <span data-testid="manager-visible">{String(panes.managerVisible)}</span>
      <span data-testid="preview-visible">{String(panes.previewVisible)}</span>
      <span data-testid="manager-auto-hidden">{String(panes.managerAutoHidden)}</span>
      <span data-testid="preview-auto-hidden">{String(panes.previewAutoHidden)}</span>
      <button type="button" onClick={panes.toggleManager}>Toggle manager</button>
      <button type="button" onClick={panes.togglePreview}>Toggle preview</button>
    </div>
  )
}

describe("useResponsivePanes", () => {
  beforeEach(() => {
    window.localStorage.clear()
    setViewportWidth(1440)
  })

  afterEach(() => {
    window.localStorage.clear()
    setViewportWidth(1440)
  })

  test("auto-hides manager first while keeping preview visible at medium-narrow widths without a saved preference", () => {
    setViewportWidth(820)
    render(<ResponsivePanesHarness />)

    expect(screen.getByTestId("manager-visible")).toHaveTextContent("false")
    expect(screen.getByTestId("preview-visible")).toHaveTextContent("true")
    expect(screen.getByTestId("manager-auto-hidden")).toHaveTextContent("true")
    expect(screen.getByTestId("preview-auto-hidden")).toHaveTextContent("false")
  })

  test("explicit toggles can reopen an auto-hidden pane and persist that preference", () => {
    setViewportWidth(700)
    render(<ResponsivePanesHarness />)

    fireEvent.click(screen.getByRole("button", { name: /toggle manager/i }))

    expect(screen.getByTestId("manager-visible")).toHaveTextContent("true")
    expect(screen.getByTestId("manager-auto-hidden")).toHaveTextContent("false")
    expect(window.localStorage.getItem("bluenote-webui.manager-visible")).toBe("true")
  })

  test("unpinned panes follow viewport changes until the user sets an explicit preference", () => {
    render(<ResponsivePanesHarness />)

    expect(screen.getByTestId("manager-visible")).toHaveTextContent("true")
    expect(screen.getByTestId("preview-visible")).toHaveTextContent("true")

    setViewportWidth(800)
    fireEvent(window, new Event("resize"))

    expect(screen.getByTestId("manager-visible")).toHaveTextContent("false")
    expect(screen.getByTestId("preview-visible")).toHaveTextContent("true")
    expect(screen.getByTestId("manager-auto-hidden")).toHaveTextContent("true")
    expect(screen.getByTestId("preview-auto-hidden")).toHaveTextContent("false")
  })

  test("opening manager at medium-narrow width swaps out preview instead of creating three cramped panes", () => {
    setViewportWidth(820)
    render(<ResponsivePanesHarness />)

    expect(screen.getByTestId("manager-visible")).toHaveTextContent("false")
    expect(screen.getByTestId("preview-visible")).toHaveTextContent("true")

    fireEvent.click(screen.getByRole("button", { name: /toggle manager/i }))

    expect(screen.getByTestId("manager-visible")).toHaveTextContent("true")
    expect(screen.getByTestId("preview-visible")).toHaveTextContent("false")
  })

  test("user-restored manager is not immediately undone by viewport resize events", () => {
    setViewportWidth(820)
    render(<ResponsivePanesHarness />)

    fireEvent.click(screen.getByRole("button", { name: /toggle manager/i }))
    fireEvent(window, new Event("resize"))

    expect(screen.getByTestId("manager-visible")).toHaveTextContent("true")
    expect(screen.getByTestId("preview-visible")).toHaveTextContent("false")
  })

  test("opening preview at medium-narrow width swaps out manager", () => {
    setViewportWidth(820)
    render(<ResponsivePanesHarness />)

    fireEvent.click(screen.getByRole("button", { name: /toggle manager/i }))
    fireEvent.click(screen.getByRole("button", { name: /toggle preview/i }))

    expect(screen.getByTestId("manager-visible")).toHaveTextContent("false")
    expect(screen.getByTestId("preview-visible")).toHaveTextContent("true")
  })
})
