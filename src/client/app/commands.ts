import type { NoteDetailView } from "../../shared/types"

export interface CommandEntry {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  run: () => void | Promise<void>
}

export function buildCommands(actions: {
  newNote: () => void
  quickDraft: () => void
  save: () => void
  deleteNote: () => void
  archiveNote: () => void
  rebuild: () => void
  togglePreview: () => void
  setup: () => void
}, selectedNote?: NoteDetailView | null): CommandEntry[] {
  return [
    { id: "new-note", label: "New note", run: actions.newNote },
    { id: "quick-draft", label: "Quick draft", run: actions.quickDraft },
    { id: "save", label: "Save current note", shortcut: "Ctrl+S", disabled: !selectedNote, run: actions.save },
    { id: "archive", label: "Archive current note", disabled: !selectedNote, run: actions.archiveNote },
    { id: "delete", label: "Delete current note", disabled: !selectedNote, run: actions.deleteNote },
    { id: "rebuild", label: "Rebuild indexes", run: actions.rebuild },
    { id: "preview", label: "Toggle preview", run: actions.togglePreview },
    { id: "setup", label: "Open or initialize workspace", run: actions.setup },
    { id: "find-replace", label: "Find/replace (planned)", disabled: true, run: () => undefined },
  ]
}
