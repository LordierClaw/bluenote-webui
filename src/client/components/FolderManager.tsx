import { useEffect, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faArrowRightArrowLeft,
  faBoxArchive,
  faCaretLeft,
  faCaretRight,
  faEllipsis,
  faFileLines,
  faFilePen,
  faFolder,
  faFolderOpen,
  faFolderTree,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons"
import type { FolderView, NoteSummaryView, SearchResultView } from "../../shared/types"
import { ActionDialog } from "./ActionDialog"

type NoteListItem = NoteSummaryView | SearchResultView

type NoteActionHandler = (noteKey: string) => void
type FolderActionHandler = (folderPath: string) => void

function normalized(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
}

function parentOf(relativePath: string): string {
  const parts = normalized(relativePath).split("/").filter(Boolean)
  return parts.slice(0, -1).join("/")
}

function isDirectChild(relativePath: string, currentFolder: string): boolean {
  const current = normalized(currentFolder)
  return parentOf(relativePath) === current && normalized(relativePath) !== current
}

function isWithinFolder(relativePath: string, currentFolder: string): boolean {
  const current = normalized(currentFolder)
  const candidate = normalized(relativePath)
  if (!current) return true
  return candidate === current || candidate.startsWith(`${current}/`)
}

function isNoteSpace(relativePath: string): boolean {
  const current = normalized(relativePath)
  return current === "" || current === "note" || current.startsWith("note/")
}

function visibleFolders(folders: FolderView[], currentFolder: string, query: string): FolderView[] {
  const needle = query.trim().toLowerCase()
  return folders
    .filter((folder) => needle ? isWithinFolder(folder.relativePath, currentFolder) : isDirectChild(folder.relativePath, currentFolder))
    .filter((folder) => normalized(folder.relativePath) !== normalized(currentFolder))
    .filter((folder) => !needle || `${folder.name} ${folder.relativePath}`.toLowerCase().includes(needle))
}

function visibleNotes(notes: NoteListItem[], currentFolder: string, query: string): NoteListItem[] {
  const needle = query.trim().toLowerCase()
  return notes
    .filter((note) => needle ? isWithinFolder(note.relativePath, currentFolder) : isDirectChild(note.relativePath, currentFolder))
    .filter((note) => !needle || `${note.title} ${note.description} ${note.relativePath}`.toLowerCase().includes(needle))
}

function breadcrumb(relativePath: string): string[] {
  const parts = normalized(relativePath).split("/").filter(Boolean)
  return ["", ...parts.map((_, index) => parts.slice(0, index + 1).join("/"))]
}

function crumbLabel(crumb: string): string {
  return crumb ? crumb.split("/").at(-1) ?? crumb : "Workspace"
}

function filenameOf(relativePath: string): string {
  return relativePath.split("/").filter(Boolean).at(-1) ?? relativePath
}

function noteKindLabel(note: NoteListItem): string {
  return note.folder === "draft" ? "Draft note" : "Normal note"
}

function folderIconLabel(relativePath: string): string {
  return relativePath === "note" || relativePath.startsWith("note/") ? "Notes folder" : "Folder"
}

function noteIcon(note: NoteListItem) {
  return note.folder === "draft" ? faFilePen : faFileLines
}

function noteDescription(note: NoteListItem): string {
  return note.description || "No description"
}

function notePathLabel(note: NoteListItem): string {
  return note.relativePath || filenameOf(note.relativePath)
}

type FolderManagerProps = {
  currentFolder: string
  selectedKey?: string
  folders: FolderView[]
  notes: NoteListItem[]
  query?: string
  onQuery?: (query: string) => void
  onOpenFolder: (folder: string) => void
  onSelectNote: (id: string) => void
  onCreateFolder: () => void
  onCreateNote?: () => void
  onQuickDraft?: () => void
  onNavigateBack?: () => void
  onNavigateForward?: () => void
  onHideManager?: () => void
  onRenameNote?: NoteActionHandler
  onMoveNote?: NoteActionHandler
  onArchiveNote?: NoteActionHandler
  onDeleteNote?: NoteActionHandler
  onRenameFolder?: FolderActionHandler
  canGoBack?: boolean
  canGoForward?: boolean
}

export function FolderManager({
  currentFolder,
  selectedKey,
  folders,
  notes,
  query = "",
  onQuery,
  onOpenFolder,
  onSelectNote,
  onCreateFolder,
  onCreateNote,
  onQuickDraft,
  onNavigateBack,
  onNavigateForward,
  onHideManager,
  onRenameNote,
  onMoveNote,
  onArchiveNote,
  onDeleteNote,
  onRenameFolder,
  canGoBack = false,
  canGoForward = false,
}: FolderManagerProps) {
  const [managerActionSurface, setManagerActionSurface] = useState<"note" | "folder" | null>(null)
  const childFolders = visibleFolders(folders, currentFolder, query)
  const childNotes = visibleNotes(notes, currentFolder, query)
  const crumbs = breadcrumb(currentFolder)
  const current = normalized(currentFolder)
  const canCreateInNoteSpace = isNoteSpace(current)
  const canCreateFolder = canCreateInNoteSpace
  const canCreateNote = canCreateInNoteSpace && Boolean(onCreateNote)
  const totalVisibleItems = childFolders.length + childNotes.length
  const activeSearch = query.trim().length > 0
  const matchesLabel = activeSearch
    ? `${totalVisibleItems} ${totalVisibleItems === 1 ? "match" : "matches"}`
    : `${childFolders.length} ${childFolders.length === 1 ? "folder" : "folders"} · ${childNotes.length} ${childNotes.length === 1 ? "note" : "notes"}`
  const selectedNote = childNotes.find((note) => note.key === selectedKey) ?? notes.find((note) => note.key === selectedKey)
  const currentFolderView = folders.find((folder) => normalized(folder.relativePath) === current)
  const showFolderActions = !selectedNote && Boolean(current) && isNoteSpace(current)

  useEffect(() => {
    setManagerActionSurface(null)
  }, [current, selectedKey])

  function runManagerAction(action: (() => void) | undefined) {
    setManagerActionSurface(null)
    action?.()
  }

  return (
    <section className="folder-manager" aria-label="Note navigation">
      <div className="manager-toolbar">
        <div className="history-controls" aria-label="Navigation history">
          <button type="button" aria-label="Go back" title="Back (Alt+ArrowLeft)" disabled={!canGoBack} onClick={onNavigateBack}><FontAwesomeIcon icon={faCaretLeft} aria-hidden="true" /></button>
          <button type="button" aria-label="Go forward" title="Forward (Alt+ArrowRight)" disabled={!canGoForward} onClick={onNavigateForward}><FontAwesomeIcon icon={faCaretRight} aria-hidden="true" /></button>
        </div>
        <div className="breadcrumbs" aria-label="Current folder">
          {crumbs.map((crumb) => (
            <button type="button" key={crumb || "workspace"} className={crumb === current ? "crumb active" : "crumb"} onClick={() => onOpenFolder(crumb)}>
              {crumbLabel(crumb)}
            </button>
          ))}
        </div>
        {onHideManager ? (
          <button type="button" className="manager-toolbar__hide" aria-label="Hide manager" title="Hide manager" onClick={onHideManager}>
            <FontAwesomeIcon icon={faCaretLeft} aria-hidden="true" />
            <span>Hide</span>
          </button>
        ) : null}
      </div>

      <div className="manager-sidebar">
        <section className="manager-section manager-section--explorer" aria-label="Explorer">
          <div className="manager-section-header manager-section-header--compact manager-section-header--actions">
            <div>
              <h2>Explorer</h2>
              <p>{activeSearch ? `Filtering this folder · ${matchesLabel}` : `Ready to browse · ${matchesLabel}`}</p>
              {current ? <p className="manager-section-subtitle" title={current}>In {current}</p> : null}
            </div>
            <span className="manager-summary-pill" aria-label={matchesLabel}>{matchesLabel}</span>
          </div>
          <div className="manager-actions" role="toolbar" aria-label="Explorer actions">
            <button type="button" className="manager-utility-button manager-utility-button--primary" disabled={!canCreateNote} onClick={onCreateNote} aria-label="New note"><FontAwesomeIcon icon={faPlus} aria-hidden="true" /> <span>New note</span></button>
            <button type="button" className="manager-utility-button" disabled={!canCreateFolder} onClick={onCreateFolder} aria-label="New folder"><FontAwesomeIcon icon={faFolder} aria-hidden="true" /> <span>New folder</span></button>
            <button type="button" className="manager-utility-button manager-utility-button--ghost" onClick={onQuickDraft} aria-label="Quick draft"><FontAwesomeIcon icon={faFilePen} aria-hidden="true" /> <span>Quick draft</span></button>
          </div>
          <label className="manager-search">
            <span>Search in folder</span>
            <div className="manager-search-input">
              <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
              <input value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Search notes, files, descriptions, folders" />
            </div>
          </label>
          <div className="navigation-list navigation-list--unified" role="list" aria-label="Explorer items">
            {childFolders.map((folder) => (
              <div key={folder.relativePath} role="listitem">
                <button type="button" className="navigation-item folder-row" aria-label={`Folder ${folder.name}`} onClick={() => onOpenFolder(folder.relativePath)}>
                  <span className="nav-icon" role="img" aria-label={folderIconLabel(folder.relativePath)}><FontAwesomeIcon icon={folder.relativePath === "note" || folder.relativePath.startsWith("note/") ? faFolderTree : faFolder} aria-hidden="true" /></span>
                  <span className="nav-main">
                    <span className="nav-title">{folder.name}</span>
                    <span className="nav-file">{folder.relativePath}</span>
                    <span className="nav-description">{folder.noteCount} {folder.noteCount === 1 ? "note" : "notes"}</span>
                  </span>
                </button>
              </div>
            ))}
            {childNotes.map((note) => (
              <div key={note.relativePath} role="listitem">
                <button
                  type="button"
                  className={`navigation-item note-row ${selectedKey === note.key ? "selected" : ""}`}
                  aria-label={`${noteKindLabel(note)} ${note.title}`}
                  aria-current={selectedKey === note.key ? "true" : undefined}
                  onClick={() => onSelectNote(note.key)}
                >
                  <span className="nav-icon" role="img" aria-label={noteKindLabel(note)}><FontAwesomeIcon icon={noteIcon(note)} aria-hidden="true" /></span>
                  <span className="nav-main">
                    <span className="nav-title-row">
                      <span className="nav-title">{note.title}</span>
                    </span>
                    <span className="nav-file">{notePathLabel(note)}</span>
                    <span className="nav-description">{noteDescription(note)}</span>
                  </span>
                </button>
              </div>
            ))}
            {totalVisibleItems === 0 ? <p className="empty">No folders or notes in this view.</p> : null}
          </div>
          {selectedNote ? (
            <>
              <div className="manager-context-bar" role="toolbar" aria-label={`Manager actions for ${selectedNote.title}`}>
                <div className="manager-context-summary" aria-hidden="true">
                  <span className="manager-context-summary__label">Selected</span>
                  <span className="manager-context-summary__value">{selectedNote.title}</span>
                </div>
                <button type="button" className="manager-context-trigger" onClick={() => setManagerActionSurface("note")} aria-label={`Open actions for ${selectedNote.title}`}>
                  <FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
                  <span>Actions</span>
                </button>
              </div>
              <ActionDialog open={managerActionSurface === "note"} title={`Actions for ${selectedNote.title}`} onClose={() => setManagerActionSurface(null)} className="manager-context-dialog">
                <div className="manager-context-dialog__actions" role="group" aria-label={`Actions for ${selectedNote.title}`}>
                  <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onRenameNote?.(selectedNote.key))} aria-label="Rename note"><FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" /> <span>Rename</span></button>
                  {selectedNote.folder !== "draft" ? <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onMoveNote?.(selectedNote.key))} aria-label="Move note"><FontAwesomeIcon icon={faArrowRightArrowLeft} aria-hidden="true" /> <span>Move</span></button> : null}
                  {selectedNote.folder !== "draft" ? <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onArchiveNote?.(selectedNote.key))} aria-label="Archive note"><FontAwesomeIcon icon={faBoxArchive} aria-hidden="true" /> <span>Archive</span></button> : null}
                  <button type="button" className="manager-context-dialog__button danger" onClick={() => runManagerAction(() => onDeleteNote?.(selectedNote.key))} aria-label="Delete note"><FontAwesomeIcon icon={faTrashCan} aria-hidden="true" /> <span>Delete</span></button>
                </div>
              </ActionDialog>
            </>
          ) : null}
          {showFolderActions ? (
            <>
              <div className="manager-context-bar" role="toolbar" aria-label={`Manager actions for folder ${currentFolderView?.name ?? crumbLabel(current)}`}>
                <div className="manager-context-summary" aria-hidden="true">
                  <span className="manager-context-summary__label">Folder</span>
                  <span className="manager-context-summary__value">{currentFolderView?.name ?? crumbLabel(current)}</span>
                </div>
                <button type="button" className="manager-context-trigger" onClick={() => setManagerActionSurface("folder")} aria-label={`Open actions for folder ${currentFolderView?.name ?? crumbLabel(current)}`}>
                  <FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
                  <span>Actions</span>
                </button>
              </div>
              <ActionDialog open={managerActionSurface === "folder"} title={`Actions for folder ${currentFolderView?.name ?? crumbLabel(current)}`} onClose={() => setManagerActionSurface(null)} className="manager-context-dialog">
                <div className="manager-context-dialog__actions" role="group" aria-label={`Actions for folder ${currentFolderView?.name ?? crumbLabel(current)}`}>
                  <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onOpenFolder(current))} aria-label="Open folder"><FontAwesomeIcon icon={faFolderOpen} aria-hidden="true" /> <span>Open folder</span></button>
                  <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onRenameFolder?.(current))} aria-label="Rename folder"><FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" /> <span>Rename</span></button>
                  <button type="button" className="manager-context-dialog__button" disabled={!canCreateNote} onClick={() => runManagerAction(onCreateNote)} aria-label="New note"><FontAwesomeIcon icon={faPlus} aria-hidden="true" /> <span>New note</span></button>
                  <button type="button" className="manager-context-dialog__button" disabled={!canCreateFolder} onClick={() => runManagerAction(onCreateFolder)} aria-label="New folder"><FontAwesomeIcon icon={faFolder} aria-hidden="true" /> <span>New folder</span></button>
                </div>
              </ActionDialog>
            </>
          ) : null}
        </section>
      </div>
    </section>
  )
}
