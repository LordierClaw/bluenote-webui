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

  test("shows a guided empty state when nothing matches", async () => {
    render(
      <CommandPalette
        open
        commands={[]}
        notes={[]}
        onClose={() => undefined}
        onSelectNote={() => undefined}
        onSearchNotes={async () => []}
      />,
    )

    await userEvent.type(screen.getByLabelText(/search everything/i), "missing")

    expect(await screen.findByText(/no results for “missing”/i)).toBeInTheDocument()
    expect(screen.getByText(/when a match appears, its note body, folder contents, or command details will show here/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/search tips/i)).toHaveTextContent(/commands show shortcuts/i)
  })
})
