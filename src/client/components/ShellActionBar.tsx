type ShellActionBarProps = {
  canMutate: boolean
  canPromoteDraft: boolean
  dirty?: boolean
  onNewNote: () => void
  onNewFolder: () => void
  onRename: () => void
  onMove: () => void
  onSearch: () => void
  onSave: () => void
  onPromote: () => void
}

export function ShellActionBar(props: ShellActionBarProps) {
  void props
  return null
}
