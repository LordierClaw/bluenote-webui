import fs from "node:fs"
import path from "node:path"

import { createBlueNoteCore, resolveBlueNoteRoot, type ResolveBlueNoteRootOptions } from "@lordierclaw/bluenote-core"
import type { WorkspaceStatus } from "../../shared/types.js"
import { HttpError } from "./http.js"

let selectedRootPath: string | undefined

export function getSelectedRootPath(): string | undefined {
  return selectedRootPath
}

export function defaultWorkspaceRoot(options: ResolveBlueNoteRootOptions = {}): string {
  return resolveBlueNoteRoot(options)
}

export function requireWorkspaceRoot(): string {
  if (!selectedRootPath) {
    throw new HttpError(409, "workspace_not_open", "Open or initialize a BlueNote workspace first.")
  }
  return selectedRootPath
}

function hasInternalStateSegment(input: string): boolean {
  return input
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .some((segment) => segment === ".data" || segment === ".state")
}

export function normalizeWorkspacePath(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new HttpError(400, "invalid_path", "Workspace path is required.")
  }
  if (hasInternalStateSegment(input)) {
    throw new HttpError(400, "invalid_path", "Choose a BlueNote root directory, not a hidden internal file or directory.")
  }
  return path.resolve(input)
}

export function workspaceStatus(): WorkspaceStatus {
  if (!selectedRootPath) {
    return { selected: false, initialized: false, defaultRootPath: defaultWorkspaceRoot(), message: "No workspace selected." }
  }
  const initialized = fs.existsSync(path.join(selectedRootPath, "note")) && fs.existsSync(path.join(selectedRootPath, ".data"))
  let noteCount: number | undefined
  if (initialized) {
    try {
      const core = createBlueNoteCore({ rootPath: selectedRootPath })
      try {
        noteCount = core.notes.list({ visibility: "all" }).length
      } catch {
        core.rebuild()
        noteCount = core.notes.list({ visibility: "all" }).length
      }
    } catch {
      noteCount = undefined
    }
  }
  return { selected: true, initialized, rootPath: selectedRootPath, defaultRootPath: defaultWorkspaceRoot(), noteCount }
}

export function openWorkspace(rootPathInput: unknown): WorkspaceStatus {
  const rootPath = normalizeWorkspacePath(rootPathInput)
  if (!fs.existsSync(rootPath)) {
    throw new HttpError(404, "workspace_missing", "Workspace path does not exist.")
  }
  const status = fs.statSync(rootPath)
  if (!status.isDirectory()) {
    throw new HttpError(400, "workspace_not_directory", "Workspace path must be a directory.")
  }
  selectedRootPath = rootPath
  return workspaceStatus()
}

export function initWorkspace(rootPathInput: unknown): WorkspaceStatus {
  const rootPath = normalizeWorkspacePath(rootPathInput)
  fs.mkdirSync(rootPath, { recursive: true })
  createBlueNoteCore({ rootPath }).init()
  selectedRootPath = rootPath
  return workspaceStatus()
}

export function autoOpenOrInitDefaultWorkspace(options: ResolveBlueNoteRootOptions = {}): WorkspaceStatus {
  if (selectedRootPath) return workspaceStatus()
  const rootPath = defaultWorkspaceRoot(options)
  if (fs.existsSync(rootPath)) {
    selectedRootPath = rootPath
    const status = workspaceStatus()
    if (status.initialized) return status
  }
  fs.mkdirSync(rootPath, { recursive: true })
  createBlueNoteCore({ rootPath }).init()
  selectedRootPath = rootPath
  return workspaceStatus()
}

export function resetWorkspaceForTests(): void {
  selectedRootPath = undefined
}
