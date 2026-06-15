import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import type { AiConfigView, AiQueueView, AiStatusSummary, CodexAuthStatusView, FolderView, NoteDetailView, NoteSummaryView, SearchResultView } from "../../shared/types"
import { api } from "./api"
import { buildCommands } from "./commands"
import { createNavigationHistory, noteFolderFromRelativePath, type NavigationTarget } from "./navigationHistory"
import { useAutosave } from "./useAutosave"
import { useResponsivePanes } from "./useResponsivePanes"
import { usePaneResize } from "./usePaneResize"
import { useThemePreference } from "./useThemePreference"
import { useWorkspace } from "./useWorkspace"
import { AppShell } from "../components/AppShell"
import { AiWorkspaceDialog } from "../components/AiWorkspaceDialog"
import { CommandPalette } from "../components/CommandPalette"
import { EditorPane } from "../components/EditorPane"
import { FolderManager } from "../components/FolderManager"
import { NoteCommandSurface } from "../components/NoteCommandSurface"
import { PreviewPane } from "../components/PreviewPane"
import { SetupScreen } from "../components/SetupScreen"
import { SettingsModal } from "../components/SettingsModal"


type ActionBox = "new-note" | "new-folder" | "save-draft-as" | "move-note" | "rename-note" | "rename-folder" | "archive-note" | "delete-note" | null
type NoteManagerAction = Extract<ActionBox, "save-draft-as" | "move-note" | "rename-note" | "archive-note" | "delete-note">

// eslint-disable-next-line react-refresh/only-export-components
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('[contenteditable="true"], [contenteditable=""]')) return true
  if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && target.readOnly) return false
  const tagName = target.tagName.toLowerCase()
  return tagName === "input" || tagName === "textarea" || tagName === "select"
}

function isEditorTextareaTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement
}

function actionTitle(action: ActionBox): string {
  switch (action) {
    case "new-note": return "New note"
    case "new-folder": return "New folder"
    case "save-draft-as": return "Save draft as"
    case "move-note": return "Move note"
    case "rename-note": return "Rename note"
    case "rename-folder": return "Rename folder"
    case "archive-note": return "Archive note"
    case "delete-note": return "Delete note"
    default: return "Action"
  }
}

function actionDescription(action: ActionBox, note?: NoteDetailView | null): string {
  switch (action) {
    case "new-note": return "Create a new note directly from the editor workspace."
    case "new-folder": return "Add a folder so the current note collection stays organized."
    case "save-draft-as": return "Promote this draft into the main note tree without leaving the editor."
    case "move-note": return `Move “${note?.title ?? "this note"}” into another note folder.`
    case "rename-note": return `Rename “${note?.title ?? "this note"}” while preserving its content and location.`
    case "rename-folder": return "Rename the current folder without leaving the navigation context."
    case "archive-note": return `Archive “${note?.title ?? "this note"}” from the current workspace.`
    case "delete-note": return `Delete “${note?.title ?? "this note"}”. This cannot be undone.`
    default: return ""
  }
}

function actionContext(action: ActionBox, note?: NoteDetailView | null, destination?: string, folderPath?: string): string | undefined {
  if (action === "new-note") return `Destination: ${destination ?? "note"}`
  if (action === "new-folder") return `Parent folder: ${destination ?? "note"}`
  if (action === "save-draft-as") return `Draft path: ${note?.relativePath ?? "draft"}`
  if (action === "rename-folder") return folderPath
  if (action === "move-note" || action === "rename-note" || action === "archive-note" || action === "delete-note") {
    return note?.relativePath
  }
  return undefined
}

function isNoteSpace(relativePath: string): boolean {
  return relativePath === "" || relativePath === "note" || relativePath.startsWith("note/")
}

export function App() {
  const workspaceState = useWorkspace()
  const { theme, toggleTheme } = useThemePreference()
  const panes = useResponsivePanes()
  const [folder, setFolder] = useState("")
  const [query, setQuery] = useState("")
  const [notes, setNotes] = useState<(NoteSummaryView | SearchResultView)[]>([])
  const [folders, setFolders] = useState<FolderView[]>([])
  const [selectedNote, setSelectedNote] = useState<NoteDetailView | null>(null)
  const [body, setBody] = useState("")
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState("Idle")
  const [palette, setPalette] = useState(false)
  const [actionBox, setActionBox] = useState<ActionBox>(null)
  const [actionValue, setActionValue] = useState("")
  const [actionDestination, setActionDestination] = useState("note")
  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionTargetNote, setActionTargetNote] = useState<NoteDetailView | null>(null)
  const [actionTargetFolder, setActionTargetFolder] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatusSummary | null>(null)
  const [aiConfig, setAiConfig] = useState<AiConfigView | null>(null)
  const [aiQueue, setAiQueue] = useState<AiQueueView | null>(null)
  const [codexAuth, setCodexAuth] = useState<CodexAuthStatusView | null>(null)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  const refreshAiData = useCallback(async () => {
    const [nextStatus, nextConfig, nextQueue, nextCodexAuth] = await Promise.all([
      api.aiStatus().catch(() => null),
      api.aiConfig().catch(() => null),
      api.aiQueue().catch(() => ({ jobs: [] })),
      api.codexAuthStatus().catch(() => null),
    ])
    setAiStatus(nextStatus)
    setAiConfig(nextConfig)
    setAiQueue(nextQueue)
    setCodexAuth(nextCodexAuth)
  }, [])

  useEffect(() => {
    void refreshWorkspaceData()
  }, [refreshWorkspaceData])

  useEffect(() => {
    if (!workspaceState.workspace?.initialized) return
    void refreshAiData()
  }, [refreshAiData, workspaceState.workspace?.initialized])

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
  const defaultDestinationFolder = isNoteSpace(folder) ? folder || "note" : "note"

  const closeActionBox = useCallback(({ force = false }: { force?: boolean } = {}) => {
    if (submittingActionRef.current && !force) return
    setActionBox(null)
    setActionValue("")
    setActionDestination(defaultDestinationFolder)
    setSubmittingAction(false)
    setActionTargetNote(null)
    setActionTargetFolder(null)
    submittingActionRef.current = false
  }, [defaultDestinationFolder])

  const openActionBox = useCallback((action: Exclude<ActionBox, null>) => {
    setActionBox(action)
    setActionTargetFolder(null)
    setActionTargetNote(selectedNote)
    if (action === "new-note" || action === "new-folder") {
      setActionTargetNote(null)
      setActionValue("")
      setActionDestination(defaultDestinationFolder)
      return
    }
    if (action === "save-draft-as" || action === "rename-note") {
      setActionValue(selectedNote?.title ?? "")
      setActionDestination(defaultDestinationFolder)
      return
    }
    if (action === "rename-folder") {
      setActionValue(folder.split("/").filter(Boolean).at(-1) ?? "")
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
  }, [defaultDestinationFolder, folder, selectedNote])

  const openManagerNoteAction = useCallback(async (action: NoteManagerAction, noteKey: string) => {
    setActionTargetFolder(null)
    const targetNote = selectedNote?.key === noteKey ? selectedNote : await api.note(noteKey)
    const targetFolder = noteFolderFromRelativePath(targetNote.relativePath)
    setActionBox(action)
    setActionTargetNote(targetNote)
    if (action === "save-draft-as" || action === "rename-note") {
      setActionValue(targetNote.title)
      setActionDestination(isNoteSpace(targetFolder) ? targetFolder : defaultDestinationFolder)
      return
    }
    if (action === "move-note") {
      setActionValue("")
      setActionDestination(isNoteSpace(targetFolder) ? targetFolder : defaultDestinationFolder)
      return
    }
    setActionValue("")
    setActionDestination(defaultDestinationFolder)
  }, [defaultDestinationFolder, selectedNote])

  const openManagerFolderAction = useCallback((folderPath: string) => {
    setActionBox("rename-folder")
    setActionTargetNote(null)
    setActionTargetFolder(folderPath)
    setActionValue(folderPath.split("/").filter(Boolean).at(-1) ?? "")
    setActionDestination(folderPath)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      const commandKey = event.ctrlKey || event.metaKey
      const editableTarget = isEditableTarget(event.target)
      const editorTextareaTarget = isEditorTextareaTarget(event.target)
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
      if (actionBox) return

      if ((commandKey && key === "k") || (event.altKey && key === "p")) {
        event.preventDefault()
        setPalette((prev) => !prev)
        return
      }

      if (editableTarget && !editorTextareaTarget) return

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

  const activeActionNote = actionTargetNote ?? selectedNote

  const ensureTargetNoteClean = useCallback(async (targetNote: NoteDetailView | null | undefined): Promise<boolean> => {
    if (!targetNote || selectedKeyRef.current !== targetNote.key || !dirtyRef.current) return true
    if (!window.confirm("Save changes before continuing?")) {
      setSaveState("Save changes before continuing")
      return false
    }
    const saved = await save()
    if (!saved) setSaveState("Save changes before continuing")
    return saved
  }, [save])

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
        if (!activeActionNote || activeActionNote.folder === "draft") return
        if (!await ensureTargetNoteClean(activeActionNote)) return
        const moved = await api.moveNote(activeActionNote.key, actionDestination)
        shouldCloseActionBox = true
        await refreshWorkspaceData()
        if (selectedKeyRef.current === activeActionNote.key) await selectNote(moved.key)
        return
      }
      if (actionBox === "rename-note") {
        if (!activeActionNote || !value) return
        const renameKey = activeActionNote.key
        const submittedBody = selectedKeyRef.current === renameKey ? bodyRef.current : activeActionNote.body
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
      if (actionBox === "rename-folder") {
        if (!actionTargetFolder || !value) return
        if (!await ensureCleanBeforeMutation()) return
        const renamedFolder = await api.renameFolder(actionTargetFolder, value)
        shouldCloseActionBox = true
        await refreshWorkspaceData()
        openFolder(renamedFolder.relativePath)
        return
      }
      if (actionBox === "archive-note") {
        if (!activeActionNote) return
        if (!await ensureTargetNoteClean(activeActionNote)) return
        await api.archiveNote(activeActionNote.key)
        shouldCloseActionBox = true
        if (selectedKeyRef.current === activeActionNote.key) {
          setSelectedNote(null)
          setBody("")
          bodyRef.current = ""
          setDirty(false)
          dirtyRef.current = false
        }
        await refreshWorkspaceData()
        return
      }
      if (actionBox === "delete-note") {
        if (!activeActionNote) return
        if (!await ensureTargetNoteClean(activeActionNote)) return
        await api.deleteNote(activeActionNote.key)
        shouldCloseActionBox = true
        if (selectedKeyRef.current === activeActionNote.key) {
          setSelectedNote(null)
          setBody("")
          bodyRef.current = ""
          setDirty(false)
          dirtyRef.current = false
        }
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

  async function openAiDialog() {
    setAiDialogOpen(true)
    await refreshAiData()
  }

  async function saveAiConfigFromDialog(config: unknown) {
    await api.saveAiConfig(config)
    await refreshAiData()
  }

  async function describeCurrentNoteWithAi() {
    if (!selectedNote) {
      throw new Error("Select a note before running AI describe.")
    }
    await api.aiDescribe({ selector: selectedNote.key })
    await Promise.all([refreshWorkspaceData(), refreshAiData()])
    await selectNote(selectedNote.key, false)
  }

  async function processAiQueueFromDialog() {
    const result = await api.aiProcessQueue()
    await Promise.all([refreshWorkspaceData(), refreshAiData()])
    return result
  }

  async function startCodexAuthFromDialog() {
    return api.startCodexAuth()
  }

  async function logoutCodexFromDialog() {
    await api.deleteCodexAuth()
    await refreshAiData()
  }

  const commands = buildCommands({
    newNote: () => openActionBox("new-note"),
    quickDraft: () => void createDraft(),
    save: () => void save(),
    deleteNote: () => openActionBox("delete-note"),
    archiveNote: () => openActionBox("archive-note"),
    rebuild: () => void api.rebuild().then(refreshWorkspaceData),
    togglePreview: panes.togglePreview,
    setup: () => void workspaceState.refresh(),
  }, selectedNote)

  // Pane resize must be before any early returns (React rules of hooks)
  const resize = usePaneResize()

  if (workspaceState.loading) return <main className="setup-screen"><p>Loading…</p></main>
  if (!workspaceState.workspace?.initialized) return <SetupScreen defaultRootPath={workspaceState.workspace?.defaultRootPath} error={workspaceState.error} onSubmit={workspaceState.open} />

  return (
    <AppShell
      workspace={workspaceState.workspace}
      aiStatus={aiStatus}
      noteCount={notes.length}
      theme={theme}
      panes={panes}
      onToggleTheme={toggleTheme}
      onPalette={() => setPalette(true)}
      onAi={() => void openAiDialog()}
      onSettings={() => setSettingsOpen(true)}
      currentNotePath={selectedNote?.relativePath ?? null}
    >
      <div
        className={`main-grid ${panes.managerVisible ? "manager-visible" : "manager-hidden"} ${panes.previewVisible ? "preview-visible" : "preview-hidden"}`}
        style={{
          gridTemplateColumns: [
            panes.managerVisible ? `${resize.managerWidth}px` : null,
            panes.managerVisible ? "4px" : null,
            "minmax(0, 1fr)",
            panes.previewVisible ? "4px" : null,
            panes.previewVisible ? `${resize.previewWidth}px` : null,
          ].filter(Boolean).join(" "),
        }}
      >
        {panes.managerVisible ? (
          <>
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
              onRenameNote={(noteKey) => { void openManagerNoteAction("rename-note", noteKey) }}
              onMoveNote={(noteKey) => { void openManagerNoteAction("move-note", noteKey) }}
              onPromoteNote={(noteKey) => { void openManagerNoteAction("save-draft-as", noteKey) }}
              onArchiveNote={(noteKey) => { void openManagerNoteAction("archive-note", noteKey) }}
              onDeleteNote={(noteKey) => { void openManagerNoteAction("delete-note", noteKey) }}
              onRenameFolder={(folderPath) => openManagerFolderAction(folderPath)}
              canGoBack={navigationHistoryRef.current.canBack()}
              canGoForward={navigationHistoryRef.current.canForward()}
            />
            {/* Manager resize divider */}
            <div
              className="pane-divider pane-divider--manager"
              onMouseDown={resize.onManagerDividerMouseDown}
              aria-hidden="true"
              title="Drag to resize"
            />
          </>
        ) : null}
        <EditorPane
          note={selectedNote}
          body={body}
          dirty={dirty}
          saveState={saveState}
          onBodyChange={(next) => { setBody(next); bodyRef.current = next; setDirty(true); dirtyRef.current = true; setSaveState("Unsaved") }}
          onSave={() => void save()}
          onPromote={() => openActionBox("save-draft-as")}
          onNewNote={() => openActionBox("new-note")}
          onNewFolder={() => openActionBox("new-folder")}
          onRename={() => openActionBox("rename-note")}
          onMove={() => openActionBox("move-note")}
          onSearch={() => setPalette(true)}
          previewVisible={panes.previewVisible}
          onTogglePreview={panes.togglePreview}
        />
        {panes.previewVisible ? (
          <>
            {/* Preview resize divider */}
            <div
              className="pane-divider pane-divider--preview"
              onMouseDown={resize.onPreviewDividerMouseDown}
              aria-hidden="true"
              title="Drag to resize"
            />
            <PreviewPane note={selectedNote ? { ...selectedNote, body } : null} onToggle={panes.hidePreview} />
          </>
        ) : null}
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
      <AiWorkspaceDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        status={aiStatus}
        config={aiConfig}
        queue={aiQueue}
        codexAuth={codexAuth}
        onRefresh={refreshAiData}
        onSaveConfig={saveAiConfigFromDialog}
        onDescribeCurrentNote={describeCurrentNoteWithAi}
        onProcessQueue={processAiQueueFromDialog}
        onStartCodexAuth={startCodexAuthFromDialog}
        onLogoutCodex={logoutCodexFromDialog}
      />
      <NoteCommandSurface
        open={Boolean(actionBox)}
        title={actionTitle(actionBox)}
        description={actionDescription(actionBox, activeActionNote)}
        context={actionContext(actionBox, activeActionNote, actionDestination, actionTargetFolder ?? undefined)}
        onClose={closeActionBox}
        busy={submittingAction}
      >
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
          {actionBox === "rename-folder" ? (
            <label>
              <span>Folder name</span>
              <input autoFocus value={actionValue} onChange={(event) => setActionValue(event.target.value)} placeholder="Folder name" />
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
          {actionBox === "archive-note" ? <p>Archive “{activeActionNote?.title}”?</p> : null}
          {actionBox === "delete-note" ? <p>Delete “{activeActionNote?.title}”? This cannot be undone.</p> : null}
          <div className="action-buttons">
            <button type="button" onClick={() => closeActionBox()} disabled={submittingAction}>Cancel</button>
            <button className={actionBox === "delete-note" ? "btn-danger" : "btn-primary"} type="submit" disabled={submittingAction || ((actionBox === "new-note" || actionBox === "new-folder" || actionBox === "save-draft-as" || actionBox === "rename-note" || actionBox === "rename-folder") && !actionValue.trim())}>
              {actionBox === "delete-note" ? "Delete" : actionBox === "archive-note" ? "Archive" : actionBox === "move-note" ? "Move" : actionBox === "rename-note" || actionBox === "rename-folder" ? "Rename" : actionBox === "save-draft-as" ? "Save to notes" : "Save"}
            </button>
          </div>
        </form>
      </NoteCommandSurface>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme === "light" ? "light" : "dark"}
        onThemeChange={(t) => { if (t === "light" && theme !== "light") toggleTheme(); else if (t === "dark" && theme !== "dark") toggleTheme(); }}
      />
    </AppShell>
  )
}
