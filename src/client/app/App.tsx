import { useCallback, useEffect, useRef, useState } from "react"
import type { AiStatusSummary, NoteDetailView, NoteSummaryView, SearchResultView } from "../../shared/types"
import { api } from "./api"
import { buildCommands } from "./commands"
import { useAutosave } from "./useAutosave"
import { useWorkspace } from "./useWorkspace"
import { AppShell } from "../components/AppShell"
import { CommandPalette } from "../components/CommandPalette"
import { EditorPane } from "../components/EditorPane"
import { NoteList } from "../components/NoteList"
import { PreviewPane } from "../components/PreviewPane"
import { SetupScreen } from "../components/SetupScreen"
import { Sidebar } from "../components/Sidebar"

export function App() {
  const workspaceState = useWorkspace()
  const [folder, setFolder] = useState("all")
  const [query, setQuery] = useState("")
  const [notes, setNotes] = useState<(NoteSummaryView | SearchResultView)[]>([])
  const [selectedNote, setSelectedNote] = useState<NoteDetailView | null>(null)
  const [body, setBody] = useState("")
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState("Idle")
  const [preview, setPreview] = useState(true)
  const [palette, setPalette] = useState(false)
  const [aiStatus, setAiStatus] = useState<AiStatusSummary | null>(null)
  const bodyRef = useRef(body)
  const selectedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    bodyRef.current = body
  }, [body])

  useEffect(() => {
    selectedKeyRef.current = selectedNote?.key ?? null
  }, [selectedNote?.key])

  const loadNotes = useCallback(async () => {
    if (!workspaceState.workspace?.initialized) return
    setNotes(await api.notes({ folder, query }))
  }, [folder, query, workspaceState.workspace?.initialized])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  useEffect(() => {
    if (workspaceState.workspace?.initialized) {
      void api.aiStatus().then(setAiStatus).catch(() => undefined)
    }
  }, [workspaceState.workspace?.initialized])

  async function selectNote(id: string) {
    if (dirty && !window.confirm("Discard unsaved changes and switch notes?")) return
    const note = await api.note(id)
    setSelectedNote(note)
    setBody(note.body)
    setDirty(false)
    setSaveState("Loaded")
  }

  const save = useCallback(async () => {
    if (!selectedNote || !dirty) return
    const saveKey = selectedNote.key
    const submittedBody = body
    setSaveState("Saving…")
    try {
      const saved = await api.updateNote(saveKey, { body: submittedBody })
      if (selectedKeyRef.current !== saveKey || bodyRef.current !== submittedBody) {
        setSaveState("Unsaved changes after last save")
        return
      }
      setSelectedNote(saved)
      setBody(saved.body)
      setDirty(false)
      setSaveState("Saved")
      await loadNotes()
    } catch (error) {
      setSaveState(error instanceof Error ? `Save failed: ${error.message}` : "Save failed")
    }
  }, [body, dirty, loadNotes, selectedNote])

  useAutosave(Boolean(selectedNote), dirty, save)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void save()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault()
        setPalette((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [save])

  async function createNormalNote() {
    const title = window.prompt("Note title")
    if (!title) return
    const note = await api.createNote({ type: "normal", title, body: "", destinationFolder: "note" })
    await loadNotes()
    await selectNote(note.key)
  }

  async function createDraft() {
    const note = await api.createNote({ type: "draft", body: "" })
    await loadNotes()
    await selectNote(note.key)
  }

  async function archiveCurrent() {
    if (!selectedNote || !window.confirm("Archive this note?")) return
    await api.archiveNote(selectedNote.key)
    setSelectedNote(null)
    setBody("")
    setDirty(false)
    await loadNotes()
  }

  async function deleteCurrent() {
    if (!selectedNote || !window.confirm("Delete this note? This cannot be undone.")) return
    await api.deleteNote(selectedNote.key)
    setSelectedNote(null)
    setBody("")
    setDirty(false)
    await loadNotes()
  }

  async function promoteCurrent() {
    if (!selectedNote) return
    const title = window.prompt("Save draft as", selectedNote.title)
    if (!title) return
    const promoted = await api.promoteDraft(selectedNote.key, title)
    await loadNotes()
    await selectNote(promoted.key)
  }

  const commands = buildCommands({
    newNote: () => void createNormalNote(),
    quickDraft: () => void createDraft(),
    save: () => void save(),
    deleteNote: () => void deleteCurrent(),
    archiveNote: () => void archiveCurrent(),
    rebuild: () => void api.rebuild().then(loadNotes),
    togglePreview: () => setPreview((value) => !value),
    setup: () => void workspaceState.refresh(),
  }, selectedNote)

  if (workspaceState.loading) return <main className="setup-screen"><p>Loading…</p></main>
  if (!workspaceState.workspace?.initialized) return <SetupScreen error={workspaceState.error} onSubmit={workspaceState.open} />

  return (
    <AppShell workspace={workspaceState.workspace} aiStatus={aiStatus} onPalette={() => setPalette(true)}>
      <div className="main-grid">
        <Sidebar folder={folder} onFolderChange={setFolder} onNewNote={() => void createNormalNote()} onQuickDraft={() => void createDraft()} onRebuild={() => void api.rebuild().then(loadNotes)} />
        <NoteList notes={notes} selectedKey={selectedNote?.key} query={query} onQuery={setQuery} onSelect={(id) => void selectNote(id)} />
        <EditorPane note={selectedNote} body={body} dirty={dirty} saveState={saveState} onBodyChange={(next) => { setBody(next); setDirty(true); setSaveState("Unsaved") }} onSave={() => void save()} onPromote={() => void promoteCurrent()} />
        <PreviewPane note={selectedNote ? { ...selectedNote, body } : null} visible={preview} onToggle={() => setPreview((value) => !value)} />
      </div>
      <CommandPalette open={palette} commands={commands} notes={notes} onClose={() => setPalette(false)} onSelectNote={(id) => void selectNote(id)} onSearchNotes={(searchQuery) => api.notes({ folder: "all", query: searchQuery })} />
    </AppShell>
  )
}
