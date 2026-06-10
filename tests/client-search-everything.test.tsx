import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"

import { CommandPalette } from "../src/client/components/CommandPalette"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("search everything regressions", () => {
  test("shows a preview for the selected result", async () => {
    render(
      <CommandPalette
        open
        commands={[{ id: "save", label: "/save", shortcut: "Ctrl+S", run: async () => undefined }]}
        notes={[]}
        onClose={() => undefined}
        onSelectNote={() => undefined}
        onSearchNotes={async () => [
          {
            key: "remote",
            title: "Remote Match",
            description: "Result from search",
            relativePath: "note/remote.md",
            folder: "note",
            source: "content",
            score: 99,
            match: "...remote content preview...",
          },
        ]}
      />,
    )

    await userEvent.type(screen.getByLabelText(/search everything/i), "remote")

    expect(await screen.findByText("Remote Match")).toBeInTheDocument()
    expect(screen.getByText(/remote content preview/i)).toBeInTheDocument()
  })
})
