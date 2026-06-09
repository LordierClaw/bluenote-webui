import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { SetupScreen } from "../src/client/components/SetupScreen"
import { NoteList } from "../src/client/components/NoteList"
import { EditorPane } from "../src/client/components/EditorPane"
import { CommandPalette } from "../src/client/components/CommandPalette"

describe("client scaffolding", () => {
  test("setup screen submits initialize path", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<SetupScreen onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/workspace path/i), "/tmp/notes")
    await userEvent.click(screen.getByRole("button", { name: /initialize/i }))
    expect(onSubmit).toHaveBeenCalledWith("/tmp/notes", true)
  })

  test("note list hides internal data rows", () => {
    render(<NoteList query="" onQuery={() => undefined} selectedKey="" onSelect={() => undefined} notes={[
      { key: "safe", title: "Safe", description: "", relativePath: "note/safe.md", folder: "note" },
      { key: "secret", title: "Secret", description: "", relativePath: ".data/ai/codex-auth.json", folder: "note" },
    ]} />)
    expect(screen.getByText("Safe")).toBeInTheDocument()
    expect(screen.queryByText("Secret")).not.toBeInTheDocument()
  })

  test("editor keeps failed-save dirty buffer visible", async () => {
    const onSave = vi.fn()
    render(<EditorPane note={{ key: "a", title: "A", description: "", relativePath: "note/a.md", folder: "note", body: "old" }} body="new unsaved" dirty saveState="Save failed" onBodyChange={() => undefined} onSave={onSave} onPromote={() => undefined} />)
    expect(screen.getByLabelText(/note body/i)).toHaveValue("new unsaved")
    expect(screen.getByText(/save failed/i)).toBeInTheDocument()
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
})
