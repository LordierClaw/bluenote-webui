import { describe, expect, test } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const themeCss = readFileSync(resolve(__dirname, "../src/client/styles/theme.css"), "utf8")

type CssRule = {
  selectors: string[]
  declarations: Map<string, string>
}

const parseRules = (css: string): CssRule[] => {
  const rules: CssRule[] = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null

  while ((match = rulePattern.exec(css)) !== null) {
    const selectorText = match[1]
      .replace(/@media[^{}]*$/g, "")
      .trim()

    if (!selectorText || selectorText.startsWith("@")) {
      continue
    }

    const selectors = selectorText
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean)

    const declarations = new Map<string, string>()
    for (const declaration of match[2].split(";")) {
      const separatorIndex = declaration.indexOf(":")
      if (separatorIndex === -1) {
        continue
      }

      const property = declaration.slice(0, separatorIndex).trim()
      const value = declaration.slice(separatorIndex + 1).trim()
      if (property && value) {
        declarations.set(property, value)
      }
    }

    rules.push({ selectors, declarations })
  }

  return rules
}

const rules = parseRules(themeCss)

const declarationFor = (selector: string, property: string): string => {
  const value = rules
    .filter((candidate) => candidate.selectors.includes(selector))
    .map((candidate) => candidate.declarations.get(property))
    .find((candidate): candidate is string => candidate !== undefined)

  expect(
    value,
    `Expected CSS rule for ${selector} to define ${property}`,
  ).toBeDefined()

  return value as string
}

const rootToken = (selector: string, token: string): string => declarationFor(selector, token)

const numericCssValue = (value: string, unit: "px" | "rem"): number => {
  const match = value.match(new RegExp(`^(-?\\d+(?:\\.\\d+)?)${unit}$`))

  expect(match, `Expected CSS value ${value} to be a ${unit} length`).not.toBeNull()
  return Number(match?.[1])
}

describe("visual CSS layout contracts", () => {
  test("theme tokens keep light surfaces distinct while preserving dark raised shells", () => {
    expect(rootToken(":root", "--surface")).toBe("#ffffff")
    expect(rootToken(":root", "--surface-muted")).toBe("#eef2f7")
    expect(rootToken(":root", "--surface-raised")).toBe("#fcfdff")
    expect(rootToken(":root", "--line")).toBe("#c6d2df")
    expect(rootToken(":root[data-theme=\"dark\"]", "--surface")).toBe("#0f172a")
    expect(rootToken(":root[data-theme=\"dark\"]", "--surface-raised")).toBe("#10182b")
    expect(rootToken(":root[data-theme=\"dark\"]", "--line")).toBe("#243244")
  })

  test("raised controls and editing surfaces derive elevation from theme shadow tokens", () => {
    expect(declarationFor(".topbar-controls", "box-shadow")).toMatch(/var\(--shadow\)/)
    expect(declarationFor(".action-box", "box-shadow")).toMatch(/var\(--shadow-strong\)/)
  })
  test("dialog surfaces share a raised shell with compact internal rhythm", () => {
    expect(
      declarationFor(".action-backdrop", "padding"),
      "Expected .action-backdrop to keep dialogs comfortably below the top chrome",
    ).toBe("24px")

    expect(
      declarationFor(".action-box", "box-shadow"),
      "Expected .action-box to use a raised shadow token instead of flat inline panels",
    ).toMatch(/shadow-strong/)
    expect(
      declarationFor(".action-box-body", "display"),
      "Expected .action-box-body to provide a shared body wrapper for dialog content",
    ).toBe("grid")
    expect(
      declarationFor(".action-box-close", "border-radius"),
      "Expected .action-box-close to use the shared round close affordance",
    ).toMatch(/999px/)
  })

  test("desktop grid keeps manager compact while giving editor and preview serious workspace", () => {
    const defaultColumns = declarationFor(".main-grid", "grid-template-columns")
    expect(
      defaultColumns,
      "Expected .main-grid to start with a compact manager column followed by equal editor and preview workspaces",
    ).toMatch(/^(?:260|270|280)px\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)$/)

    const managerHiddenColumns = declarationFor(
      ".main-grid.manager-hidden",
      "grid-template-columns",
    )
    expect(
      managerHiddenColumns,
      "Expected .main-grid.manager-hidden to split the workspace evenly between editor and preview",
    ).toMatch(/^minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)$/)
  })

  test("tablet-width shell keeps the workspace path on its own row and preserves an editor-first split", () => {
    expect(themeCss).toMatch(/@media \(max-width: 920px\) \{[\s\S]*\.topbar \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[\s\S]*\.topbar-workspace \{[\s\S]*grid-column:\s*1\s*\/\s*-1;[\s\S]*\.main-grid\.manager-hidden\.preview-visible \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.[0-9]+fr\)\s+minmax\((?:260|280|300)px,\s*0\.[0-9]+fr\);/s)
  })

  test("tablet manager layout overrides only hidden-preview grids", () => {
    expect(themeCss).toMatch(/@media \(min-width: 768px\) and \(max-width: 1023px\) \{[\s\S]*\.main-grid\.manager-visible\.preview-hidden \{[\s\S]*grid-template-columns:\s*var\(--sidebar-w\)\s+4px\s+minmax\(0,\s*1fr\)\s*!important;[\s\S]*\.main-grid\.manager-hidden\.preview-hidden \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/s)
    expect(themeCss).not.toMatch(/@media \(min-width: 768px\) and \(max-width: 1023px\) \{[\s\S]*\.preview-pane \{\s*display:\s*none\s*!important;/s)
  })

  test("mobile controls can reveal rendered manager and preview panes", () => {
    expect(themeCss).not.toMatch(/@media \(max-width: 767px\) \{[\s\S]*\.(?:folder-manager|preview-pane) \{\s*display:\s*none;?[\s\S]*\}/s)
    expect(themeCss).toMatch(/@media \(max-width: 767px\) \{[\s\S]*\.pane-divider \{\s*display:\s*none;?[\s\S]*\}/s)
  })

  test("editor canvas remains dominant", () => {
    expect(
      declarationFor(".editor-pane", "grid-template-rows"),
      "Expected .editor-pane to allocate header, dominant flexible canvas, and compact status bar",
    ).toBe("auto minmax(0, 1fr) auto")

    expect(
      declarationFor(".editor-textarea", "height"),
      "Expected .editor-textarea to fill the flexible editor canvas",
    ).toBe("100%")
    expect(
      declarationFor(".editor-textarea", "overflow"),
      "Expected .editor-textarea to scroll instead of forcing the canvas to grow",
    ).toBe("auto")

    const statusBarMinHeight = numericCssValue(
      declarationFor(".editor-status-bar", "min-height"),
      "px",
    )
    expect(
      statusBarMinHeight,
      "Expected .editor-status-bar min-height to stay compact but touch-friendly",
    ).toBeGreaterThanOrEqual(26)
    expect(statusBarMinHeight).toBeLessThanOrEqual(34)
  })

  test("manager rows show title, filename, and description with truncation", () => {
    expect(
      declarationFor(".navigation-item", "grid-template-columns"),
      "Expected .navigation-item to reserve an icon column and let note metadata truncate in remaining space",
    ).toMatch(/1\.15rem\s+minmax\(0,\s*1fr\)/)

    expect(
      declarationFor(".nav-title", "text-overflow"),
      "Expected .nav-title to truncate long note titles",
    ).toBe("ellipsis")
    expect(
      declarationFor(".nav-file", "font-family"),
      "Expected .nav-file to use a monospace filename treatment",
    ).toMatch(/ui-monospace/)
    expect(
      declarationFor(".nav-description", "text-overflow"),
      "Expected .nav-description to truncate long note descriptions",
    ).toBe("ellipsis")
  })

  test("preview typography has distinct markdown reading scale", () => {
    const previewLineHeight = Number(declarationFor(".markdown-preview", "line-height"))
    expect(
      previewLineHeight,
      "Expected .markdown-preview line-height to be a readable markdown scale",
    ).toBeGreaterThanOrEqual(1.6)
    expect(previewLineHeight).toBeLessThanOrEqual(1.8)

    const h1FontSize = numericCssValue(
      declarationFor(".markdown-preview h1", "font-size"),
      "rem",
    )
    expect(
      h1FontSize,
      "Expected .markdown-preview h1 to be distinct from body text without overpowering the pane",
    ).toBeGreaterThanOrEqual(1.3)
    expect(h1FontSize).toBeLessThanOrEqual(1.7)

    expect(
      declarationFor(".markdown-preview pre", "overflow"),
      "Expected .markdown-preview pre blocks to scroll overflowing code horizontally/vertically",
    ).toBe("auto")

    const articleMaxWidth = numericCssValue(
      declarationFor(".preview-pane__article", "max-width"),
      "rem",
    )
    expect(
      articleMaxWidth,
      "Expected .preview-pane__article to keep the reading surface narrower than the full pane width",
    ).toBeGreaterThanOrEqual(40)
    expect(articleMaxWidth).toBeLessThanOrEqual(80)

    expect(
      declarationFor(".preview-pane-header", "align-items"),
      "Expected .preview-pane-header to use a compact centered header instead of mirroring the editor chrome",
    ).toBe("center")

    expect(
      declarationFor(".preview-pane__context-path", "font-family"),
      "Expected .preview-pane__context-path to keep note path context in a quiet monospace treatment",
    ).toMatch(/ui-monospace/)
  })
})
