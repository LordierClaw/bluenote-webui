import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/client/app/App"

const apiMocks = vi.hoisted(() => ({
  aiConfig: vi.fn().mockResolvedValue(null),
  aiDescribe: vi.fn().mockResolvedValue(undefined),
  aiQueueDescribe: vi.fn().mockResolvedValue({ key: "alpha", relativePath: "note/alpha.md", enqueued: true, queue: { pending: 1, running: 0, failed: 0 } }),
  aiProcessQueue: vi.fn().mockResolvedValue({ applied: 0, failed: 0, remaining: 0, setupBlocked: false }),
  aiQueue: vi.fn().mockResolvedValue({ jobs: [] }),
  aiStatus: vi.fn().mockResolvedValue({ status: "connected", queue: { pending: 0, running: 0, failed: 0 } }),
  archiveNote: vi.fn().mockResolvedValue(undefined),
  codexAuthStatus: vi.fn().mockResolvedValue(null),
  createFolder: vi.fn(),
  createNote: vi.fn(),
  deleteCodexAuth: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
  folders: vi.fn().mockResolvedValue([{ relativePath: "note", name: "note", noteCount: 2 }]),
  initWorkspace: vi.fn(),
  moveNote: vi.fn(),
  note: vi.fn(),
  notes: vi.fn(),
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

type TestNote = {
  key: string
  title: string
  description: string
  relativePath: string
  folder: "note" | "draft" | "archive"
  body: string
  createdAt: string
  updatedAt: string
}

function makeNote(overrides: Partial<TestNote> = {}): TestNote {
  return {
    key: "alpha",
    title: "Alpha",
    description: "",
    relativePath: "note/alpha.md",
    folder: "note",
    body: "Alpha body",
    createdAt: "2026-06-10T12:00:00.000Z",
    updatedAt: "2026-06-10T12:34:00.000Z",
    ...overrides,
  }
}

const alpha = makeNote()
const beta = makeNote({ key: "beta", title: "Beta", relativePath: "note/beta.md", body: "Beta body" })

function setupApp() {
  workspaceHookMock.mockReturnValue({
    workspace: { initialized: true, selected: true, rootPath: "/tmp/bluenote", noteCount: 2 },
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
  apiMocks.startupNote.mockResolvedValue(alpha)
  apiMocks.note.mockImplementation(async (key: string) => key === beta.key ? beta : alpha)
  apiMocks.notes.mockResolvedValue([
    { key: alpha.key, title: alpha.title, description: alpha.description, relativePath: alpha.relativePath, folder: alpha.folder },
    { key: beta.key, title: beta.title, description: beta.description, relativePath: beta.relativePath, folder: beta.folder },
  ])
  apiMocks.folders.mockResolvedValue([{ relativePath: "note", name: "note", noteCount: 2 }])
  apiMocks.updateNote.mockImplementation(async (key: string, request: { body: string; title?: string }) => ({
    ...(key === beta.key ? beta : alpha),
    title: request.title ?? (key === beta.key ? beta.title : alpha.title),
    body: request.body,
  }))
}

async function renderLoadedApp() {
  const view = render(<App />)
  const textarea = await screen.findByLabelText(/note body/i)
  await waitFor(() => expect(textarea).toHaveValue(alpha.body))
  apiMocks.aiQueueDescribe.mockClear()
  apiMocks.aiProcessQueue.mockClear()
  return { textarea, unmount: view.unmount, rerender: view.rerender }
}

function latestAutosaveCallback() {
  const call = autosaveMock.mock.calls.at(-1)
  if (!call) throw new Error("useAutosave was not called")
  return call[2] as () => Promise<void>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function editAndSave(nextBody: string) {
  const textarea = screen.getByLabelText(/note body/i)
  fireEvent.change(textarea, { target: { value: nextBody } })
  await flushPromises()
  fireEvent.click(screen.getByRole("button", { name: /save \(ctrl\+s\)/i }))
  await flushPromises()
  expect(apiMocks.updateNote).toHaveBeenLastCalledWith(alpha.key, { body: nextBody })
  expect(screen.getByLabelText(/note body/i)).toHaveValue(nextBody)
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  setupApp()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe("browser AI idle/open-note scheduling", () => {
  test("successful editor save schedules AI enqueue after 10 seconds and then drains queue in the background", async () => {
    await renderLoadedApp()
    vi.useFakeTimers()

    await editAndSave("Alpha body edited")

    expect(apiMocks.aiQueueDescribe).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(apiMocks.aiQueueDescribe).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    await flushPromises()
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledWith({ selector: alpha.key })
    expect(apiMocks.aiProcessQueue).toHaveBeenCalledTimes(1)
  })

  test("continued editor edits reset the timer and enqueue exactly one latest note job", async () => {
    await renderLoadedApp()
    vi.useFakeTimers()

    await editAndSave("First saved body")
    await vi.advanceTimersByTimeAsync(9_000)
    await editAndSave("Second saved body")
    await vi.advanceTimersByTimeAsync(9_999)
    expect(apiMocks.aiQueueDescribe).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    await flushPromises()
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledTimes(1)
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledWith({ selector: alpha.key })
  })

  test("manager title saves use a 5 second idle delay", async () => {
    await renderLoadedApp()

    const actionBar = await screen.findByRole("toolbar", { name: /manager actions for alpha/i })
    fireEvent.click(within(actionBar).getByRole("button", { name: /^rename$/i }))
    const titleInput = await screen.findByRole("textbox", { name: /title/i })
    vi.useFakeTimers()
    fireEvent.change(titleInput, { target: { value: "Alpha renamed" } })
    await flushPromises()
    fireEvent.submit(titleInput.closest("form")!)
    await flushPromises()
    expect(apiMocks.updateNote).toHaveBeenLastCalledWith(alpha.key, { title: "Alpha renamed", body: alpha.body })

    await vi.advanceTimersByTimeAsync(4_999)
    expect(apiMocks.aiQueueDescribe).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledWith({ selector: alpha.key })
  })

  test("opening another note flushes pending saved-note AI work before selecting the next note", async () => {
    await renderLoadedApp()
    const betaButton = await screen.findByRole("button", { name: /normal note beta/i })
    vi.useFakeTimers()
    await editAndSave("Alpha before switch")

    fireEvent.click(betaButton)

    await flushPromises()
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledWith({ selector: alpha.key })
    expect(screen.getByLabelText(/note body/i)).toHaveValue(beta.body)
    const enqueueOrder = apiMocks.aiQueueDescribe.mock.invocationCallOrder[0]
    const betaNoteCall = apiMocks.note.mock.invocationCallOrder.find((_, index) => apiMocks.note.mock.calls[index]?.[0] === beta.key)
    expect(betaNoteCall).toBeDefined()
    expect(enqueueOrder).toBeLessThan(betaNoteCall!)
  })

  test("save failures do not enqueue", async () => {
    apiMocks.updateNote.mockRejectedValueOnce(new Error("disk full"))
    await renderLoadedApp()

    const textarea = screen.getByLabelText(/note body/i)
    fireEvent.change(textarea, { target: { value: "Will fail" } })
    await flushPromises()
    fireEvent.click(screen.getByRole("button", { name: /save \(ctrl\+s\)/i }))
    await flushPromises()
    expect(apiMocks.updateNote).toHaveBeenCalledWith(alpha.key, { body: "Will fail" })

    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(apiMocks.aiQueueDescribe).not.toHaveBeenCalled()
  })



  test("autosave completion schedules the editor idle AI enqueue", async () => {
    await renderLoadedApp()
    vi.useFakeTimers()

    const textarea = screen.getByLabelText(/note body/i)
    fireEvent.change(textarea, { target: { value: "Autosaved body" } })
    await flushPromises()
    await act(async () => { await latestAutosaveCallback()() })

    expect(apiMocks.updateNote).toHaveBeenLastCalledWith(alpha.key, { body: "Autosaved body" })
    await vi.advanceTimersByTimeAsync(9_999)
    expect(apiMocks.aiQueueDescribe).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledWith({ selector: alpha.key })
  })

  test("unmount clears pending idle enqueue timers", async () => {
    const { unmount } = await renderLoadedApp()
    vi.useFakeTimers()

    await editAndSave("Pending before unmount")
    unmount()
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()

    expect(apiMocks.aiQueueDescribe).not.toHaveBeenCalled()
  })

  test("workspace close clears pending idle enqueue timers", async () => {
    const { rerender } = await renderLoadedApp()
    vi.useFakeTimers()

    await editAndSave("Pending before workspace close")
    workspaceHookMock.mockReturnValue({
      workspace: { initialized: false, selected: false, rootPath: null, noteCount: 0 },
      loading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(undefined),
    })
    rerender(<App />)
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()

    expect(apiMocks.aiQueueDescribe).not.toHaveBeenCalled()
  })

  test("new idle work requests a follow-up drain when queue processing is already in flight", async () => {
    await renderLoadedApp()
    vi.useFakeTimers()
    const firstDrain = deferred<{ applied: number; failed: number; remaining: number; setupBlocked: boolean }>()
    apiMocks.aiProcessQueue.mockReturnValueOnce(firstDrain.promise)

    await editAndSave("First queued drain")
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledTimes(1)
    expect(apiMocks.aiProcessQueue).toHaveBeenCalledTimes(1)

    await editAndSave("Second queued while processing")
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledTimes(2)
    expect(apiMocks.aiProcessQueue).toHaveBeenCalledTimes(1)

    firstDrain.resolve({ applied: 1, failed: 0, remaining: 1, setupBlocked: false })
    await flushPromises()
    expect(apiMocks.aiProcessQueue).toHaveBeenCalledTimes(2)
  })

  test("opening a folder does not drop pending saved-note AI work", async () => {
    await renderLoadedApp()
    vi.useFakeTimers()

    await editAndSave("Pending before folder navigation")
    fireEvent.click(screen.getByRole("button", { name: /parent folder workspace root/i }))
    await flushPromises()

    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledWith({ selector: alpha.key })
  })

  test("enqueue failure does not roll back successful save state", async () => {
    apiMocks.aiQueueDescribe.mockRejectedValueOnce(new Error("provider unavailable"))
    await renderLoadedApp()
    vi.useFakeTimers()

    await editAndSave("Saved even if enqueue fails")
    await vi.advanceTimersByTimeAsync(10_000)

    await flushPromises()
    expect(apiMocks.aiQueueDescribe).toHaveBeenCalledWith({ selector: alpha.key })
    expect(screen.getByLabelText(/note body/i)).toHaveValue("Saved even if enqueue fails")
    expect(screen.getByLabelText(/editor status bar/i)).toHaveTextContent(/saved/i)
  })
})
