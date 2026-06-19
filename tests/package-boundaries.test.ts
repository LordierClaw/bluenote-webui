import { describe, expect, test } from "vitest"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

interface PackageJson {
  name: string
  repository?: { type?: string; url?: string }
  bin?: Record<string, string>
  files?: string[]
  scripts?: Record<string, string>
  exports?: Record<string, unknown>
}

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

describe("package metadata", () => {
  test("uses the public scoped package name while preserving bin and export contracts", async () => {
    const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as PackageJson

    expect(pkg.name).toBe("@lordierclaw/bluenote-webui")
    expect(pkg.repository).toEqual({
      type: "git",
      url: "https://github.com/LordierClaw/bluenote-webui",
    })
    expect(pkg.bin?.["bluenote-webui"]).toBe("./bin/bluenote-webui.js")
    expect(pkg.files).toEqual(expect.arrayContaining(["bin", "dist", "README.md", "LICENSE", "package.json"]))
    expect(pkg.exports).toEqual(expect.objectContaining({
      ".": expect.objectContaining({ import: "./dist/src/command.js" }),
      "./command": expect.objectContaining({ import: "./dist/src/command.js" }),
      "./server": expect.objectContaining({ import: "./dist/src/server/index.js" }),
      "./package.json": "./package.json",
    }))
    expect(pkg.scripts?.clean).toMatch(/dist/)
    expect(pkg.scripts?.build).toMatch(/npm run clean/)
  })

  test("README documents the scoped package name for install and imports", async () => {
    const readme = await readFile(path.join(repoRoot, "README.md"), "utf8")

    expect(readme).toContain("npm install -g @lordierclaw/bluenote-webui")
    expect(readme).toContain('from "@lordierclaw/bluenote-webui"')
    expect(readme).not.toContain("npm install -g bluenote-webui")
    expect(readme).not.toContain('from "bluenote-webui"')
  })
})

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
