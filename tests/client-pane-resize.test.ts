import { describe, expect, test } from "vitest"

import { clampPaneWidth } from "../src/client/app/usePaneResize"

describe("pane resize constraints", () => {
  test("clamps restored wide-monitor pane widths to the current viewport", () => {
    expect(clampPaneWidth(1200, 800)).toBe(306)
    expect(clampPaneWidth(900, 1024)).toBe(418)
  })

  test("keeps panes at least minimally usable on narrow viewports", () => {
    expect(clampPaneWidth(80, 360)).toBe(180)
    expect(clampPaneWidth(240, 360)).toBe(180)
  })
})
