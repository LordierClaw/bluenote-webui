import type { ReactNode } from "react"

export type UtilityTab = "preview" | "ai" | "info"

type UtilityPaneProps = {
  activeTab: UtilityTab
  onTabChange: (tab: UtilityTab) => void
  preview: ReactNode
  ai: ReactNode
  info: ReactNode
}

const TABS: { id: UtilityTab; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "ai", label: "AI" },
  { id: "info", label: "Info" },
]

export function UtilityPane({ activeTab, onTabChange, preview, ai, info }: UtilityPaneProps) {
  return (
    <aside className="utility-pane" aria-label="Workspace utility pane">
      <div className="utility-pane__tabs" role="tablist" aria-label="Utility views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`utility-pane__tab ${activeTab === tab.id ? "selected" : ""}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`utility-panel-${tab.id}`}
            id={`utility-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="utility-pane__body"
        role="tabpanel"
        id={`utility-panel-${activeTab}`}
        aria-labelledby={`utility-tab-${activeTab}`}
      >
        {activeTab === "preview" ? preview : null}
        {activeTab === "ai" ? ai : null}
        {activeTab === "info" ? info : null}
      </div>
    </aside>
  )
}
