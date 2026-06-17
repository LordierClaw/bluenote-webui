import type { ComponentProps } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/client/app/App"
import { AiWorkspaceDialog } from "../src/client/components/AiWorkspaceDialog"

const apiMocks = vi.hoisted(() => ({
  aiConfig: vi.fn().mockResolvedValue(null),
  aiDescribe: vi.fn().mockResolvedValue(undefined),
  aiQueueDescribe: vi.fn().mockResolvedValue({ key: "note-1", relativePath: "note/alpha.md", enqueued: true, queue: { pending: 1, running: 0, failed: 0 } }),
  aiProcessQueue: vi.fn().mockResolvedValue({ applied: 0, failed: 0, remaining: 0, setupBlocked: false }),
  aiQueue: vi.fn().mockResolvedValue({ jobs: [] }),
  aiStatus: vi.fn().mockResolvedValue({ status: "connected", queue: { pending: 0, running: 0, failed: 0 } }),
  archiveNote: vi.fn().mockResolvedValue(undefined),
  codexAuthStatus: vi.fn().mockResolvedValue(null),
  createFolder: vi.fn(),
  createNote: vi.fn(),
  deleteCodexAuth: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
  folders: vi.fn().mockResolvedValue([{ relativePath: "note", name: "note", noteCount: 1 }]),
  initWorkspace: vi.fn(),
  moveNote: vi.fn(),
  note: vi.fn(),
  notes: vi.fn().mockResolvedValue([{ key: "note-1", title: "Alpha", description: "", relativePath: "note/alpha.md", folder: "note" }]),
  openWorkspace: vi.fn(),
  promoteDraft: vi.fn(),
  rebuild: vi.fn().mockResolvedValue(undefined),
  renameFolder: vi.fn(),
  saveAiConfig: vi.fn().mockResolvedValue(undefined),
  startCodexAuth: vi.fn().mockResolvedValue(undefined),
  startupNote: vi.fn(),
  updateNote: vi.fn(),
  workspace: vi.fn(),
}))

const workspaceHookMock = vi.hoisted(() => vi.fn())
const responsivePanesMock = vi.hoisted(() => vi.fn())
const autosaveMock = vi.hoisted(() => vi.fn())

vi.mock("../src/client/app/api", () => ({ api: apiMocks }))
vi.mock("../src/client/app/useWorkspace", () => ({ useWorkspace: workspaceHookMock }))
vi.mock("../src/client/app/useResponsivePanes", () => ({ useResponsivePanes: responsivePanesMock }))
vi.mock("../src/client/app/useAutosave", () => ({ useAutosave: autosaveMock }))

const note = {
  key: "note-1",
  title: "Alpha",
  description: "",
  relativePath: "note/alpha.md",
  folder: "note" as const,
  body: "Original body",
  createdAt: "2026-06-10T12:00:00.000Z",
  updatedAt: "2026-06-10T12:34:00.000Z",
}

function setupAppMocks() {
  workspaceHookMock.mockReturnValue({
    workspace: { initialized: true, selected: true, rootPath: "/tmp/bluenote", noteCount: 1 },
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
  })
  responsivePanesMock.mockReturnValue({
    managerVisible: true,
    previewVisible: true,
    managerAutoHidden: false,
    previewAutoHidden: false,
    openManager: vi.fn(),
    hideManager: vi.fn(),
    openPreview: vi.fn(),
    hidePreview: vi.fn(),
    toggleManager: vi.fn(),
    togglePreview: vi.fn(),
  })
  autosaveMock.mockImplementation(() => undefined)
  apiMocks.startupNote.mockResolvedValue(note)
  apiMocks.note.mockResolvedValue(note)
  apiMocks.notes.mockResolvedValue([{ key: note.key, title: note.title, description: note.description, relativePath: note.relativePath, folder: note.folder }])
  apiMocks.folders.mockResolvedValue([{ relativePath: "note", name: "note", noteCount: 1 }])
}

function renderDialog(overrides: Partial<ComponentProps<typeof AiWorkspaceDialog>> = {}) {
  const props: ComponentProps<typeof AiWorkspaceDialog> = {
    open: true,
    onClose: vi.fn(),
    status: { status: "connected", provider: "openai-compatible", model: "test-model", queue: { pending: 1, running: 0, failed: 0 } },
    config: { configured: true, enabled: true, provider: "openai-compatible", model: "test-model", baseUrl: "https://api.example/v1", apiKeyMasked: "sk-***-safe", maxAttempts: 3, outputLanguage: "English" },
    queue: { jobs: [{ kind: "describe-note", key: "note-1", relativePath: "note/alpha.md", status: "pending", attempts: 0, lastError: null, updatedAt: "2026-06-10T12:34:00.000Z" }] },
    codexAuth: null,
    onRefresh: vi.fn().mockResolvedValue(undefined),
    onSaveConfig: vi.fn().mockResolvedValue(undefined),
    onDescribeCurrentNote: vi.fn().mockResolvedValue(undefined),
    onProcessQueue: vi.fn().mockResolvedValue({ applied: 2, failed: 1, remaining: 3, setupBlocked: false }),
    onStartCodexAuth: vi.fn().mockResolvedValue(undefined),
    onLogoutCodex: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<AiWorkspaceDialog {...props} />)
  return props
}

afterEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe("AI browser queue controls", () => {
  test("current note describe enqueues via api.aiQueueDescribe and keeps the note selected", async () => {
    setupAppMocks()
    render(<App />)

    await waitFor(() => expect(screen.getByLabelText(/note body/i)).toHaveValue(note.body))
    await userEvent.click(screen.getByRole("button", { name: /open ai status and configuration/i }))
    await userEvent.click(await screen.findByRole("tab", { name: /queue/i }))
    await userEvent.click(screen.getByRole("button", { name: /queue current note/i }))

    await waitFor(() => expect(apiMocks.aiQueueDescribe).toHaveBeenCalledWith({ selector: note.key }))
    expect(apiMocks.aiDescribe).not.toHaveBeenCalled()
    expect(apiMocks.note).toHaveBeenLastCalledWith(note.key)
    expect(screen.getByLabelText(/note body/i)).toHaveValue(note.body)
  })

  test("dialog queue actions show queue-first notices and process queue summary", async () => {
    const onDescribeCurrentNote = vi.fn().mockResolvedValue(undefined)
    const onProcessQueue = vi.fn().mockResolvedValue({ applied: 2, failed: 1, remaining: 3, setupBlocked: false })
    renderDialog({ onDescribeCurrentNote, onProcessQueue })

    await userEvent.click(screen.getByRole("tab", { name: /queue/i }))
    await userEvent.click(screen.getByRole("button", { name: /queue current note/i }))
    expect(onDescribeCurrentNote).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("status")).toHaveTextContent(/queued/i)

    await userEvent.click(screen.getByRole("button", { name: /run queued jobs/i }))
    expect(onProcessQueue).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("status")).toHaveTextContent(/applied 2, failed 1, remaining 3/i)
  })

  test("process queue setup-blocked result tells the user when auth is required", async () => {
    renderDialog({
      status: { status: "auth-required", provider: "codex", model: "gpt-codex", queue: { pending: 2, running: 0, failed: 0 }, message: "Authentication required before background jobs can run." },
      onProcessQueue: vi.fn().mockResolvedValue({ applied: 0, failed: 0, remaining: 2, setupBlocked: true }),
    })

    await userEvent.click(screen.getByRole("tab", { name: /queue/i }))
    await userEvent.click(screen.getByRole("button", { name: /run queued jobs/i }))

    expect(await screen.findByRole("status")).toHaveTextContent(/auth.*required|setup.*blocked/i)
  })

  test("config panel does not render raw API key material", async () => {
    const rawSecret = "sk-raw-secret-value"
    renderDialog({
      config: {
        configured: true,
        enabled: true,
        provider: "openai-compatible",
        model: "gpt-test",
        baseUrl: "https://api.example/v1",
        apiKeyMasked: "sk-***-safe",
        maxAttempts: 3,
        outputLanguage: "English",
        ...( { apiKey: rawSecret } as object ),
      },
    })

    await userEvent.click(screen.getByRole("tab", { name: /config/i }))
    expect(screen.queryByDisplayValue(rawSecret)).not.toBeInTheDocument()
    expect(screen.queryByText(rawSecret)).not.toBeInTheDocument()
    expect(screen.getByLabelText("API Key", { selector: "input" })).toHaveValue("")
  })
})
