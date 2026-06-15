import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { AppShell } from "../src/client/components/AppShell"
import { useResponsivePanes } from "../src/client/app/useResponsivePanes"

vi.mock("../src/client/app/useResponsivePanes", () => ({
  useResponsivePanes: vi.fn(),
}))

describe("responsive pane controls", () => {
  beforeEach(() => {
    vi.mocked(useResponsivePanes).mockReturnValue({
      managerVisible: false,
      previewVisible: true,
      managerAutoHidden: true,
      previewAutoHidden: false,
      openManager: vi.fn(),
      hideManager: vi.fn(),
      openPreview: vi.fn(),
      hidePreview: vi.fn(),
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })
  })

  test("topbar exposes the compact command header groups and labels", () => {
    const panes = useResponsivePanes()
    const onPalette = vi.fn()
    const onToggleTheme = vi.fn()
    const onAi = vi.fn()

    render(
      <AppShell
        workspace={{ initialized: true, rootPath: "/home/me/.bluenote", noteCount: 3 }}
        aiStatus={{ status: "not-configured" }}
        noteCount={3}
        theme="dark"
        panes={panes}
        onToggleTheme={onToggleTheme}
        onPalette={onPalette}
        onAi={onAi}
      >
        <div>content</div>
      </AppShell>,
    )

    const banner = screen.getByRole("banner")
    expect(banner).toBeInTheDocument()

    const workspacePath = within(banner).getByLabelText(/workspace path/i)
    expect(workspacePath).toHaveTextContent(".bluenote")
    expect(workspacePath).toHaveAttribute("title", "/home/me/.bluenote")

    const searchButton = within(banner).getByRole("button", { name: /search/i })
    const themeToggle = within(banner).getByRole("button", { name: /switch to light mode/i })
    const aiButton = within(banner).getByRole("button", { name: /open ai status and configuration/i })

    expect(searchButton).toHaveTextContent(/ctrl\s*\+\s*k/i)
    expect(themeToggle).toBeInTheDocument()
    expect(within(banner).getByRole("button", { name: /restore manager/i })).toBeInTheDocument()
    expect(aiButton).toBeInTheDocument()

    fireEvent.click(searchButton)
    fireEvent.click(themeToggle)
    fireEvent.click(aiButton)

    expect(onPalette).toHaveBeenCalledTimes(1)
    expect(onToggleTheme).toHaveBeenCalledTimes(1)
    expect(onAi).toHaveBeenCalledTimes(1)
  })

  test("shows restore manager and topbar preview toggle when manager auto-hides while preview remains visible", () => {
    const panes = useResponsivePanes()

    render(
      <AppShell
        workspace={{ initialized: true, rootPath: "/tmp/demo", noteCount: 3 }}
        aiStatus={{ status: "not-configured" }}
        noteCount={3}
        theme="dark"
        panes={panes}
        onToggleTheme={() => undefined}
        onPalette={() => undefined}
        onAi={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    )

    expect(screen.getByRole("button", { name: /restore manager/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /hide preview/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /show preview/i })).not.toBeInTheDocument()
  })

  test("manager restore control can reveal the manager when it starts auto-hidden", () => {
    vi.mocked(useResponsivePanes).mockReturnValueOnce({
      managerVisible: false,
      previewVisible: true,
      managerAutoHidden: true,
      previewAutoHidden: false,
      openManager: vi.fn(),
      hideManager: vi.fn(),
      openPreview: vi.fn(),
      hidePreview: vi.fn(),
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })

    const panes = useResponsivePanes()
    render(
      <AppShell
        workspace={{ initialized: true, rootPath: "/tmp/demo", noteCount: 3 }}
        aiStatus={{ status: "not-configured" }}
        noteCount={3}
        theme="dark"
        panes={panes}
        onToggleTheme={() => undefined}
        onPalette={() => undefined}
        onAi={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    )

    fireEvent.click(screen.getByRole("button", { name: /restore manager/i }))
    expect(panes.openManager).toHaveBeenCalledTimes(1)
  })

  test("workspace toolbar can restore preview when both side panes collapse", () => {
    vi.mocked(useResponsivePanes).mockReturnValueOnce({
      managerVisible: false,
      previewVisible: false,
      managerAutoHidden: true,
      previewAutoHidden: true,
      openManager: vi.fn(),
      hideManager: vi.fn(),
      openPreview: vi.fn(),
      hidePreview: vi.fn(),
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })

    const panes = useResponsivePanes()
    render(
      <AppShell
        workspace={{ initialized: true, rootPath: "/tmp/demo", noteCount: 3 }}
        aiStatus={{ status: "not-configured" }}
        noteCount={3}
        theme="dark"
        panes={panes}
        onToggleTheme={() => undefined}
        onPalette={() => undefined}
        onAi={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    )

    const workspaceViewControls = screen.getByRole("toolbar", { name: /workspace view controls/i })
    fireEvent.click(within(workspaceViewControls).getByRole("button", { name: /restore preview/i }))
    expect(panes.openPreview).toHaveBeenCalledTimes(1)
  })

  test("manually hidden preview uses the topbar show preview control instead of restore wording", () => {
    vi.mocked(useResponsivePanes).mockReturnValueOnce({
      managerVisible: true,
      previewVisible: false,
      managerAutoHidden: false,
      previewAutoHidden: false,
      openManager: vi.fn(),
      hideManager: vi.fn(),
      openPreview: vi.fn(),
      hidePreview: vi.fn(),
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })

    const panes = useResponsivePanes()
    render(
      <AppShell
        workspace={{ initialized: true, rootPath: "/tmp/demo", noteCount: 3 }}
        aiStatus={{ status: "not-configured" }}
        noteCount={3}
        theme="dark"
        panes={panes}
        onToggleTheme={() => undefined}
        onPalette={() => undefined}
        onAi={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    )

    expect(screen.getByRole("button", { name: /show preview/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /restore preview/i })).not.toBeInTheDocument()
  })

  test("keeps compact restore controls in a workspace toolbar when both side panes collapse", () => {
    vi.mocked(useResponsivePanes).mockReturnValueOnce({
      managerVisible: false,
      previewVisible: false,
      managerAutoHidden: true,
      previewAutoHidden: true,
      openManager: vi.fn(),
      hideManager: vi.fn(),
      openPreview: vi.fn(),
      hidePreview: vi.fn(),
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })

    const panes = useResponsivePanes()
    render(
      <AppShell
        workspace={{ initialized: true, rootPath: "/tmp/demo", noteCount: 3 }}
        aiStatus={{ status: "not-configured" }}
        noteCount={3}
        theme="dark"
        panes={panes}
        onToggleTheme={() => undefined}
        onPalette={() => undefined}
        onAi={() => undefined}
      >
        <div>content</div>
      </AppShell>,
    )

    const workspaceViewControls = screen.getByRole("toolbar", { name: /workspace view controls/i })
    expect(workspaceViewControls).toBeInTheDocument()
    expect(within(workspaceViewControls).getByRole("button", { name: /restore manager/i })).toBeInTheDocument()
    expect(within(workspaceViewControls).getByRole("button", { name: /restore preview/i })).toBeInTheDocument()
  })
})
