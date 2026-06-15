import { useEffect, useMemo, useState } from "react"
import type { FolderView, NoteSummaryView, SearchResultView } from "../../shared/types"

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

function isNoteSpace(relativePath: string): boolean {
  const current = normalized(relativePath)
  return current === "" || current === "note" || current.startsWith("note/")
}

function childFoldersOf(folders: FolderView[], parentPath: string): FolderView[] {
  const parent = normalized(parentPath)
  return folders.filter((f) => parentOf(f.relativePath) === parent)
}

function childNotesOf(notes: NoteListItem[], parentPath: string): NoteListItem[] {
  const parent = normalized(parentPath)
  return notes.filter((n) => parentOf(n.relativePath) === parent)
}

function filterNotes(notes: NoteListItem[], query: string): NoteListItem[] {
  if (!query.trim()) return notes
  const q = query.trim().toLowerCase()
  return notes.filter((n) => `${n.title} ${n.description} ${n.relativePath}`.toLowerCase().includes(q))
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
  onPromoteNote?: NoteActionHandler
  onArchiveNote?: NoteActionHandler
  onDeleteNote?: NoteActionHandler
  onRenameFolder?: FolderActionHandler
  canGoBack?: boolean
  canGoForward?: boolean
}

function folderMatchesQueryOrHasDescendants(
  folder: FolderView,
  allFolders: FolderView[],
  allNotes: NoteListItem[],
  query: string
): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  if (`${folder.name} ${folder.relativePath}`.toLowerCase().includes(q)) return true

  const folderPath = normalized(folder.relativePath)
  const matchingNotes = allNotes.filter((n) => {
    const notePath = normalized(n.relativePath)
    return notePath.startsWith(folderPath + "/") &&
           (`${n.title} ${n.description} ${n.relativePath}`.toLowerCase().includes(q))
  })
  if (matchingNotes.length > 0) return true

  const subfolders = allFolders.filter((f) => parentOf(f.relativePath) === folderPath)
  for (const sub of subfolders) {
    if (folderMatchesQueryOrHasDescendants(sub, allFolders, allNotes, query)) {
      return true
    }
  }
  return false
}

// Recursive tree node
function TreeFolder({
  folder,
  depth,
  allFolders,
  allNotes,
  selectedKey,
  query,
  onOpenFolder,
  onSelectNote,
  onRenameNote,
  onMoveNote,
  onArchiveNote,
  onDeleteNote,
  onRenameFolder,
  onCreateNote,
  onCreateFolder,
}: {
  folder: FolderView
  depth: number
  allFolders: FolderView[]
  allNotes: NoteListItem[]
  selectedKey?: string
  query: string
  onOpenFolder: (folder: string) => void
  onSelectNote: (id: string) => void
  onRenameNote?: NoteActionHandler
  onMoveNote?: NoteActionHandler
  onArchiveNote?: NoteActionHandler
  onDeleteNote?: NoteActionHandler
  onRenameFolder?: FolderActionHandler
  onCreateNote?: () => void
  onCreateFolder?: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selectedKey) {
      const selected = allNotes.find(n => n.key === selectedKey)
      const selectedParent = selected ? parentOf(selected.relativePath) : ""
      const folderPath = normalized(folder.relativePath)
      if (selected && (selectedParent === folderPath || selectedParent.startsWith(folderPath + "/"))) {
        setOpen(true)
      }
    }
  }, [selectedKey, allNotes, folder.relativePath])

  const childFolders = useMemo(() => childFoldersOf(allFolders, folder.relativePath), [allFolders, folder.relativePath])
  const childNotes = useMemo(() => {
    const raw = childNotesOf(allNotes, folder.relativePath)
    return query ? filterNotes(raw, query) : raw
  }, [allNotes, folder.relativePath, query])
  const filteredChildFolders = useMemo(() => {
    if (!query) return childFolders
    return childFolders.filter((f) => folderMatchesQueryOrHasDescendants(f, allFolders, allNotes, query))
  }, [childFolders, allFolders, allNotes, query])

  const hasChildren = childFolders.length > 0 || allNotes.some((n) => parentOf(n.relativePath) === normalized(folder.relativePath))
  const expanded = open || Boolean(query.trim())
  const indent = depth * 12

  return (
    <>
      {/* Folder row */}
      <div role="listitem" className="tree-row tree-row--folder" style={{ paddingLeft: `${8 + indent}px` }}>
        <button
          type="button"
          className={`tree-toggle${hasChildren ? "" : " tree-toggle--leaf"}`}
          onClick={() => hasChildren && setOpen((v) => !v)}
          aria-label={expanded ? "Collapse folder" : "Expand folder"}
          tabIndex={-1}
        >
          {hasChildren ? (
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "14px" }}>
              {expanded ? "expand_more" : "chevron_right"}
            </span>
          ) : (
            <span style={{ width: "14px", display: "inline-block" }} />
          )}
        </button>
        <button
          type="button"
          className="tree-row__folder-btn"
          aria-label={`folder ${folder.name}`}
          onClick={() => {
            if (hasChildren) setOpen((v) => !v)
            onOpenFolder(folder.relativePath)
          }}
        >
          <span className="material-symbols-outlined tree-row__icon" aria-hidden="true">
            {folder.relativePath === "draft" ? "edit_note" : folder.relativePath.startsWith("note") ? "folder_special" : "folder"}
          </span>
          <span className="tree-row__label">{folder.name}</span>
          {folder.noteCount > 0 && <span className="tree-row__count">{folder.noteCount}</span>}
        </button>
        {onRenameFolder && isNoteSpace(folder.relativePath) ? (
          <button
            type="button"
            className="tree-row__action"
            aria-label={`Rename ${folder.name} folder`}
            title={`Rename ${folder.name}`}
            onClick={() => onRenameFolder(folder.relativePath)}
          >
            <span className="material-symbols-outlined icon-sm" aria-hidden="true">edit</span>
          </button>
        ) : null}
      </div>

      {/* Children */}
      {expanded && (
        <div className="tree-children">
          {filteredChildFolders.map((child) => (
            <TreeFolder
              key={child.relativePath}
              folder={child}
              depth={depth + 1}
              allFolders={allFolders}
              allNotes={allNotes}
              selectedKey={selectedKey}
              query={query}
              onOpenFolder={onOpenFolder}
              onSelectNote={onSelectNote}
              onRenameNote={onRenameNote}
              onMoveNote={onMoveNote}
              onArchiveNote={onArchiveNote}
              onDeleteNote={onDeleteNote}
              onRenameFolder={onRenameFolder}
              onCreateNote={onCreateNote}
              onCreateFolder={onCreateFolder}
            />
          ))}
          {childNotes.map((note) => (
            <TreeNote
              key={note.key}
              note={note}
              depth={depth + 1}
              selected={selectedKey === note.key}
              onSelect={onSelectNote}
            />
          ))}
        </div>
      )}
    </>
  )
}

function TreeNote({
  note,
  depth,
  selected,
  onSelect,
}: {
  note: NoteListItem
  depth: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  const indent = depth * 12
  return (
    <div role="listitem" style={{ display: "contents" }}>
      <button
        type="button"
        className={`tree-row tree-row--note${selected ? " selected" : ""}`}
        style={{ paddingLeft: `${8 + indent}px` }}
        onClick={() => onSelect(note.key)}
        aria-current={selected ? "true" : undefined}
        aria-label={`${note.folder === "draft" ? "draft" : "normal"} note ${note.title}`}
        title={note.description || undefined}
      >
        <span aria-label={`${note.folder === "draft" ? "draft" : "normal"} note`} className="sr-only" />
        <span style={{ width: "14px", flexShrink: 0 }} />
        <span className="material-symbols-outlined tree-row__icon" aria-hidden="true">
          {note.folder === "draft" ? "edit_note" : "description"}
        </span>
        <div className="tree-row__text">
          <span className="tree-row__label">{note.title}</span>
          {note.description && (
            <span className="tree-row__desc">{note.description}</span>
          )}
        </div>
        <span className="sr-only">{note.relativePath}</span>
      </button>
    </div>
  )
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
  onRenameNote,
  onMoveNote,
  onPromoteNote,
  onArchiveNote,
  onDeleteNote,
  onRenameFolder,
  canGoBack = false,
  canGoForward = false,
}: FolderManagerProps) {
  const [newDropdownOpen, setNewDropdownOpen] = useState(false)

  const explorerParent = normalized(currentFolder)
  const explorerParentParent = parentOf(explorerParent)
  const explorerParentLabel = explorerParentParent || "workspace root"

  // Root folders for the current directory
  const rootFolders = useMemo(() => {
    const raw = folders.filter((f) => parentOf(f.relativePath) === explorerParent)
    if (!query) return raw
    return raw.filter((f) => folderMatchesQueryOrHasDescendants(f, folders, notes, query))
  }, [explorerParent, folders, notes, query])

  const rootNotes = useMemo(() => {
    const raw = notes.filter((n) => parentOf(n.relativePath) === explorerParent)
    return query ? filterNotes(raw, query) : raw
  }, [explorerParent, notes, query])

  const selectedNote = notes.find((n) => n.key === selectedKey)

  useEffect(() => {
    if (!newDropdownOpen) return
    function close() { setNewDropdownOpen(false) }
    document.addEventListener("click", close, { once: true })
    return () => document.removeEventListener("click", close)
  }, [newDropdownOpen])

  const activeSearch = query.trim().length > 0

  const matchCount = useMemo(() => {
    if (!activeSearch) return 0
    let count = 0
    const q = query.toLowerCase()
    const parent = explorerParent
    
    for (const f of folders) {
      const fPath = normalized(f.relativePath)
      const isDescendant = parent === "" || fPath.startsWith(parent + "/")
      if (isDescendant && `${f.name} ${f.relativePath}`.toLowerCase().includes(q)) count++
    }
    for (const n of notes) {
      const nPath = normalized(n.relativePath)
      const isDescendant = parent === "" || nPath.startsWith(parent + "/")
      if (isDescendant && `${n.title} ${n.description} ${n.relativePath}`.toLowerCase().includes(q)) count++
    }
    return count
  }, [explorerParent, folders, notes, activeSearch, query])

  return (
    <section className="folder-manager" aria-label="Note navigation">
      {!activeSearch && <span className="sr-only">Ready to browse</span>}
      {/* ── Combined header bar (4 equal-width icon buttons) ── */}
      <div className="manager-header-bar">
        <button
          type="button"
          className="manager-header-btn"
          aria-label="Go back"
          title="Back (Alt+ArrowLeft)"
          disabled={!canGoBack}
          onClick={onNavigateBack}
        >
          <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
        </button>
        <button
          type="button"
          className="manager-header-btn"
          aria-label="Go forward"
          title="Forward (Alt+ArrowRight)"
          disabled={!canGoForward}
          onClick={onNavigateForward}
        >
          <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>

        {/* New (+) button */}
        <button
          type="button"
          className="manager-header-btn"
          onClick={(e) => { e.stopPropagation(); setNewDropdownOpen((v) => !v) }}
          aria-label="New note or folder"
          aria-expanded={newDropdownOpen}
          aria-haspopup="menu"
          title="New..."
        >
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
        </button>

        {/* New (+) dropdown */}
        {newDropdownOpen && (
          <div className="manager-dropdown-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="manager-dropdown-item"
              role="menuitem"
              disabled={!onCreateNote}
              onClick={() => { setNewDropdownOpen(false); onCreateNote?.() }}
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">note_add</span>
              New Note
            </button>
            <button
              type="button"
              className="manager-dropdown-item"
              role="menuitem"
              disabled={!isNoteSpace(currentFolder)}
              onClick={() => { setNewDropdownOpen(false); onCreateFolder() }}
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">create_new_folder</span>
              New Folder
            </button>
          </div>
        )}

        <button
          type="button"
          className="manager-header-btn"
          onClick={onQuickDraft}
          aria-label="Quick draft"
          title="New quick draft"
        >
          <span className="material-symbols-outlined" aria-hidden="true">edit_note</span>
        </button>
      </div>

      {/* ── Filter ── */}
      <div className="manager-filter">
        <div className="manager-filter-input">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <input
            value={query}
            onChange={(e) => onQuery?.(e.target.value)}
            placeholder="Filter..."
            aria-label="search in folder"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQuery?.("")}
              aria-label="Clear filter"
              className="manager-filter-clear"
            >
              <span className="material-symbols-outlined icon-xs" aria-hidden="true">close</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Tree View ── */}
      <div className="navigation-list tree-view" role="list" aria-label="Explorer items">
        {explorerParent ? (
          <div role="listitem" className="tree-row tree-row--folder tree-row--parent" style={{ paddingLeft: "8px" }}>
            <button
              type="button"
              className="tree-toggle tree-toggle--leaf"
              tabIndex={-1}
              aria-label="Parent folder"
              onClick={() => onOpenFolder(explorerParentParent)}
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: "14px" }}>
                arrow_upward
              </span>
            </button>
            <button
              type="button"
              className="tree-row__folder-btn"
              aria-label={`parent folder ${explorerParentLabel}`}
              onClick={() => onOpenFolder(explorerParentParent)}
            >
              <span className="material-symbols-outlined tree-row__icon" aria-hidden="true">drive_folder_upload</span>
              <span className="tree-row__label">..</span>
              <span className="tree-row__count">{explorerParentLabel}</span>
            </button>
          </div>
        ) : null}
        {rootFolders.map((folder) => (
          <TreeFolder
            key={folder.relativePath}
            folder={folder}
            depth={0}
            allFolders={folders}
            allNotes={notes}
            selectedKey={selectedKey}
            query={query}
            onOpenFolder={onOpenFolder}
            onSelectNote={onSelectNote}
            onRenameNote={onRenameNote}
            onMoveNote={onMoveNote}
            onArchiveNote={onArchiveNote}
            onDeleteNote={onDeleteNote}
            onRenameFolder={onRenameFolder}
            onCreateNote={onCreateNote}
            onCreateFolder={onCreateFolder}
          />
        ))}
        {rootNotes.map((note) => (
          <TreeNote
            key={note.key}
            note={note}
            depth={0}
            selected={selectedKey === note.key}
            onSelect={onSelectNote}
          />
        ))}
        {rootFolders.length === 0 && rootNotes.length === 0 && (
          <p className="empty" aria-live="polite">
            {activeSearch ? `No matches for "${query}"` : "No workspace items."}
          </p>
        )}
      </div>
      {activeSearch && (
        <div className="sr-only" aria-live="polite">
          {matchCount} matches
        </div>
      )}

      {/* ── Context bar: selected note inline actions ── */}
      {selectedNote ? (
        <div className="manager-context-bar" role="toolbar" aria-label={`manager actions for ${selectedNote.title}`}>
          <div className="manager-context-actions">
            <button
              type="button"
              className="manager-ctx-btn"
              onClick={() => onRenameNote?.(selectedNote.key)}
              aria-label="Rename"
              title="Rename"
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">edit</span>
              <span>Rename</span>
            </button>
            {selectedNote.folder !== "draft" && (
              <button
                type="button"
                className="manager-ctx-btn"
                onClick={() => onMoveNote?.(selectedNote.key)}
                aria-label="Move"
                title="Move"
              >
                <span className="material-symbols-outlined icon-sm" aria-hidden="true">drive_file_move</span>
                <span>Move</span>
              </button>
            )}
            {selectedNote.folder === "draft" && (
              <button
                type="button"
                className="manager-ctx-btn"
                onClick={() => onPromoteNote?.(selectedNote.key)}
                aria-label="Save draft as note"
                title="Save draft as note"
              >
                <span className="material-symbols-outlined icon-sm" aria-hidden="true">publish</span>
                <span>Save as Note</span>
              </button>
            )}
            {selectedNote.folder !== "draft" && (
              <button
                type="button"
                className="manager-ctx-btn"
                onClick={() => onArchiveNote?.(selectedNote.key)}
                aria-label="Archive"
                title="Archive"
              >
                <span className="material-symbols-outlined icon-sm" aria-hidden="true">inventory_2</span>
                <span>Archive</span>
              </button>
            )}
            <button
              type="button"
              className="manager-ctx-btn danger"
              onClick={() => onDeleteNote?.(selectedNote.key)}
              aria-label="Delete"
              title="Delete"
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">delete</span>
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : explorerParent && isNoteSpace(explorerParent) ? (
        <div className="manager-context-bar" role="toolbar" aria-label={`manager actions for ${explorerParent.split("/").filter(Boolean).at(-1) ?? explorerParent} folder`}>
          <div className="manager-context-actions">
            <button
              type="button"
              className="manager-ctx-btn"
              onClick={() => onRenameFolder?.(explorerParent)}
              aria-label="Rename folder"
              title="Rename folder"
              disabled={!onRenameFolder}
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">edit</span>
              <span>Rename Folder</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
