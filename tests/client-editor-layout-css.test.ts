import { describe, expect, test } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const themeCss = readFileSync(resolve(__dirname, "../src/client/styles/theme.css"), "utf8")

describe("editor layout CSS regressions", () => {
  test("editor pane has exactly header, flexible body, and compact status rows", () => {
    expect(themeCss).toMatch(/\.editor-pane\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto;/s)
    expect(themeCss).not.toMatch(/\.editor-pane\s*\{[^}]*grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)\s+auto;/s)
  })

  test("editor textarea explicitly fills the flexible body instead of collapsing to a strip", () => {
    expect(themeCss).toMatch(/\.editor-body-shell\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s)
    expect(themeCss).toMatch(/\.editor-textarea\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*resize:\s*none;/s)
    expect(themeCss).toMatch(/\.editor-status-bar\s*\{[^}]*min-height:\s*30px;/s)
  })

  test("editor canvas keeps a full-width redesigned writing surface with subtle header and footer chrome", () => {
    expect(themeCss).toMatch(/\.editor-header\s*\{[^}]*border-bottom:\s*1px\s+solid/s)
    expect(themeCss).toMatch(/\.editor-textarea\s*\{[^}]*max-width:\s*none;[^}]*margin:\s*0;/s)
    expect(themeCss).toMatch(/\.editor-status-bar\s*\{[^}]*background:\s*color-mix\(/s)
  })
})
