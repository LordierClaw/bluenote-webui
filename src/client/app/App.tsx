import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import type { AiStatusSummary, FolderView, NoteDetailView, NoteSummaryView, SearchResultView } from "../../shared/types"
import { api } from "./api"
import { buildCommands } from "./commands"
import { createNavigationHistory, noteFolderFromRelativePath, type NavigationTarget } from "./navigationHistory"
import { useAutosave } from "./useAutosave"
import { useThemePreference } from "./useThemePreference"
import { useWorkspace } from "./useWorkspace"
import { AppShell } from "../components/AppShell"
import { ActionDialog } from "../components/ActionDialog"
import { CommandPalette } from "../components/CommandPalette"
import { EditorPane } from "../components/EditorPane"
import { FolderManager } from "../components/FolderManager"
import { PreviewPane } from "../components/PreviewPane"
import { SetupScreen } from "../components/SetupScreen"

type ActionBox = "new-note" | "new-folder" | "save-draft-as" | "move-note" | "rename-note" | "archive-note" | "delete-note" | null

// eslint-disable-next-line react-refresh/only-export-components
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('[contenteditable="true"], [contenteditable=""]')) return true
  const tagName = target.tagName.toLowerCase()
  return tagName === "input" || tagName === "textarea" || tagName === "select"
}

function actionTitle(action: ActionBox): string {
  switch (action) {
    case "new-note": return "New note"
    case "new-folder": return "New folder"
    case "save-draft-as": return "Save draft as"
    case "move-note": return "Move note"
    case "rename-note": return "Rename note"
    case "archive-note": return "Archive note"
    case "delete-note": return "Delete note"
    default: return "Action"
  }
}

export function App() {
  const workspaceState = useWorkspace()
  const { theme, toggleTheme } = useThemePreference()
  const [folder, setFolder] = useState("")
  const [query, setQuery] = useState("")
  const [notes, setNotes] = useState<(NoteSummaryView | SearchResultView)[]>([])
  const [folders, setFolders] = useState<FolderView[]>([])
  const [selectedNote, setSelectedNote] = useState<NoteDetailView | null>(null)
  const [body, setBody] = useState("")
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState("Idle")
  const [preview, setPreview] = useState(true)
  const [palette, setPalette] = useState(false)
  const [actionBox, setActionBox] = useState<ActionBox>(null)
  const [actionValue, setActionValue] = useState("")
  const [actionDestination, setActionDestination] = useState("note")
  const [submittingAction, setSubmittingAction] = useState(false)
  const [aiStatus, setAiStatus] = useState<AiStatusSummary | null>(null)
  const bodyRef = useRef(body)
  const dirtyRef = useRef(dirty)
  const selectedKeyRef = useRef<string | null>(null)
  const submittingActionRef = useRef(false)
  const startupLoadedRef = useRef(false)
  const navigationHistoryRef = useRef(createNavigationHistory(""))
  const [, setHistoryVersion] = useState(0)

  const refreshHistoryControls = useCallback(() => {
    setHistoryVersion((value) => value + 1)
  }, [])

  const recordNavigation = useCallback((target: NavigationTarget) => {
    navigationHistoryRef.current.push(target)
    refreshHistoryControls()
  }, [refreshHistoryControls])

  useEffect(() => {
    bodyRef.current = body
  }, [body])

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    selectedKeyRef.current = selectedNote?.key ?? null
  }, [selectedNote?.key])

  const loadFolders = useCallback(async () => {
    if (!workspaceState.workspace?.initialized) return
    setFolders(await api.folders())
  }, [workspaceState.workspace?.initialized])

  const loadNotes = useCallback(async () => {
    if (!workspaceState.workspace?.initialized) return
    setNotes(await api.notes({ folder: "all", query: "" }))
  }, [workspaceState.workspace?.initialized])

  const refreshWorkspaceData = useCallback(async () => {
    await Promise.all([loadNotes(), loadFolders()])
  }, [loadFolders, loadNotes])

  useEffect(() => {
    void refreshWorkspaceData()
  }, [refreshWorkspaceData])

  useEffect(() => {
    if (!workspaceState.workspace?.initialized || startupLoadedRef.current) return
    startupLoadedRef.current = true
    void api.startupNote()
      .then(async (note) => {
        const startupFolder = noteFolderFromRelativePath(note.relativePath)
        setSelectedNote(note)
        setFolder(startupFolder)
        navigationHistoryRef.current.replaceCurrent({ folder: startupFolder, noteKey: note.key })
        refreshHistoryControls()
        setBody(note.body)
        bodyRef.current = note.body
        setDirty(false)
        dirtyRef.current = false
        setSaveState("Loaded")
        await refreshWorkspaceData()
      })
      .catch((error) => {
        setSaveState(error instanceof Error ? `Startup load failed: ${error.message}` : "Startup load failed")
      })
  }, [refreshHistoryControls, refreshWorkspaceData, workspaceState.workspace?.initialized])

  useEffect(() => {
    if (workspaceState.workspace?.initialized) {
      void api.aiStatus().then(setAiStatus).catch(() => undefined)
    }
  }, [workspaceState.workspace?.initialized])

  const selectNote = useCallback(async (id: string, record = true): Promise<boolean> => {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes and switch notes?")) return false
    const note = await api.note(id)
    const nextFolder = noteFolderFromRelativePath(note.relativePath)
    setSelectedNote(note)
    setFolder(nextFolder)
    setBody(note.body)
    bodyRef.current = note.body
    setDirty(false)
    dirtyRef.current = false
    setSaveState("Loaded")
    if (record) recordNavigation({ folder: nextFolder, noteKey: note.key })
    return true
  }, [recordNavigation])

  const openFolder = useCallback((nextFolder: string, record = true): boolean => {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes and switch folders?")) return false
    setFolder(nextFolder)
    setSelectedNote(null)
    setBody("")
    bodyRef.current = ""
    setDirty(false)
    dirtyRef.current = false
    setSaveState("Idle")
    if (record) recordNavigation({ folder: nextFolder, noteKey: null })
    return true
  }, [recordNavigation])

  const navigateToHistoryTarget = useCallback(async (target: NavigationTarget): Promise<boolean> => {
    if (target.noteKey) {
      return selectNote(target.noteKey, false)
    }
    return openFolder(target.folder, false)
  }, [openFolder, selectNote])

  const goBack = useCallback(async () => {
    if (!navigationHistoryRef.current.canBack()) return
    const target = navigationHistoryRef.current.backTarget()
    if (!await navigateToHistoryTarget(target)) return
    navigationHistoryRef.current.back()
    refreshHistoryControls()
  }, [navigateToHistoryTarget, refreshHistoryControls])

  const goForward = useCallback(async () => {
    if (!navigationHistoryRef.current.canForward()) return
    const target = navigationHistoryRef.current.forwardTarget()
    if (!await navigateToHistoryTarget(target)) return
    navigationHistoryRef.current.forward()
    refreshHistoryControls()
  }, [navigateToHistoryTarget, refreshHistoryControls])

  const save = useCallback(async (): Promise<boolean> => {
    if (!selectedNote) return false
    if (!dirtyRef.current) return true
    const saveKey = selectedNote.key
    const submittedBody = bodyRef.current
    setSaveState("Saving…")
    try {
      const saved = await api.updateNote(saveKey, { body: submittedBody })
      if (selectedKeyRef.current !== saveKey || bodyRef.current !== submittedBody) {
        setSaveState("Unsaved changes after last save")
        return false
      }
      setSelectedNote(saved)
      setBody(saved.body)
      bodyRef.current = saved.body
      setDirty(false)
      dirtyRef.current = false
      setSaveState("Saved")
      await refreshWorkspaceData()
      return true
    } catch (error) {
      setSaveState(error instanceof Error ? `Save failed: ${error.message}` : "Save failed")
      return false
    }
  }, [refreshWorkspaceData, selectedNote])

  const ensureCleanBeforeMutation = useCallback(async (): Promise<boolean> => {
    if (!selectedNote || !dirtyRef.current) return true
    if (!window.confirm("Save changes before continuing?")) {
      setSaveState("Save changes before continuing")
      return false
    }
    const saved = await save()
    if (!saved) setSaveState("Save changes before continuing")
    return saved
  }, [save, selectedNote])

  useAutosave(Boolean(selectedNote), dirty, async () => { await save() })

  const normalFolders = folders.filter((item) => item.relativePath === "note" || item.relativePath.startsWith("note/"))
  const defaultDestinationFolder = folder.startsWith("note") ? folder : "note"

  const closeActionBox = useCallback(({ force = false }: { force?: boolean } = {}) => {
    if (submittingActionRef.current && !force) return
    setActionBox(null)
    setActionValue("")
    setActionDestination(defaultDestinationFolder)
    setSubmittingAction(false)
    submittingActionRef.current = false
  }, [defaultDestinationFolder])

  const openActionBox = useCallback((action: Exclude<ActionBox, null>) => {
    setActionBox(action)
    if (action === "new-note" || action === "new-folder") {
      setActionValue("")
      setActionDestination(defaultDestinationFolder)
      return
    }
    if (action === "save-draft-as" || action === "rename-note") {
      setActionValue(selectedNote?.title ?? "")
      setActionDestination(defaultDestinationFolder)
      return
    }
    if (action === "move-note") {
      setActionValue("")
      setActionDestination(defaultDestinationFolder)
      return
    }
    setActionValue("")
    setActionDestination(defaultDestinationFolder)
  }, [defaultDestinationFolder, selectedNote?.title])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      const commandKey = event.ctrlKey || event.metaKey
      if (event.key === "Escape") {
        if (actionBox) {
          event.preventDefault()
          closeActionBox()
        } else if (palette) {
          event.preventDefault()
          setPalette(false)
        }
        return
      }
      if (actionBox || isEditableTarget(event.target)) return
      if (commandKey && key === "s" && event.shiftKey) {
        if (selectedNote?.folder === "draft") {
          event.preventDefault()
          openActionBox("save-draft-as")
        }
        return
      }
      if (commandKey && key === "s") {
        event.preventDefault()
        void save()
      }
      if (commandKey && (key === "p" || key === "k")) {
        event.preventDefault()
        setPalette(true)
      }
      if (commandKey && event.shiftKey && key === "m") {
        if (selectedNote && selectedNote.folder !== "draft") {
          event.preventDefault()
          openActionBox("move-note")
        }
      }
      if (event.key === "F2" && selectedNote) {
        event.preventDefault()
        openActionBox("rename-note")
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault()
        void goBack()
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault()
        void goForward()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [actionBox, closeActionBox, goBack, goForward, openActionBox, palette, save, selectedNote])

  async function submitActionBox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!actionBox || submittingActionRef.current) return
    submittingActionRef.current = true
    setSubmittingAction(true)
    const value = actionValue.trim()
    let shouldCloseActionBox = false
    try {
      if (actionBox === "new-note") {
        if (!value) return
        if (!await ensureCleanBeforeMutation()) return
        const note = await api.createNote({ type: "normal", title: value, body: "", destinationFolder: actionDestination })
        shouldCloseActionBox = true
        await refreshWorkspaceData()
        await selectNote(note.key)
        return
      }
      if (actionBox === "new-folder") {
        if (!value) return
        if (!await ensureCleanBeforeMutation()) return
        const parent = defaultDestinationFolder
        const leaf = value.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? ""
        if (!leaf) return
        const nextPath = `${parent.replace(/\/$/, "")}/${leaf}`
        const created = await api.createFolder(nextPath)
        shouldCloseActionBox = true
        openFolder(created.relativePath)
        await refreshWorkspaceData()
        return
      }
      if (actionBox === "save-draft-as") {
        if (!selectedNote || !value) return
        const draftKey = selectedNote.key
        const submittedBody = bodyRef.current
        if (dirtyRef.current) {
          setSaveState("Saving…")
          const saved = await api.updateNote(draftKey, { body: submittedBody })
          if (selectedKeyRef.current !== draftKey || bodyRef.current !== submittedBody) {
            setSaveState("Unsaved changes after last save")
            return
          }
          setSelectedNote(saved)
          setBody(saved.body)
          bodyRef.current = saved.body
          setDirty(false)
          dirtyRef.current = false
        }
        const promoted = await api.promoteDraft(draftKey, value, actionDestination)
        if (selectedKeyRef.current !== draftKey) {
          setSaveState("Draft promoted, current note changed")
          shouldCloseActionBox = true
          await refreshWorkspaceData()
          return
        }
        shouldCloseActionBox = true
        await refreshWorkspaceData()
        await selectNote(promoted.key)
        return
      }
      if (actionBox === "move-note") {
        if (!selectedNote || selectedNote.folder === "draft") return
        if (!await ensureCleanBeforeMutation()) return
        const moved = await api.moveNote(selectedNote.key, actionDestination)
        shouldCloseActionBox = true
        await refreshWorkspaceData()
        await selectNote(moved.key)
        return
      }
      if (actionBox === "rename-note") {
        if (!selectedNote || !value) return
        const renameKey = selectedNote.key
        const submittedBody = bodyRef.current
        const renamed = await api.updateNote(renameKey, { title: value, body: submittedBody })
        shouldCloseActionBox = true
        if (selectedKeyRef.current === renameKey && bodyRef.current === submittedBody) {
          setSelectedNote(renamed)
          setBody(renamed.body)
          bodyRef.current = renamed.body
          setDirty(false)
          dirtyRef.current = false
          setSaveState("Saved")
        } else if (selectedKeyRef.current === renameKey) {
          setSelectedNote((current) => current ? { ...current, title: renamed.title, relativePath: renamed.relativePath, folder: renamed.folder } : current)
          setSaveState("Renamed; unsaved changes remain")
        } else {
          setSaveState("Renamed; current note changed")
        }
        await refreshWorkspaceData()
        return
      }
      if (actionBox === "archive-note") {
        if (!selectedNote) return
        if (!await ensureCleanBeforeMutation()) return
        await api.archiveNote(selectedNote.key)
        shouldCloseActionBox = true
        setSelectedNote(null)
        setBody("")
        bodyRef.current = ""
        setDirty(false)
        dirtyRef.current = false
        await refreshWorkspaceData()
        return
      }
      if (actionBox === "delete-note") {
        if (!selectedNote) return
        if (!await ensureCleanBeforeMutation()) return
        await api.deleteNote(selectedNote.key)
        shouldCloseActionBox = true
        setSelectedNote(null)
        setBody("")
        bodyRef.current = ""
        setDirty(false)
        dirtyRef.current = false
        await refreshWorkspaceData()
      }
    } catch (error) {
      setSaveState(error instanceof Error ? `Action failed: ${error.message}` : "Action failed")
    } finally {
      submittingActionRef.current = false
      setSubmittingAction(false)
      if (shouldCloseActionBox) closeActionBox({ force: true })
    }
  }

  async function createDraft() {
    if (!await ensureCleanBeforeMutation()) return
    const note = await api.createNote({ type: "draft", body: "" })
    openFolder("draft")
    await refreshWorkspaceData()
    await selectNote(note.key)
  }

  const commands = buildCommands({
    newNote: () => openActionBox("new-note"),
    quickDraft: () => void createDraft(),
    save: () => void save(),
    deleteNote: () => openActionBox("delete-note"),
    archiveNote: () => openActionBox("archive-note"),
    rebuild: () => void api.rebuild().then(refreshWorkspaceData),
    togglePreview: () => setPreview((value) => !value),
    setup: () => void workspaceState.refresh(),
  }, selectedNote)

  if (workspaceState.loading) return <main className="setup-screen"><p>Loading…</p></main>
  if (!workspaceState.workspace?.initialized) return <SetupScreen defaultRootPath={workspaceState.workspace?.defaultRootPath} error={workspaceState.error} onSubmit={workspaceState.open} />

  return (
    <AppShell workspace={workspaceState.workspace} aiStatus={aiStatus} noteCount={notes.length} theme={theme} onToggleTheme={toggleTheme} onPalette={() => setPalette(true)}>
      <div className="main-grid">
        <FolderManager
          currentFolder={folder}
          selectedKey={selectedNote?.key}
          folders={folders}
          notes={notes}
          query={query}
          onQuery={setQuery}
          onOpenFolder={openFolder}
          onSelectNote={(id) => void selectNote(id)}
          onCreateFolder={() => openActionBox("new-folder")}
          onCreateNote={() => openActionBox("new-note")}
          onQuickDraft={() => void createDraft()}
          onNavigateBack={() => void goBack()}
          onNavigateForward={() => void goForward()}
          canGoBack={navigationHistoryRef.current.canBack()}
          canGoForward={navigationHistoryRef.current.canForward()}
        />
        <EditorPane note={selectedNote} body={body} dirty={dirty} saveState={saveState} onBodyChange={(next) => { setBody(next); bodyRef.current = next; setDirty(true); dirtyRef.current = true; setSaveState("Unsaved") }} onSave={() => void save()} onPromote={() => openActionBox("save-draft-as")} />
        <PreviewPane note={selectedNote ? { ...selectedNote, body } : null} visible={preview} onToggle={() => setPreview((value) => !value)} />
      </div>
      <CommandPalette
        open={palette}
        commands={commands}
        notes={notes}
        folders={folders}
        onClose={() => setPalette(false)}
        onSelectNote={(id) => void selectNote(id)}
        onSelectFolder={(relativePath) => { openFolder(relativePath); }}
        onSearchNotes={(searchQuery) => api.notes({ folder: "all", query: searchQuery }) as Promise<SearchResultView[]>}
        onLoadNotePreview={(id) => api.note(id)}
      />
      <ActionDialog open={Boolean(actionBox)} title={actionTitle(actionBox)} onClose={closeActionBox} busy={submittingAction}>
        <form className="action-form" onSubmit={submitActionBox}>
          {actionBox === "new-note" ? (
            <label>
              <span>Note title</span>
              <input autoFocus value={actionValue} onChange={(event) => setActionValue(event.target.value)} placeholder="Untitled note" />
            </label>
          ) : null}
          {actionBox === "new-folder" ? (
            <label>
              <span>Folder name</span>
              <input autoFocus value={actionValue} onChange={(event) => setActionValue(event.target.value)} placeholder="Project" />
            </label>
          ) : null}
          {actionBox === "save-draft-as" ? (
            <label>
              <span>Title</span>
              <input autoFocus value={actionValue} onChange={(event) => setActionValue(event.target.value)} placeholder="Draft title" />
            </label>
          ) : null}
          {actionBox === "rename-note" ? (
            <label>
              <span>Title</span>
              <input autoFocus value={actionValue} onChange={(event) => setActionValue(event.target.value)} placeholder="Note title" />
            </label>
          ) : null}
          {(actionBox === "new-note" || actionBox === "save-draft-as" || actionBox === "move-note") ? (
            <label>
              <span>Destination folder</span>
              <select value={actionDestination} onChange={(event) => setActionDestination(event.target.value)}>
                {(normalFolders.length ? normalFolders : [{ relativePath: "note", name: "note", noteCount: 0 }]).map((item) => (
                  <option key={item.relativePath} value={item.relativePath}>{item.relativePath}</option>
                ))}
              </select>
            </label>
          ) : null}
          {actionBox === "archive-note" ? <p>Archive “{selectedNote?.title}”?</p> : null}
          {actionBox === "delete-note" ? <p>Delete “{selectedNote?.title}”? This cannot be undone.</p> : null}
          <div className="action-buttons">
            <button type="button" onClick={() => closeActionBox()} disabled={submittingAction}>Cancel</button>
            <button className={actionBox === "delete-note" ? "danger" : "primary"} type="submit" disabled={submittingAction || ((actionBox === "new-note" || actionBox === "new-folder" || actionBox === "save-draft-as" || actionBox === "rename-note") && !actionValue.trim())}>
              {actionBox === "delete-note" ? "Delete" : actionBox === "archive-note" ? "Archive" : actionBox === "move-note" ? "Move" : "Save"}
            </button>
          </div>
        </form>
      </ActionDialog>
    </AppShell>
  )
}
