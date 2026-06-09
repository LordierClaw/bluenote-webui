export function Sidebar({ folder, onFolderChange, onNewNote, onQuickDraft, onRebuild }: { folder: string; onFolderChange: (folder: string) => void; onNewNote: () => void; onQuickDraft: () => void; onRebuild: () => void }) {
  const folders = [
    { id: "all", label: "All notes" },
    { id: "note", label: "Notes" },
    { id: "draft", label: "Drafts" },
  ]
  return (
    <aside className="sidebar">
      <div className="section-title">Workspace</div>
      {folders.map((item) => <button key={item.id} className={folder === item.id ? "active" : ""} onClick={() => onFolderChange(item.id)}>{item.label}</button>)}
      <div className="section-title">Actions</div>
      <button onClick={onNewNote}>New note</button>
      <button onClick={onQuickDraft}>Quick draft</button>
      <button onClick={onRebuild}>Rebuild index</button>
    </aside>
  )
}
