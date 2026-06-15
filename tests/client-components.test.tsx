import { useState } from "react"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { SetupScreen } from "../src/client/components/SetupScreen"
import { NoteList } from "../src/client/components/NoteList"
import { EditorPane } from "../src/client/components/EditorPane"
import { CommandPalette } from "../src/client/components/CommandPalette"
import { FolderManager } from "../src/client/components/FolderManager"
import { PreviewPane } from "../src/client/components/PreviewPane"
import { ActionDialog } from "../src/client/components/ActionDialog"
import { AppShell } from "../src/client/components/AppShell"
import { AiWorkspaceDialog } from "../src/client/components/AiWorkspaceDialog"
import { ShellActionBar } from "../src/client/components/ShellActionBar"
import { App, isEditableTarget } from "../src/client/app/App"
import { createNavigationHistory, noteFolderFromRelativePath } from "../src/client/app/navigationHistory"
import { useThemePreference } from "../src/client/app/useThemePreference"

const apiMocks = vi.hoisted(() => ({
  aiConfig: vi.fn().mockResolvedValue(null),
  aiDescribe: vi.fn().mockResolvedValue(undefined),
  aiProcessQueue: vi.fn().mockResolvedValue({ applied: 0, failed: 0, remaining: 0, setupBlocked: false }),
  aiQueue: vi.fn().mockResolvedValue({ jobs: [] }),
  aiStatus: vi.fn().mockResolvedValue(null),
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

function makeNote(overrides: Partial<{
  key: string
  title: string
  description: string
  relativePath: string
  folder: "note" | "draft"
  body: string
  createdAt: string
  updatedAt: string
}> = {}) {
  return {
    key: "note-1",
    title: "Alpha",
    description: "",
    relativePath: "note/alpha.md",
    folder: "note" as const,
    body: "Original body",
    createdAt: "2026-06-10T12:00:00.000Z",
    updatedAt: "2026-06-10T12:34:00.000Z",
    ...overrides,
  }
}

async function renderAppWithStartupNote(startupNote = makeNote()) {
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
    toggleManager: vi.fn(),
    togglePreview: vi.fn(),
  })
  autosaveMock.mockImplementation(() => undefined)
  apiMocks.aiStatus.mockResolvedValue(null)
  apiMocks.aiConfig.mockResolvedValue(null)
  apiMocks.aiQueue.mockResolvedValue({ jobs: [] })
  apiMocks.codexAuthStatus.mockResolvedValue(null)
  apiMocks.folders.mockResolvedValue([{ relativePath: "note", name: "note", noteCount: 1 }])
  apiMocks.notes.mockResolvedValue([{ key: startupNote.key, title: startupNote.title, description: startupNote.description, relativePath: startupNote.relativePath, folder: startupNote.folder }])
  apiMocks.startupNote.mockResolvedValue(startupNote)
  apiMocks.note.mockResolvedValue(startupNote)
  apiMocks.updateNote.mockImplementation(async (_key: string, body: { body: string; title?: string }) => ({
    ...startupNote,
    ...body,
    body: body.body,
    title: body.title ?? startupNote.title,
  }))

  render(<App />)
  const textarea = await screen.findByLabelText(/note body/i)
  await waitFor(() => expect(textarea).toHaveValue(startupNote.body))
  return { textarea }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ""
})

describe("client scaffolding", () => {
  test("app shell exposes a light and dark theme toggle", async () => {
    const onToggleTheme = vi.fn()
    render(<AppShell
      workspace={{ initialized: true, rootPath: "/tmp/bluenote", noteCount: 2 }}
      aiStatus={{ status: "disabled" }}
      noteCount={2}
      theme="light"
      panes={{
        managerVisible: true,
        previewVisible: true,
        managerAutoHidden: false,
        previewAutoHidden: false,
        openManager: () => undefined,
        hideManager: () => undefined,
        openPreview: () => undefined,
        hidePreview: () => undefined,
        toggleManager: () => undefined,
        togglePreview: () => undefined,
      }}
      onToggleTheme={onToggleTheme}
      onPalette={() => undefined}
      onAi={() => undefined}
    >
      <div />
    </AppShell>)

    await userEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }))
    expect(onToggleTheme).toHaveBeenCalled()
  })

  test("app shell keeps AI entrypoint framed as status and configuration", () => {
    const onAi = vi.fn()

    render(<AppShell
      workspace={{ initialized: true, rootPath: "/tmp/bluenote", noteCount: 2 }}
      aiStatus={{ status: "running", queue: { pending: 2, running: 1, failed: 0 } }}
      noteCount={2}
      theme="light"
      panes={{
        managerVisible: true,
        previewVisible: true,
        managerAutoHidden: false,
        previewAutoHidden: false,
        openManager: () => undefined,
        hideManager: () => undefined,
        openPreview: () => undefined,
        hidePreview: () => undefined,
        toggleManager: () => undefined,
        togglePreview: () => undefined,
      }}
      onToggleTheme={() => undefined}
      onPalette={() => undefined}
      onAi={onAi}
    >
      <div />
    </AppShell>)

    const aiButton = screen.getByRole("button", { name: /open ai status and configuration/i })
    expect(aiButton).toHaveTextContent(/^ai/i)
    expect(aiButton).toHaveTextContent(/1 running/i)
  })

  test("theme preference persists and updates the document theme", async () => {
    window.localStorage.setItem("bluenote-webui-theme", "dark")

    function ThemeHarness() {
      const { theme, toggleTheme } = useThemePreference()
      return <button onClick={toggleTheme}>{theme}</button>
    }

    render(<ThemeHarness />)

    expect(screen.getByRole("button", { name: "dark" })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(document.documentElement.style.colorScheme).toBe("dark")

    await userEvent.click(screen.getByRole("button", { name: "dark" }))

    expect(screen.getByRole("button", { name: "light" })).toBeInTheDocument()
    expect(window.localStorage.getItem("bluenote-webui-theme")).toBe("light")
    expect(document.documentElement.dataset.theme).toBe("light")
    expect(document.documentElement.style.colorScheme).toBe("light")
  })

  test("theme preference ignores invalid storage and falls back to system dark", () => {
    window.localStorage.setItem("bluenote-webui-theme", "solarized")
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }))

    function ThemeHarness() {
      const { theme } = useThemePreference()
      return <span>{theme}</span>
    }

    render(<ThemeHarness />)

    expect(screen.getByText("dark")).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(window.localStorage.getItem("bluenote-webui-theme")).toBe("dark")
  })

  test("theme preference falls back to light when storage and media queries fail", () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => { throw new Error("storage unavailable") }),
      setItem: vi.fn(() => { throw new Error("storage unavailable") }),
    })
    vi.stubGlobal("matchMedia", vi.fn(() => { throw new Error("media unavailable") }))

    function ThemeHarness() {
      const { theme } = useThemePreference()
      return <span>{theme}</span>
    }

    render(<ThemeHarness />)

    expect(screen.getByText("light")).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe("light")
    expect(document.documentElement.style.colorScheme).toBe("light")
  })

  test("setup screen can submit default workspace initialization without typing a path", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<SetupScreen defaultRootPath="/home/me/.bluenote" onSubmit={onSubmit} />)
    expect(screen.getByLabelText(/workspace path/i)).toHaveValue("/home/me/.bluenote")
    await userEvent.click(screen.getByRole("button", { name: /use default/i }))
    expect(onSubmit).toHaveBeenCalledWith("/home/me/.bluenote", true)
  })

  test("note list hides internal data rows", () => {
    render(<NoteList query="" onQuery={() => undefined} selectedKey="" onSelect={() => undefined} notes={[
      { key: "safe", title: "Safe", description: "", relativePath: "note/safe.md", folder: "note" },
      { key: "secret", title: "Secret", description: "", relativePath: ".data/ai/codex-auth.json", folder: "note" },
    ]} />)
    expect(screen.getByText("Safe")).toBeInTheDocument()
    expect(screen.queryByText("Secret")).not.toBeInTheDocument()
  })

  test("folder manager root keeps note and draft areas visible while allowing root folder creation", () => {
    const onOpenFolder = vi.fn()
    render(<FolderManager
      currentFolder=""
      selectedKey=""
      folders={[{ relativePath: "note", name: "note", noteCount: 2 }, { relativePath: "draft", name: "draft", noteCount: 1 }, { relativePath: "note/projects", name: "projects", noteCount: 1 }]}
      notes={[]}
      onOpenFolder={onOpenFolder}
      onSelectNote={() => undefined}
      onCreateFolder={() => undefined}
    />)

    const manager = screen.getByRole("region", { name: /note navigation/i })
    expect(within(manager).getByRole("button", { name: /folder note$/i })).toBeInTheDocument()
    expect(within(manager).getByRole("button", { name: /folder draft$/i })).toBeInTheDocument()
    expect(within(manager).getByRole("button", { name: /new folder/i })).toBeEnabled()
  })

  test("folder manager enables subfolder creation only inside note folders", () => {
    const { rerender } = render(<FolderManager
      currentFolder="draft"
      selectedKey=""
      folders={[{ relativePath: "note", name: "note", noteCount: 0 }, { relativePath: "draft", name: "draft", noteCount: 0 }]}
      notes={[]}
      onOpenFolder={() => undefined}
      onSelectNote={() => undefined}
      onCreateFolder={() => undefined}
    />)
    expect(screen.getByRole("button", { name: /new folder/i })).toBeDisabled()

    rerender(<FolderManager
      currentFolder="notebook"
      selectedKey=""
      folders={[{ relativePath: "note", name: "note", noteCount: 0 }, { relativePath: "notebook", name: "notebook", noteCount: 0 }]}
      notes={[]}
      onOpenFolder={() => undefined}
      onSelectNote={() => undefined}
      onCreateFolder={() => undefined}
    />)
    expect(screen.getByRole("button", { name: /new folder/i })).toBeDisabled()

    rerender(<FolderManager
      currentFolder="note/projects"
      selectedKey=""
      folders={[{ relativePath: "note", name: "note", noteCount: 0 }, { relativePath: "draft", name: "draft", noteCount: 0 }, { relativePath: "note/projects", name: "projects", noteCount: 0 }]}
      notes={[]}
      onOpenFolder={() => undefined}
      onSelectNote={() => undefined}
      onCreateFolder={() => undefined}
    />)
    const manager = screen.getByRole("region", { name: /note navigation/i })
    const explorerActions = within(manager).getByRole("toolbar", { name: /explorer actions/i })
    expect(within(explorerActions).getByRole("button", { name: /new folder/i })).toBeEnabled()
  })

  test("folder manager uses icon-led metadata rows inside the explorer", async () => {
    const onOpenFolder = vi.fn()
    const onSelectNote = vi.fn()
    render(<FolderManager
      currentFolder="note"
      selectedKey="alpha"
      folders={[{ relativePath: "note", name: "note", noteCount: 2 }, { relativePath: "draft", name: "draft", noteCount: 1 }, { relativePath: "note/projects", name: "projects", noteCount: 1 }]}
      notes={[
        { key: "alpha", title: "Alpha", description: "Body", relativePath: "note/alpha.md", folder: "note" },
        { key: "nested", title: "Nested", description: "Hidden", relativePath: "note/projects/nested.md", folder: "note" },
      ]}
      onOpenFolder={onOpenFolder}
      onSelectNote={onSelectNote}
      onCreateFolder={() => undefined}
    />)

    const manager = screen.getByRole("region", { name: /note navigation/i })
    expect(within(manager).queryByText("Selected note")).not.toBeInTheDocument()
    expect(within(manager).getByRole("textbox", { name: /search in folder/i })).toBeInTheDocument()
    expect(within(manager).queryByRole("button", { name: /show filter/i })).not.toBeInTheDocument()
    
    // Expand the 'projects' folder to see its children
    const projectsRow = within(manager).getByRole("button", { name: /folder projects/i }).parentElement!
    await userEvent.click(within(projectsRow).getByRole("button", { name: "Expand folder" }))
    
    expect(await within(manager).findByRole("button", { name: /folder projects/i })).toHaveTextContent("projects")
    expect(within(manager).getByRole("button", { name: /normal note alpha/i })).toHaveTextContent("note/alpha.md")
    expect(within(manager).queryByText(/^Folder$/)).not.toBeInTheDocument()
    expect(within(manager).queryByText(/^Note$/)).not.toBeInTheDocument()
    await userEvent.click(within(manager).getByRole("button", { name: /folder projects/i }))
    expect(onOpenFolder).toHaveBeenCalledWith("note/projects")
  })

  test("folder manager note rows expose explorer metadata without visible kind pills", () => {
    render(
      <FolderManager
        currentFolder="note"
        selectedKey="draft-1"
        folders={[
          { relativePath: "note", name: "note", noteCount: 2 },
          { relativePath: "draft", name: "draft", noteCount: 1 },
          { relativePath: "note/projects", name: "projects", noteCount: 2 },
        ]}
        notes={[
          {
            key: "draft-1",
            title: "Draft spec",
            description: "First pass of redesign",
            relativePath: "draft/draft-spec.md",
            folder: "draft",
          },
        ]}
        query=""
        onQuery={() => undefined}
        onOpenFolder={() => undefined}
        onSelectNote={() => undefined}
        onCreateFolder={() => undefined}
        onCreateNote={() => undefined}
        onQuickDraft={() => undefined}
      />,
    )

    const manager = screen.getByRole("region", { name: /note navigation/i })
    const draftRow = within(manager).getByRole("button", { name: /draft note draft spec/i })

    expect(draftRow).toBeInTheDocument()
    expect(within(draftRow).getByLabelText(/^draft note$/i)).toBeInTheDocument()
    expect(within(draftRow).getByText("Draft spec")).toBeInTheDocument()
    expect(within(draftRow).getByText("draft/draft-spec.md")).toBeInTheDocument()
    expect(within(draftRow).getByText("First pass of redesign")).toBeInTheDocument()
    expect(within(draftRow).queryByText(/^Draft note$/i)).not.toBeInTheDocument()
  })

  test("folder manager uses one unified explorer with folders first and notes after", async () => {
    render(
      <FolderManager
        currentFolder="note"
        selectedKey="note-1"
        folders={[
          { relativePath: "note", name: "note", noteCount: 2 },
          { relativePath: "draft", name: "draft", noteCount: 1 },
          { relativePath: "note/projects", name: "projects", noteCount: 2 },
          { relativePath: "note/reference", name: "reference", noteCount: 5 },
        ]}
        notes={[
          {
            key: "note-1",
            title: "Draft spec",
            description: "First pass of redesign",
            relativePath: "note/draft-spec.md",
            folder: "note",
          },
        ]}
        query=""
        onQuery={() => undefined}
        onOpenFolder={() => undefined}
        onSelectNote={() => undefined}
        onCreateFolder={() => undefined}
        onCreateNote={() => undefined}
        onQuickDraft={() => undefined}
      />,
    )

    const manager = screen.getByRole("region", { name: /note navigation/i })
    const explorer = within(manager).getByRole("list", { name: /explorer items/i })
    expect(within(manager).queryByRole("heading", { name: /folders/i })).not.toBeInTheDocument()
    expect(within(manager).queryByRole("heading", { name: /notes in this folder/i })).not.toBeInTheDocument()
    
    
    // Wait for the folder to expand
    expect(await within(explorer).findByRole("button", { name: /folder projects/i })).toBeInTheDocument()
    
    const rowsAfterExpand = within(explorer).getAllByRole("listitem")
    expect(rowsAfterExpand.length).toBeGreaterThanOrEqual(3)
    
    expect(within(rowsAfterExpand[1]).getByRole("button", { name: /folder projects/i })).toBeInTheDocument()
    expect(within(rowsAfterExpand[2]).getByRole("button", { name: /folder reference/i })).toBeInTheDocument()
    expect(within(rowsAfterExpand[3]).getByRole("button", { name: /normal note draft spec/i })).toBeInTheDocument()
    expect(within(manager).getByRole("textbox", { name: /search in folder/i })).toBeInTheDocument()
    expect(within(manager).queryByRole("button", { name: /show filter/i })).not.toBeInTheDocument()
    const noteRow = within(manager).getByRole("button", { name: /normal note draft spec/i })
    expect(within(noteRow).getByText("Draft spec")).toBeInTheDocument()
    expect(within(noteRow).getByText("note/draft-spec.md")).toBeInTheDocument()
    expect(within(noteRow).getByText("First pass of redesign")).toBeInTheDocument()
  })

  test("folder manager shows note actions in a bottom contextual bar for the selected note", async () => {
    const onRenameNote = vi.fn()
    const onMoveNote = vi.fn()
    const onArchiveNote = vi.fn()
    const onDeleteNote = vi.fn()
    const onSelectNote = vi.fn()

    render(
      <FolderManager
        currentFolder="note"
        selectedKey="alpha"
        folders={[{ relativePath: "note", name: "note", noteCount: 2 }]}
        notes={[
          { key: "alpha", title: "Alpha", description: "Body", relativePath: "note/alpha.md", folder: "note" },
          { key: "draft-1", title: "Scratch", description: "Temp", relativePath: "note/scratch.md", folder: "draft" },
        ]}
        onOpenFolder={() => undefined}
        onSelectNote={onSelectNote}
        onCreateFolder={() => undefined}
        onRenameNote={onRenameNote}
        onMoveNote={onMoveNote}
        onArchiveNote={onArchiveNote}
        onDeleteNote={onDeleteNote}
      />,
    )

    const actionBar = screen.getByRole("toolbar", { name: /manager actions for alpha/i })
    await userEvent.click(within(actionBar).getByRole("button", { name: /open actions for alpha/i }))

    const actionGroup = await screen.findByRole("group", { name: /actions for alpha/i })
    await userEvent.click(within(actionGroup).getByRole("button", { name: /rename note/i }))

    await userEvent.click(within(actionBar).getByRole("button", { name: /open actions for alpha/i }))
    await userEvent.click(within(await screen.findByRole("group", { name: /actions for alpha/i })).getByRole("button", { name: /move note/i }))

    await userEvent.click(within(actionBar).getByRole("button", { name: /open actions for alpha/i }))
    await userEvent.click(within(await screen.findByRole("group", { name: /actions for alpha/i })).getByRole("button", { name: /archive note/i }))

    await userEvent.click(within(actionBar).getByRole("button", { name: /open actions for alpha/i }))
    await userEvent.click(within(await screen.findByRole("group", { name: /actions for alpha/i })).getByRole("button", { name: /delete note/i }))

    expect(onRenameNote).toHaveBeenCalledWith("alpha")
    expect(onMoveNote).toHaveBeenCalledWith("alpha")
    expect(onArchiveNote).toHaveBeenCalledWith("alpha")
    expect(onDeleteNote).toHaveBeenCalledWith("alpha")
    expect(onSelectNote).not.toHaveBeenCalled()
    expect(screen.queryByRole("group", { name: /actions for alpha/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /move note scratch/i })).not.toBeInTheDocument()
  })

  test("folder manager keeps integrated search inside the current folder while including nested matches", async () => {
    const onQuery = vi.fn()

    render(
      <FolderManager
        currentFolder="note"
        selectedKey=""
        folders={[
          { relativePath: "note", name: "note", noteCount: 2 },
          { relativePath: "draft", name: "draft", noteCount: 1 },
          { relativePath: "note/projects", name: "projects", noteCount: 2 },
          { relativePath: "note/reference", name: "reference", noteCount: 1 },
          { relativePath: "draft/projects", name: "projects", noteCount: 1 },
        ]}
        notes={[
          { key: "alpha", title: "Alpha", description: "Project note", relativePath: "note/alpha.md", folder: "note" },
          { key: "beta", title: "Project plan", description: "Nested", relativePath: "note/projects/beta.md", folder: "note" },
          { key: "draft-beta", title: "Project scratch", description: "Wrong space", relativePath: "draft/projects/beta.md", folder: "draft" },
        ]}
        query="proj"
        onQuery={onQuery}
        onOpenFolder={() => undefined}
        onSelectNote={() => undefined}
        onCreateFolder={() => undefined}
      />,
    )

    const manager = screen.getByRole("region", { name: /note navigation/i })
    expect(within(manager).getByRole("textbox", { name: /search in folder/i })).toBeInTheDocument()
    expect(within(manager).queryByRole("button", { name: /hide filter/i })).not.toBeInTheDocument()
    expect(within(manager).queryByRole("button", { name: /show filter/i })).not.toBeInTheDocument()
    
    // Expand root folders to see children
    await userEvent.click(within(manager).getByRole("button", { name: /folder note/i }))
    await userEvent.click(within(manager).getByRole("button", { name: /folder draft/i }))

    const projectFolders = await within(manager).findAllByRole("button", { name: /folder projects/i })
    expect(projectFolders).toHaveLength(2)
    await userEvent.click(projectFolders[0])
    await userEvent.click(projectFolders[1])
    expect(within(manager).queryByRole("button", { name: /folder reference/i })).not.toBeInTheDocument()
    expect(within(manager).getByRole("button", { name: /normal note alpha/i })).toBeInTheDocument()
    expect(within(manager).getByRole("button", { name: /normal note project plan/i })).toBeInTheDocument()
    
    // draft-beta matches query, so it should be present
    expect(within(manager).getByRole("button", { name: /draft note project scratch/i })).toBeInTheDocument()
    
    // Total matches: 1 in note, 1 in note/projects, 1 alpha, 1 draft-beta = 4 matches!
    expect(within(manager).getAllByText(/5 matches/i).length).toBeGreaterThan(0)

    const searchBox = within(manager).getByRole("textbox", { name: /search in folder/i })
    await userEvent.clear(searchBox)
    expect(onQuery).toHaveBeenCalledWith("")
  })

  test("shell action bar is no longer used as an editor management surface", () => {
    render(
      <ShellActionBar
        canMutate
        canPromoteDraft
        dirty
        onNewNote={() => undefined}
        onNewFolder={() => undefined}
        onRename={() => undefined}
        onMove={() => undefined}
        onSearch={() => undefined}
        onSave={() => undefined}
        onPromote={() => undefined}
      />,
    )

    expect(screen.queryByRole("toolbar", { name: /editor actions/i })).not.toBeInTheDocument()
  })

  test("ai workspace dialog exposes compact segmented views for status, queue, config, and auth", async () => {
    const onClose = vi.fn()
    const onSaveConfig = vi.fn().mockResolvedValue(undefined)
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const onDescribe = vi.fn().mockResolvedValue(undefined)
    const onProcessQueue = vi.fn().mockResolvedValue(undefined)
    const onStartCodexAuth = vi.fn().mockResolvedValue(undefined)
    const onLogoutCodex = vi.fn().mockResolvedValue(undefined)

    render(
      <AiWorkspaceDialog
        open
        onClose={onClose}
        status={{ status: "auth-required", provider: "codex", model: "gpt-5-codex", queue: { pending: 2, running: 0, failed: 1 }, message: "Authentication required before background jobs can run." }}
        config={{ configured: true, enabled: true, provider: "codex", model: "gpt-5-codex", logging: { usage: true, conversations: false, results: true }, maxAttempts: 3, outputLanguage: "English" }}
        queue={{ jobs: [{ kind: "describe-note", key: "alpha", relativePath: "note/alpha.md", status: "pending", attempts: 0, lastError: null, updatedAt: new Date().toISOString() }] }}
        codexAuth={{ state: "setup-required" }}
        onSaveConfig={onSaveConfig}
        onRefresh={onRefresh}
        onDescribeCurrentNote={onDescribe}
        onProcessQueue={onProcessQueue}
        onStartCodexAuth={onStartCodexAuth}
        onLogoutCodex={onLogoutCodex}
      />,
    )

    const dialog = screen.getByRole("dialog", { name: /ai background jobs and configuration/i })
    expect(dialog.querySelector(".action-box-body")).not.toBeNull()
    expect(dialog.querySelector(".ai-workspace-dialog__hero")).not.toBeNull()
    expect(within(dialog).getByRole("tab", { name: /status/i })).toHaveAttribute("aria-selected", "true")
    expect(within(dialog).getByText(/background status/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/authentication required before background jobs can run/i)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /refresh ai status/i })).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("tab", { name: /config/i }))
    expect(within(dialog).getByRole("combobox", { name: /provider/i })).toHaveValue("codex")

    await userEvent.click(within(dialog).getByRole("tab", { name: /queue/i }))
    expect(within(dialog).getByRole("list", { name: /ai queued jobs/i })).toBeInTheDocument()
    expect(within(dialog).getByText(/note\/alpha\.md/i)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: /run queued jobs/i }))
    expect(onProcessQueue).toHaveBeenCalledTimes(1)

    await userEvent.click(within(dialog).getByRole("tab", { name: /auth/i }))
    expect(within(dialog).getByRole("button", { name: /start codex auth/i })).toBeInTheDocument()
  })

  test("folder manager history controls wire clicks and disabled states", async () => {
    const onNavigateBack = vi.fn()
    const onNavigateForward = vi.fn()
    const { rerender } = render(<FolderManager
      currentFolder="note"
      selectedKey=""
      folders={[{ relativePath: "note", name: "note", noteCount: 0 }]}
      notes={[]}
      onOpenFolder={() => undefined}
      onSelectNote={() => undefined}
      onCreateFolder={() => undefined}
      onNavigateBack={onNavigateBack}
      onNavigateForward={onNavigateForward}
      canGoBack={false}
      canGoForward={true}
    />)

    const manager = screen.getByRole("region", { name: /note navigation/i })
    const back = within(manager).getByRole("button", { name: /go back/i })
    const forward = within(manager).getByRole("button", { name: /go forward/i })

    expect(back).toBeDisabled()
    expect(forward).toBeEnabled()

    await userEvent.click(back)
    await userEvent.click(forward)
    expect(onNavigateBack).not.toHaveBeenCalled()
    expect(onNavigateForward).toHaveBeenCalledTimes(1)

    rerender(<FolderManager
      currentFolder="note"
      selectedKey=""
      folders={[{ relativePath: "note", name: "note", noteCount: 0 }]}
      notes={[]}
      onOpenFolder={() => undefined}
      onSelectNote={() => undefined}
      onCreateFolder={() => undefined}
      onNavigateBack={onNavigateBack}
      onNavigateForward={onNavigateForward}
      canGoBack={true}
      canGoForward={false}
    />)

    await userEvent.click(within(manager).getByRole("button", { name: /go back/i }))
    await userEvent.click(within(manager).getByRole("button", { name: /go forward/i }))
    expect(onNavigateBack).toHaveBeenCalledTimes(1)
    expect(onNavigateForward).toHaveBeenCalledTimes(1)
  })

  test("navigation history derives note folders from startup note relative paths", () => {
    expect(noteFolderFromRelativePath("note/alpha.md")).toBe("note")
    expect(noteFolderFromRelativePath("note/projects/alpha.md")).toBe("note/projects")
    expect(noteFolderFromRelativePath("draft/quick.md")).toBe("draft")
    expect(noteFolderFromRelativePath("note\\windows\\alpha.md")).toBe("note/windows")
    expect(noteFolderFromRelativePath("/note/projects/alpha.md")).toBe("note/projects")
  })

  test("navigation history moves back and forward through folder and note targets", () => {
    const history = createNavigationHistory("")
    history.push({ folder: "note" })
    history.push({ folder: "note/projects", noteKey: "alpha" })

    expect(history.back()).toEqual({ folder: "note", noteKey: null })
    expect(history.back()).toEqual({ folder: "", noteKey: null })
    expect(history.forward()).toEqual({ folder: "note", noteKey: null })
    expect(history.forward()).toEqual({ folder: "note/projects", noteKey: "alpha" })
  })

  test("navigation history can replace startup current note target without stale root back", () => {
    const history = createNavigationHistory("")
    history.replaceCurrent({ folder: "note/projects", noteKey: "alpha" })

    expect(history.current()).toEqual({ folder: "note/projects", noteKey: "alpha" })
    expect(history.canBack()).toBe(false)
    expect(history.canForward()).toBe(false)

    history.push({ folder: "note/archive", noteKey: "beta" })
    expect(history.back()).toEqual({ folder: "note/projects", noteKey: "alpha" })
  })

  test("editor keeps compact metadata and status details without reintroducing inline chrome actions", async () => {
    const onSave = vi.fn()
    render(
      <EditorPane
        note={{ key: "a", title: "A", description: "", relativePath: "note/a.md", folder: "note", body: "old", updatedAt: "2026-06-10T12:34:00.000Z" }}
        body="new unsaved"
        dirty
        saveState="Save failed"
        onBodyChange={() => undefined}
        onSave={onSave}
        onPromote={() => undefined}
        onRename={() => undefined}
        onMove={() => undefined}
        onSearch={() => undefined}
      />,
    )
    expect(screen.getByRole("heading", { level: 1, name: "A" })).toBeInTheDocument()
    expect(screen.getByText(/note\/a\.md/i)).toBeInTheDocument()
    expect(screen.getByText(/updated /i)).toBeInTheDocument()
    expect(screen.getAllByText(/^note$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/note body/i)).toHaveValue("new unsaved")
    expect(screen.queryByRole("button", { name: /save note/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /rename note/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /move note/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /search and commands/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/editor status bar/i)).toHaveTextContent(/lines 1/i)
    expect(screen.getByLabelText(/editor status bar/i)).toHaveTextContent(/ln 1, col 1/i)
    expect(screen.getByRole("button", { name: /wrap on/i })).toBeInTheDocument()
  })

  test("action dialog closes with Escape and backdrop click, but not inside clicks", async () => {
    const onClose = vi.fn()
    render(<ActionDialog title="Rename note" open onClose={onClose}><button>Inside action</button></ActionDialog>)
    const dialog = screen.getByRole("dialog", { name: "Rename note" })
    expect(dialog).toBeInTheDocument()
    expect(dialog.querySelector(".action-box-body")).not.toBeNull()
    expect(screen.getByRole("button", { name: /close rename note/i })).toHaveClass("action-box-close")
    await userEvent.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole("button", { name: /inside action/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole("dialog", { name: "Rename note" }).parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  test("action dialog moves focus inside on open and restores prior focus on close", async () => {
    const onClose = vi.fn()

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>Open action</button>
          <ActionDialog title="Rename note" open={open} onClose={() => { onClose(); setOpen(false) }}>
            <input autoFocus aria-label="Rename input" />
          </ActionDialog>
        </div>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole("button", { name: /open action/i })
    trigger.focus()
    expect(trigger).toHaveFocus()

    await userEvent.click(trigger)
    await waitFor(() => expect(screen.getByRole("textbox", { name: /rename input/i })).toHaveFocus())

    await userEvent.click(screen.getByRole("button", { name: /close rename note/i }))
    await waitFor(() => expect(screen.getByRole("button", { name: /open action/i })).toHaveFocus())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("action dialog falls back to focusing the dialog when no focusable child exists", async () => {
    const onClose = vi.fn()
    render(<ActionDialog title="Archive note" open onClose={onClose}><p>Archive this note?</p></ActionDialog>)

    await waitFor(() => expect(screen.getByRole("dialog", { name: /archive note/i })).toHaveFocus())
  })

  test("action dialog ignores close controls while busy", async () => {
    const onClose = vi.fn()
    render(<ActionDialog title="Rename note" open onClose={onClose} busy><button>Inside action</button></ActionDialog>)

    await userEvent.keyboard("{Escape}")
    await userEvent.click(screen.getByRole("dialog", { name: "Rename note" }).parentElement as HTMLElement)
    await userEvent.click(screen.getByRole("button", { name: /close rename note/i }))

    expect(screen.getByRole("button", { name: /close rename note/i })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  test("global shortcut editable target helper recognizes form and contenteditable targets", () => {
    const input = document.createElement("input")
    const textarea = document.createElement("textarea")
    const select = document.createElement("select")
    const editable = document.createElement("div")
    editable.setAttribute("contenteditable", "true")
    const button = document.createElement("button")

    expect(isEditableTarget(input)).toBe(true)
    expect(isEditableTarget(textarea)).toBe(true)
    expect(isEditableTarget(select)).toBe(true)
    expect(isEditableTarget(editable)).toBe(true)
    expect(isEditableTarget(button)).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })

  test("editor textarea keeps advertised save and search shortcuts active", async () => {
    const { textarea } = await renderAppWithStartupNote()
    await userEvent.clear(textarea)
    await userEvent.type(textarea, "Updated from keyboard")

    await userEvent.keyboard("{Control>}s{/Control}")
    await waitFor(() => expect(apiMocks.updateNote).toHaveBeenCalledWith("note-1", { body: "Updated from keyboard" }))

    await userEvent.keyboard("{Control>}k{/Control}")
    expect(await screen.findByRole("dialog", { name: /search and commands/i })).toBeInTheDocument()
  })

  test("editor textarea keeps advertised move and rename shortcuts active", async () => {
    const { textarea } = await renderAppWithStartupNote()
    await userEvent.click(textarea)

    await userEvent.keyboard("{Control>}{Shift>}m{/Shift}{/Control}")
    expect(await screen.findByRole("dialog", { name: /move note/i })).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /move note/i })).not.toBeInTheDocument())

    await userEvent.keyboard("{F2}")
    expect(await screen.findByRole("dialog", { name: /rename note/i })).toBeInTheDocument()
  })

  test("manager rename actions stay local to the targeted note", async () => {
    const alpha = makeNote({ key: "alpha", title: "Alpha", relativePath: "note/projects/alpha.md", body: "Alpha body" })
    const beta = makeNote({ key: "beta", title: "Beta", relativePath: "note/projects/beta.md", body: "Beta body" })

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
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })
    autosaveMock.mockImplementation(() => undefined)
    apiMocks.aiStatus.mockResolvedValue(null)
    apiMocks.aiConfig.mockResolvedValue(null)
    apiMocks.aiQueue.mockResolvedValue({ jobs: [] })
    apiMocks.codexAuthStatus.mockResolvedValue(null)
    apiMocks.folders.mockResolvedValue([{ relativePath: "note", name: "note", noteCount: 2 }, { relativePath: "note/projects", name: "projects", noteCount: 1 }])
    apiMocks.notes.mockResolvedValue([
      { key: alpha.key, title: alpha.title, description: alpha.description, relativePath: alpha.relativePath, folder: alpha.folder },
      { key: beta.key, title: beta.title, description: beta.description, relativePath: beta.relativePath, folder: beta.folder },
    ])
    apiMocks.startupNote.mockResolvedValue(alpha)
    apiMocks.note.mockImplementation(async (key: string) => key === beta.key ? beta : alpha)
    apiMocks.updateNote.mockImplementation(async (key: string, body: { body: string; title?: string }) => ({
      ...(key === beta.key ? beta : alpha),
      ...body,
      body: body.body,
      title: body.title ?? (key === beta.key ? beta.title : alpha.title),
    }))

    render(<App />)
    await waitFor(() => expect(screen.getByLabelText(/note body/i)).toHaveValue("Alpha body"))

    const projectsFolderRow = (await screen.findByRole("button", { name: /folder projects/i })).parentElement!
    await userEvent.click(within(projectsFolderRow).getByRole("button", { name: /expand folder/i }))

    await userEvent.click(await screen.findByRole("button", { name: /normal note beta/i }))
    const actionBar = await screen.findByRole("toolbar", { name: /manager actions for beta/i })
    await userEvent.click(within(actionBar).getByRole("button", { name: /open actions for beta/i }))
    const actionGroup = await screen.findByRole("group", { name: /actions for beta/i })
    await userEvent.click(within(actionGroup).getByRole("button", { name: /rename note/i }))

    const dialog = await screen.findByRole("dialog", { name: /rename note/i })
    expect(dialog).toBeInTheDocument()
    expect(apiMocks.note).toHaveBeenCalledWith("beta")
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Beta")
    expect(screen.getByLabelText(/note body/i)).toHaveValue("Beta body")
    expect(screen.getAllByText(/note\/projects\/beta\.md/i).length).toBeGreaterThan(1)
  })

  test("editor textarea keeps advertised save draft as shortcut active for drafts", async () => {
    const { textarea } = await renderAppWithStartupNote(makeNote({
      key: "draft-1",
      title: "Draft",
      relativePath: "draft/draft-1.md",
      folder: "draft",
      body: "Draft body",
    }))
    await userEvent.click(textarea)

    await userEvent.keyboard("{Control>}{Shift>}s{/Shift}{/Control}")
    expect(await screen.findByRole("dialog", { name: /save draft as/i })).toBeInTheDocument()
  })

  test("app navigation history buttons move through note and folder history", async () => {
    const alpha = makeNote({ key: "alpha", title: "Alpha", relativePath: "note/alpha.md", body: "Alpha body" })
    const beta = makeNote({ key: "beta", title: "Beta", relativePath: "note/projects/beta.md", body: "Beta body" })

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
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })
    autosaveMock.mockImplementation(() => undefined)
    apiMocks.aiStatus.mockResolvedValue(null)
    apiMocks.aiConfig.mockResolvedValue(null)
    apiMocks.aiQueue.mockResolvedValue({ jobs: [] })
    apiMocks.codexAuthStatus.mockResolvedValue(null)
    apiMocks.folders.mockResolvedValue([
      { relativePath: "note", name: "note", noteCount: 2 },
      { relativePath: "note/projects", name: "projects", noteCount: 1 },
          { relativePath: "draft", name: "draft", noteCount: 1 },
          { relativePath: "draft/projects", name: "projects", noteCount: 1 },
    ])
    apiMocks.notes.mockResolvedValue([
      { key: alpha.key, title: alpha.title, description: alpha.description, relativePath: alpha.relativePath, folder: alpha.folder },
      { key: beta.key, title: beta.title, description: beta.description, relativePath: beta.relativePath, folder: beta.folder },
    ])
    apiMocks.startupNote.mockResolvedValue(alpha)
    apiMocks.note.mockImplementation(async (key: string) => key === beta.key ? beta : alpha)
    apiMocks.updateNote.mockImplementation(async (key: string, body: { body: string; title?: string }) => ({
      ...(key === beta.key ? beta : alpha),
      ...body,
      body: body.body,
      title: body.title ?? (key === beta.key ? beta.title : alpha.title),
    }))

    render(<App />)
    await waitFor(() => expect(screen.getByLabelText(/note body/i)).toHaveValue("Alpha body"))

    // Expand the 'note' folder using the toggle chevron

    const projectsFolderRow = (await screen.findByRole("button", { name: /folder projects/i })).parentElement!
    await userEvent.click(within(projectsFolderRow).getByRole("button", { name: /expand folder/i }))

    await userEvent.click(await screen.findByRole("button", { name: /normal note beta/i }))
    await waitFor(() => expect(screen.getByLabelText(/note body/i)).toHaveValue("Beta body"))

    await userEvent.click(screen.getByRole("button", { name: /go back/i }))
    await waitFor(() => expect(screen.getByText(/ready to browse/i)).toBeInTheDocument())

    await userEvent.click(screen.getByRole("button", { name: /go back/i }))
    await waitFor(() => expect(screen.getByLabelText(/note body/i)).toHaveValue("Alpha body"))

    await userEvent.click(screen.getByRole("button", { name: /go forward/i }))
    await waitFor(() => expect(screen.getByText(/ready to browse/i)).toBeInTheDocument())
  })

  test("editor exposes save draft as a keyboard-driven action surface instead of an inline button", async () => {
    render(<EditorPane note={{ key: "d", title: "Draft", description: "", relativePath: "draft/d.md", folder: "draft", body: "body" }} body="body" dirty={false} saveState="Loaded" onBodyChange={() => undefined} onSave={() => undefined} onPromote={() => undefined} />)
    expect(screen.queryByRole("button", { name: /save draft as/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/editor status bar/i)).toHaveTextContent(/draft/i)
  })

  test("editor status bar tracks cursor position and wrap mode", async () => {
    render(
      <EditorPane
        note={{ key: "c", title: "Cursor", description: "", relativePath: "note/cursor.md", folder: "note", body: "Line one\nLine two" }}
        body={"Line one\nLine two"}
        dirty={false}
        saveState="Saved"
        onBodyChange={() => undefined}
        onSave={() => undefined}
        onPromote={() => undefined}
      />,
    )

    const textarea = screen.getByLabelText(/note body/i) as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(10, 10)
    fireEvent.select(textarea)

    await waitFor(() => expect(screen.getByLabelText(/editor status bar/i)).toHaveTextContent(/ln 2, col 2/i))

    await userEvent.click(screen.getByRole("button", { name: /wrap on/i }))
    expect(screen.getByRole("button", { name: /wrap off/i })).toBeInTheDocument()
  })

  test("preview renders simple markdown as structured HTML", () => {
    const { container } = render(<PreviewPane
      visible
      onToggle={() => undefined}
      note={{
        key: "md",
        title: "Markdown Note",
        description: "",
        relativePath: "note/markdown-note.md",
        folder: "note",
        body: "# Heading\n\nA **bold** word and `code`.\n\n- first\n- second\n\n> quoted",
      }}
    />)

    const previewSurface = container.querySelector(".preview-pane__article")
    expect(previewSurface).toBeInTheDocument()
    expect(previewSurface?.querySelector(".preview-pane__context")).toBeInTheDocument()
    expect(previewSurface?.querySelector(".preview-pane__context-path")).toHaveTextContent("note/markdown-note.md")
    expect(screen.getByRole("heading", { level: 1, name: "Heading" })).toBeInTheDocument()
    expect(screen.getByText("bold").tagName.toLowerCase()).toBe("strong")
    expect(screen.getByText("code").tagName.toLowerCase()).toBe("code")
    expect(screen.getByRole("list")).toBeInTheDocument()
    expect(screen.getByText("quoted").closest("blockquote")).toBeInTheDocument()
  })

  test("preview renders multiple links in one paragraph as separate anchors", () => {
    render(<PreviewPane
      visible
      onToggle={() => undefined}
      note={{
        key: "multi-link",
        title: "Multiple Links",
        description: "",
        relativePath: "note/multiple-links.md",
        folder: "note",
        body: "[one](https://one.example) [two](https://two.example)",
      }}
    />)

    expect(screen.getByRole("link", { name: "one" })).toHaveAttribute("href", "https://one.example")
    expect(screen.getByRole("link", { name: "two" })).toHaveAttribute("href", "https://two.example")
  })

  test("preview allows safe link schemes and trims href whitespace", () => {
    render(<PreviewPane
      visible
      onToggle={() => undefined}
      note={{
        key: "allowed-links",
        title: "Allowed Links",
        description: "",
        relativePath: "note/allowed-links.md",
        folder: "note",
        body: "[http]( http://example.test ) [https](https://example.test) [email](mailto:user@example.test) [anchor](#section) [local](/notes/one)",
      }}
    />)

    expect(screen.getByRole("link", { name: "http" })).toHaveAttribute("href", "http://example.test")
    expect(screen.getByRole("link", { name: "https" })).toHaveAttribute("href", "https://example.test")
    expect(screen.getByRole("link", { name: "email" })).toHaveAttribute("href", "mailto:user@example.test")
    expect(screen.getByRole("link", { name: "anchor" })).toHaveAttribute("href", "#section")
    expect(screen.getByRole("link", { name: "local" })).toHaveAttribute("href", "/notes/one")
  })

  test("preview escapes raw html instead of injecting it", () => {
    render(<PreviewPane
      visible
      onToggle={() => undefined}
      note={{
        key: "safe-md",
        title: "Safe Markdown",
        description: "",
        relativePath: "note/safe-markdown.md",
        folder: "note",
        body: "<img src=x onerror=alert(1)>\n\n[link](javascript:alert(1))",
      }}
    />)

    expect(document.querySelector("img")).toBeNull()
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
    expect(screen.getByText(/link/).closest("a")).toBeNull()
  })

  test("preview rejects protocol-relative links but allows local absolute paths", () => {
    render(<PreviewPane
      visible
      onToggle={() => undefined}
      note={{
        key: "safe-links",
        title: "Safe Links",
        description: "",
        relativePath: "note/safe-links.md",
        folder: "note",
        body: "[cdn](//evil.example/path)\n\n[local](/local/path)",
      }}
    />)

    expect(screen.getByText("cdn").closest("a")).toBeNull()
    expect(screen.getByRole("link", { name: "local" })).toHaveAttribute("href", "/local/path")
  })

  test("command palette filters and runs commands", async () => {
    const run = vi.fn()
    render(<CommandPalette open commands={[{ id: "save", label: "Save current note", run }]} notes={[]} onClose={() => undefined} onSelectNote={() => undefined} />)
    const dialog = screen.getByRole("dialog", { name: /search and commands/i })
    expect(dialog.querySelector(".command-palette-searchbar")).not.toBeNull()
    expect(within(dialog).getByText(/jump to notes, folders, commands, or content/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/command palette shortcuts/i)).toHaveTextContent(/enter open/i)
    expect(within(dialog).getByText(/start typing to search everything/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/preview the selected result/i)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/search everything/i), "save{Enter}")
    expect(run).toHaveBeenCalled()
  })

  test("command palette searches notes through supplied server-backed search", async () => {
    const onSearchNotes = vi.fn().mockResolvedValue([
      { key: "remote", title: "Remote Match", description: "", relativePath: "note/remote.md", folder: "note" },
    ])
    const onSelectNote = vi.fn()
    render(<CommandPalette open commands={[]} notes={[]} onClose={() => undefined} onSelectNote={onSelectNote} onSearchNotes={onSearchNotes} />)
    await userEvent.type(screen.getByLabelText(/search everything/i), "remote")
    expect(await screen.findByText("Remote Match")).toBeInTheDocument()
    await userEvent.keyboard("{Enter}")
    expect(onSearchNotes).toHaveBeenCalledWith("remote")
    expect(onSelectNote).toHaveBeenCalledWith("remote")
  })

  test("command palette closes on Escape and outside click", async () => {
    const onClose = vi.fn()
    const { rerender } = render(<CommandPalette open commands={[]} notes={[]} onClose={onClose} onSelectNote={() => undefined} />)
    await userEvent.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<CommandPalette open commands={[]} notes={[]} onClose={onClose} onSelectNote={() => undefined} />)
    await userEvent.click(screen.getByRole("dialog", { name: /search and commands/i }).parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
