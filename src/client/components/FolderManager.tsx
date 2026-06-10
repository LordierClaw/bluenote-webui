import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFileLines, faFilePen, faFolder, faFolderTree, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons"
import type { FolderView, NoteSummaryView, SearchResultView } from "../../shared/types"

type NoteListItem = NoteSummaryView | SearchResultView

function normalized(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
}

function parentOf(relativePath: string): string {
  const parts = normalized(relativePath).split("/").filter(Boolean)
  return parts.slice(0, -1).join("/")
}

function visibleFolders(folders: FolderView[], currentFolder: string): FolderView[] {
  const current = normalized(currentFolder)
  return folders.filter((folder) => parentOf(folder.relativePath) === current && folder.relativePath !== current)
}

function visibleNotes(notes: NoteListItem[], currentFolder: string, query: string): NoteListItem[] {
  const current = normalized(currentFolder)
  const needle = query.trim().toLowerCase()
  return notes
    .filter((note) => parentOf(note.relativePath) === current)
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

function noteIcon(note: NoteListItem) {
  return note.folder === "draft" ? faFilePen : faFileLines
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
  canGoBack = false,
  canGoForward = false,
}: {
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
  canGoBack?: boolean
  canGoForward?: boolean
}) {
  const childFolders = visibleFolders(folders, currentFolder)
  const childNotes = visibleNotes(notes, currentFolder, query)
  const crumbs = breadcrumb(currentFolder)
  const canCreate = normalized(currentFolder).startsWith("note")

  return (
    <section className="folder-manager" aria-label="Note navigation">
      <div className="manager-toolbar">
        <div className="history-controls" aria-label="Navigation history">
          <button type="button" aria-label="Go back" title="Back (Alt+ArrowLeft)" disabled={!canGoBack} onClick={onNavigateBack}>←</button>
          <button type="button" aria-label="Go forward" title="Forward (Alt+ArrowRight)" disabled={!canGoForward} onClick={onNavigateForward}>→</button>
        </div>
        <div className="breadcrumbs" aria-label="Current folder">
          {crumbs.map((crumb) => (
            <button key={crumb || "workspace"} className={crumb === normalized(currentFolder) ? "crumb active" : "crumb"} onClick={() => onOpenFolder(crumb)}>
              {crumbLabel(crumb)}
            </button>
          ))}
        </div>
        <div className="manager-actions">
          <button disabled={!canCreate} onClick={onCreateNote}>New note</button>
          <button disabled={!canCreate} onClick={onCreateFolder}>New folder</button>
          <button onClick={onQuickDraft}>Quick draft</button>
        </div>
      </div>
      <label className="manager-search">
        <span>Search in folder</span>
        <div className="manager-search-input">
          <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          <input value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Search notes, files, descriptions" />
        </div>
      </label>
      <div className="navigation-list" role="list" aria-label="Folders and notes">
          {childFolders.map((folder) => (
            <div key={folder.relativePath} role="listitem">
            <button className="navigation-item folder-row" aria-label={`Folder ${folder.name}`} onClick={() => onOpenFolder(folder.relativePath)}>
              <span className="nav-icon" aria-hidden="true"><FontAwesomeIcon icon={folder.relativePath === "note" || folder.relativePath.startsWith("note/") ? faFolderTree : faFolder} /></span>
              <span className="nav-main">
                <span className="nav-title">{folder.name}</span>
                <span className="nav-file">{folder.relativePath}</span>
                <span className="nav-description">{folder.noteCount} notes</span>
              </span>
            </button>
            </div>
          ))}
          {childNotes.map((note) => (
            <div key={note.relativePath} role="listitem">
            <button className={`navigation-item note-row ${selectedKey === note.key ? "selected" : ""}`} aria-label={`${noteKindLabel(note)} ${note.title}`} onClick={() => onSelectNote(note.key)}>
              <span className="nav-icon" aria-hidden="true"><FontAwesomeIcon icon={noteIcon(note)} /></span>
              <span className="nav-main">
                <span className="nav-title">{note.title}</span>
                <span className="nav-file">{note.relativePath || filenameOf(note.relativePath)}</span>
                <span className="nav-description">{note.description || "No description"}</span>
              </span>
            </button>
            </div>
          ))}
          {childFolders.length === 0 && childNotes.length === 0 ? <p className="empty">No items in this folder.</p> : null}
      </div>
    </section>
  )
}
