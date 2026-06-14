import { useEffect, useState } from "react"
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


function noteKindLabel(note: NoteListItem): string {
  return note.folder === "draft" ? "Draft note" : "Normal note"
}

function folderIconLabel(relativePath: string): string {
  return relativePath === "note" || relativePath.startsWith("note/") ? "Notes folder" : "Folder"
}

function noteDescription(note: NoteListItem): string {
  return note.description || "No description"
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
  const [newDropdownOpen, setNewDropdownOpen] = useState(false)

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
    : `${childFolders.length}f · ${childNotes.length}n`
  const selectedNote = childNotes.find((note) => note.key === selectedKey) ?? notes.find((note) => note.key === selectedKey)
  const currentFolderView = folders.find((folder) => normalized(folder.relativePath) === current)
  const showFolderActions = !selectedNote && Boolean(current) && isNoteSpace(current)

  useEffect(() => {
    setManagerActionSurface(null)
  }, [current, selectedKey])

  useEffect(() => {
    if (!newDropdownOpen) return
    function close() { setNewDropdownOpen(false) }
    document.addEventListener("click", close, { once: true })
    return () => document.removeEventListener("click", close)
  }, [newDropdownOpen])

  function runManagerAction(action: (() => void) | undefined) {
    setManagerActionSurface(null)
    action?.()
  }

  return (
    <section className="folder-manager" aria-label="Note navigation">
      {/* ── Toolbar ── */}
      <div className="manager-toolbar">
        {/* History nav */}
        <div className="history-controls" aria-label="Navigation history">
          <button
            type="button"
            aria-label="Go back"
            title="Back (Alt+ArrowLeft)"
            disabled={!canGoBack}
            onClick={onNavigateBack}
          >
            <span className="material-symbols-outlined icon-sm" aria-hidden="true">chevron_left</span>
          </button>
          <button
            type="button"
            aria-label="Go forward"
            title="Forward (Alt+ArrowRight)"
            disabled={!canGoForward}
            onClick={onNavigateForward}
          >
            <span className="material-symbols-outlined icon-sm" aria-hidden="true">chevron_right</span>
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="breadcrumbs" aria-label="Current folder">
          {crumbs.map((crumb, i) => (
            <span key={crumb || "workspace"} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              {i > 0 ? <span className="crumb-sep" aria-hidden="true">/</span> : null}
              <button
                type="button"
                className={crumb === current ? "crumb active" : "crumb"}
                onClick={() => onOpenFolder(crumb)}
              >
                {crumbLabel(crumb)}
              </button>
            </span>
          ))}
        </div>

        {onHideManager ? (
          <button
            type="button"
            className="manager-toolbar__hide btn-ghost"
            aria-label="Hide sidebar"
            title="Hide sidebar"
            onClick={onHideManager}
          >
            <span className="material-symbols-outlined icon-sm" aria-hidden="true">chevron_left</span>
          </button>
        ) : null}
      </div>

      {/* ── Sidebar Body ── */}
      <div className="manager-sidebar">
        {/* EXPLORER header */}
        <div className="explorer-header">
          <span className="label-caps">Explorer</span>
          <span className="manager-summary-pill" aria-label={matchesLabel}>{matchesLabel}</span>
        </div>

        {/* Filter input */}
        <div className="manager-filter">
          <div className="manager-filter-input">
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            <input
              value={query}
              onChange={(e) => onQuery?.(e.target.value)}
              placeholder="Filter..."
              aria-label="Filter notes and folders"
            />
            {query ? (
              <button
                type="button"
                onClick={() => onQuery?.("")}
                aria-label="Clear filter"
                style={{ border: "none", background: "transparent", padding: "0", cursor: "pointer", color: "var(--on-surface-variant)", display: "flex", alignItems: "center" }}
              >
                <span className="material-symbols-outlined icon-xs" aria-hidden="true">close</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Action buttons: New dropdown + Quick Draft */}
        <div className="manager-actions" role="toolbar" aria-label="Explorer actions">
          {/* New button with dropdown */}
          <div className="btn-new-dropdown" style={{ position: "relative", flex: 1 }}>
            <button
              type="button"
              className="btn-new-main"
              onClick={(e) => { e.stopPropagation(); setNewDropdownOpen((v) => !v) }}
              aria-label="New note or folder"
              aria-expanded={newDropdownOpen}
              aria-haspopup="menu"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span className="material-symbols-outlined icon-sm" aria-hidden="true">add</span>
                <span>New</span>
              </div>
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">expand_more</span>
            </button>
            {newDropdownOpen && (
              <div
                className="btn-new-dropdown-menu"
                style={{ display: "flex" }}
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="btn-new-dropdown-item"
                  role="menuitem"
                  disabled={!canCreateNote}
                  onClick={() => { setNewDropdownOpen(false); onCreateNote?.() }}
                  aria-label="New note"
                >
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">note_add</span>
                  <span>New Note</span>
                </button>
                <button
                  type="button"
                  className="btn-new-dropdown-item"
                  role="menuitem"
                  disabled={!canCreateFolder}
                  onClick={() => { setNewDropdownOpen(false); onCreateFolder() }}
                  aria-label="New folder"
                >
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">create_new_folder</span>
                  <span>New Folder</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Draft */}
          <button
            type="button"
            className="btn-quick-draft"
            onClick={onQuickDraft}
            aria-label="Quick draft"
            title="Create a quick draft note"
          >
            <span className="material-symbols-outlined icon-sm" aria-hidden="true">flash_on</span>
            <span>Draft</span>
          </button>
        </div>

        {/* ── Tree View ── */}
        <div
          className="navigation-list"
          role="list"
          aria-label="Explorer items"
        >
          {/* Folders */}
          {childFolders.map((folder) => (
            <div key={folder.relativePath} role="listitem">
              <button
                type="button"
                className="tree-item-folder"
                aria-label={`${folderIconLabel(folder.relativePath)}: ${folder.name}`}
                onClick={() => onOpenFolder(folder.relativePath)}
              >
                <span className="material-symbols-outlined icon-sm tree-icon-expand" aria-hidden="true">chevron_right</span>
                <span className="material-symbols-outlined icon-sm tree-icon" aria-hidden="true">
                  {folder.relativePath === "note" || folder.relativePath.startsWith("note/") ? "folder_special" : "folder"}
                </span>
                <span className="tree-item-label">{folder.name}</span>
                <span
                  style={{ marginLeft: "auto", fontSize: "10px", color: "var(--outline)", flexShrink: 0, paddingLeft: "4px" }}
                  aria-label={`${folder.noteCount} notes`}
                >
                  {folder.noteCount}
                </span>
                {onRenameFolder ? (
                  <div className="tree-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      title="Rename folder"
                      aria-label={`Rename folder ${folder.name}`}
                      onClick={() => onRenameFolder(folder.relativePath)}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                    </button>
                  </div>
                ) : null}
              </button>
            </div>
          ))}

          {/* Notes */}
          {childNotes.map((note) => (
            <div key={note.relativePath} role="listitem">
              <button
                type="button"
                className={`tree-item-note${selectedKey === note.key ? " selected" : ""}`}
                aria-label={`${noteKindLabel(note)}: ${note.title}`}
                aria-current={selectedKey === note.key ? "true" : undefined}
                onClick={() => onSelectNote(note.key)}
                title={noteDescription(note)}
              >
                <span className="material-symbols-outlined icon-sm tree-icon" aria-hidden="true">
                  {note.folder === "draft" ? "edit_note" : "description"}
                </span>
                <span className="tree-item-label">{note.title}</span>
                {/* Note context actions on hover */}
                {(onRenameNote || onMoveNote || onDeleteNote) ? (
                  <div className="tree-item-actions" onClick={(e) => e.stopPropagation()}>
                    {onRenameNote ? (
                      <button type="button" title="Rename" aria-label={`Rename ${note.title}`} onClick={() => onRenameNote(note.key)}>
                        <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                      </button>
                    ) : null}
                    {onMoveNote && note.folder !== "draft" ? (
                      <button type="button" title="Move" aria-label={`Move ${note.title}`} onClick={() => onMoveNote(note.key)}>
                        <span className="material-symbols-outlined" aria-hidden="true">drive_file_move</span>
                      </button>
                    ) : null}
                    {onDeleteNote ? (
                      <button type="button" title="Delete" aria-label={`Delete ${note.title}`} onClick={() => onDeleteNote(note.key)} style={{ color: "var(--error)" }}>
                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </button>
            </div>
          ))}

          {totalVisibleItems === 0 ? (
            <p className="empty" aria-live="polite">
              {activeSearch ? `No matches for "${query}"` : "No notes or folders here."}
            </p>
          ) : null}
        </div>

        {/* ── Context bar (selected note or folder actions) ── */}
        {selectedNote ? (
          <>
            <div className="manager-context-bar" role="toolbar" aria-label={`Actions for ${selectedNote.title}`}>
              <div className="manager-context-summary" aria-hidden="true">
                <span className="manager-context-summary__label">Selected</span>
                <span className="manager-context-summary__value">{selectedNote.title}</span>
              </div>
              <button
                type="button"
                className="manager-context-trigger"
                onClick={() => setManagerActionSurface("note")}
                aria-label={`Open actions for ${selectedNote.title}`}
              >
                <span className="material-symbols-outlined icon-sm" aria-hidden="true">more_horiz</span>
                <span>Actions</span>
              </button>
            </div>
            <ActionDialog
              open={managerActionSurface === "note"}
              title={`Actions for ${selectedNote.title}`}
              onClose={() => setManagerActionSurface(null)}
              className="manager-context-dialog"
            >
              <div className="manager-context-dialog__actions" role="group" aria-label={`Actions for ${selectedNote.title}`}>
                <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onRenameNote?.(selectedNote.key))} aria-label="Rename note">
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">edit</span>
                  <span>Rename</span>
                </button>
                {selectedNote.folder !== "draft" ? (
                  <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onMoveNote?.(selectedNote.key))} aria-label="Move note">
                    <span className="material-symbols-outlined icon-sm" aria-hidden="true">drive_file_move</span>
                    <span>Move</span>
                  </button>
                ) : null}
                {selectedNote.folder !== "draft" ? (
                  <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onArchiveNote?.(selectedNote.key))} aria-label="Archive note">
                    <span className="material-symbols-outlined icon-sm" aria-hidden="true">inventory_2</span>
                    <span>Archive</span>
                  </button>
                ) : null}
                <button type="button" className="manager-context-dialog__button danger" onClick={() => runManagerAction(() => onDeleteNote?.(selectedNote.key))} aria-label="Delete note">
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">delete</span>
                  <span>Delete</span>
                </button>
              </div>
            </ActionDialog>
          </>
        ) : null}

        {showFolderActions ? (
          <>
            <div className="manager-context-bar" role="toolbar" aria-label={`Actions for folder ${currentFolderView?.name ?? crumbLabel(current)}`}>
              <div className="manager-context-summary" aria-hidden="true">
                <span className="manager-context-summary__label">Folder</span>
                <span className="manager-context-summary__value">{currentFolderView?.name ?? crumbLabel(current)}</span>
              </div>
              <button
                type="button"
                className="manager-context-trigger"
                onClick={() => setManagerActionSurface("folder")}
                aria-label={`Open actions for folder ${currentFolderView?.name ?? crumbLabel(current)}`}
              >
                <span className="material-symbols-outlined icon-sm" aria-hidden="true">more_horiz</span>
                <span>Actions</span>
              </button>
            </div>
            <ActionDialog
              open={managerActionSurface === "folder"}
              title={`Actions for folder ${currentFolderView?.name ?? crumbLabel(current)}`}
              onClose={() => setManagerActionSurface(null)}
              className="manager-context-dialog"
            >
              <div className="manager-context-dialog__actions" role="group" aria-label={`Actions for folder ${currentFolderView?.name ?? crumbLabel(current)}`}>
                <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onOpenFolder(current))} aria-label="Open folder">
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">folder_open</span>
                  <span>Open folder</span>
                </button>
                <button type="button" className="manager-context-dialog__button" onClick={() => runManagerAction(() => onRenameFolder?.(current))} aria-label="Rename folder">
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">edit</span>
                  <span>Rename</span>
                </button>
                <button type="button" className="manager-context-dialog__button" disabled={!canCreateNote} onClick={() => runManagerAction(onCreateNote)} aria-label="New note">
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">note_add</span>
                  <span>New note</span>
                </button>
                <button type="button" className="manager-context-dialog__button" disabled={!canCreateFolder} onClick={() => runManagerAction(onCreateFolder)} aria-label="New folder">
                  <span className="material-symbols-outlined icon-sm" aria-hidden="true">create_new_folder</span>
                  <span>New folder</span>
                </button>
              </div>
            </ActionDialog>
          </>
        ) : null}
      </div>
    </section>
  )
}
