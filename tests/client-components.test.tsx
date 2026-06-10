import { render, screen, within } from "@testing-library/react"
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
import { isEditableTarget } from "../src/client/app/App"
import { createNavigationHistory, noteFolderFromRelativePath } from "../src/client/app/navigationHistory"
import { useThemePreference } from "../src/client/app/useThemePreference"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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
      onToggleTheme={onToggleTheme}
      onPalette={() => undefined}
    >
      <div />
    </AppShell>)

    await userEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }))
    expect(onToggleTheme).toHaveBeenCalled()
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

  test("folder manager root shows both note and draft areas", () => {
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
    expect(within(manager).getByRole("button", { name: /new folder/i })).toBeDisabled()
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
      currentFolder="note/projects"
      selectedKey=""
      folders={[{ relativePath: "note", name: "note", noteCount: 0 }, { relativePath: "draft", name: "draft", noteCount: 0 }, { relativePath: "note/projects", name: "projects", noteCount: 0 }]}
      notes={[]}
      onOpenFolder={() => undefined}
      onSelectNote={() => undefined}
      onCreateFolder={() => undefined}
    />)
    expect(screen.getByRole("button", { name: /new folder/i })).toBeEnabled()
  })

  test("folder manager presents one navigation list with icon-only type marks and aligned metadata", async () => {
    const onOpenFolder = vi.fn()
    const onSelectNote = vi.fn()
    render(<FolderManager
      currentFolder="note"
      selectedKey="alpha"
      folders={[{ relativePath: "note", name: "note", noteCount: 2 }, { relativePath: "note/projects", name: "projects", noteCount: 1 }]}
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
    const navigationList = within(manager).getByRole("list", { name: /folders and notes/i })
    expect(navigationList).toHaveClass("navigation-list")
    expect(within(navigationList).getByRole("button", { name: /folder projects/i })).toHaveTextContent("projects")
    expect(within(navigationList).getByRole("button", { name: /normal note alpha/i })).toHaveTextContent("note/alpha.md")
    expect(within(navigationList).queryByText(/^Folder$/)).not.toBeInTheDocument()
    expect(within(navigationList).queryByText(/^Note$/)).not.toBeInTheDocument()
    await userEvent.click(within(navigationList).getByRole("button", { name: /folder projects/i }))
    expect(onOpenFolder).toHaveBeenCalledWith("note/projects")
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

  test("editor keeps failed-save dirty buffer visible", async () => {
    const onSave = vi.fn()
    render(<EditorPane note={{ key: "a", title: "A", description: "", relativePath: "note/a.md", folder: "note", body: "old" }} body="new unsaved" dirty saveState="Save failed" onBodyChange={() => undefined} onSave={onSave} onPromote={() => undefined} />)
    expect(screen.getByLabelText(/note body/i)).toHaveValue("new unsaved")
    expect(screen.getByText(/save failed/i)).toBeInTheDocument()
  })

  test("action dialog closes with Escape and backdrop click, but not inside clicks", async () => {
    const onClose = vi.fn()
    render(<ActionDialog title="Rename note" open onClose={onClose}><button>Inside action</button></ActionDialog>)
    expect(screen.getByRole("dialog", { name: "Rename note" })).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole("button", { name: /inside action/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole("dialog", { name: "Rename note" }).parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(2)
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

  test("editor exposes save draft as an action instead of relying on prompt", async () => {
    const onPromote = vi.fn()
    render(<EditorPane note={{ key: "d", title: "Draft", description: "", relativePath: "draft/d.md", folder: "draft", body: "body" }} body="body" dirty={false} saveState="Loaded" onBodyChange={() => undefined} onSave={() => undefined} onPromote={onPromote} />)
    await userEvent.click(screen.getByRole("button", { name: /save draft as/i }))
    expect(onPromote).toHaveBeenCalled()
  })

  test("preview renders simple markdown as structured HTML", () => {
    render(<PreviewPane
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
