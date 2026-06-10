import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faFileCirclePlus,
  faFolderPlus,
  faFloppyDisk,
  faMagnifyingGlass,
  faPenToSquare,
  faRightLeft,
  faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons"

type ShellActionBarProps = {
  canMutate: boolean
  canPromoteDraft: boolean
  onNewNote: () => void
  onNewFolder: () => void
  onRename: () => void
  onMove: () => void
  onSearch: () => void
  onSave: () => void
  onPromote: () => void
}

export function ShellActionBar({
  canMutate,
  canPromoteDraft,
  onNewNote,
  onNewFolder,
  onRename,
  onMove,
  onSearch,
  onSave,
  onPromote,
}: ShellActionBarProps) {
  return (
    <div className="shell-action-bar" role="toolbar" aria-label="Note actions">
      <button type="button" aria-label="New note" title="New note" onClick={onNewNote}>
        <FontAwesomeIcon icon={faFileCirclePlus} />
      </button>
      <button type="button" aria-label="New folder" title="New folder" onClick={onNewFolder}>
        <FontAwesomeIcon icon={faFolderPlus} />
      </button>
      <button type="button" aria-label="Rename note" title="Rename note" disabled={!canMutate} onClick={onRename}>
        <FontAwesomeIcon icon={faPenToSquare} />
      </button>
      <button type="button" aria-label="Move note" title="Move note" disabled={!canMutate} onClick={onMove}>
        <FontAwesomeIcon icon={faRightLeft} />
      </button>
      <button type="button" aria-label="Search everything" title="Search everything" onClick={onSearch}>
        <FontAwesomeIcon icon={faMagnifyingGlass} />
      </button>
      <button type="button" aria-label="Save note" title="Save note" disabled={!canMutate} onClick={onSave}>
        <FontAwesomeIcon icon={faFloppyDisk} />
      </button>
      <button type="button" aria-label="Save draft as" title="Save draft as" disabled={!canPromoteDraft} onClick={onPromote}>
        <FontAwesomeIcon icon={faUpRightFromSquare} />
      </button>
    </div>
  )
}
