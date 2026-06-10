import { render, screen } from "@testing-library/react"
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
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })
  })

  test("shows manager and preview toggle controls when manager auto-hides", () => {
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
      >
        <div>content</div>
      </AppShell>,
    )

    expect(screen.getByRole("button", { name: /show manager/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /hide preview/i })).toBeInTheDocument()
  })
})
