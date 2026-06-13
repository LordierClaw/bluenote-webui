import { describe, expect, test } from "vitest"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function collectProductionTsFiles(relativeDir: string): Promise<string[]> {
  const absoluteDir = path.join(repoRoot, relativeDir)
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(absoluteDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectProductionTsFiles(path.relative(repoRoot, entryPath)))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(path.relative(repoRoot, entryPath))
    }
  }

  return files.sort()
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  const importExportPattern = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
  const dynamicImportPattern = /import\(\s*["']([^"']+)["']\s*\)/g

  for (const match of source.matchAll(importExportPattern)) {
    specifiers.push(match[1])
  }

  for (const match of source.matchAll(dynamicImportPattern)) {
    specifiers.push(match[1])
  }

  return specifiers
}

describe("package boundary enforcement", () => {
  test("production code does not import sibling package source or dist internals", async () => {
    const files = await collectProductionTsFiles("src")
    const violations: string[] = []

    for (const file of files) {
      const source = await readFile(path.join(repoRoot, file), "utf8")
      const forbidden = importSpecifiers(source).filter((specifier) =>
        specifier.includes("bluenote-core/src") ||
        specifier.includes("bluenote-core/dist") ||
        specifier.includes("bluenote-term/src") ||
        specifier.includes("bluenote-term/dist") ||
        specifier.includes("bluenote-webui/src") ||
        specifier.includes("bluenote-webui/dist"),
      )

      if (forbidden.length > 0) {
        violations.push(`${file}: ${forbidden.join(", ")}`)
      }
    }

    expect(violations).toEqual([])
  })
})
