import { useState } from "react"
import { ActionDialog } from "./ActionDialog"

type SettingsSection = "general" | "editor"

type SettingsModalProps = {
  open: boolean
  onClose: () => void
  theme: "light" | "dark" | "system"
  onThemeChange: (theme: "light" | "dark" | "system") => void
}

const NAV_ITEMS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "tune" },
  { id: "editor", label: "Editor", icon: "edit_document" },
]

export function SettingsModal({ open, onClose, theme, onThemeChange }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general")
  const [fontSize, setFontSize] = useState("14")
  const [lineHeight, setLineHeight] = useState("1.6")
  const [autosave, setAutosave] = useState(true)

  return (
    <ActionDialog open={open} title="Settings" onClose={onClose} className="settings-modal-dialog">
      {/* Modal body uses the full settings layout inside action-box-body */}
      <div className="settings-layout">
        {/* ── Left nav sidebar ── */}
        <nav className="settings-nav" aria-label="Settings sections">
          <div className="settings-nav-label">
            <span className="label-caps">Configuration</span>
          </div>
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-nav-item${activeSection === id ? " active" : ""}`}
              onClick={() => setActiveSection(id)}
              aria-current={activeSection === id ? "page" : undefined}
            >
              <span className="material-symbols-outlined icon-sm" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* ── Content area ── */}
        <main className="settings-content">
          {/* General section */}
          {activeSection === "general" && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h2>General</h2>
                <p>Manage your core application preferences and localization.</p>
              </div>

              {/* Theme picker */}
              <div className="settings-field">
                <label className="label-caps" id="theme-label">Interface Theme</label>
                <div className="theme-picker-row" role="radiogroup" aria-labelledby="theme-label">
                  {(["dark", "light", "system"] as const).map((t) => {
                    const icons = { dark: "dark_mode", light: "light_mode", system: "desktop_windows" }
                    const labels = { dark: "Dark", light: "Light", system: "System" }
                    return (
                      <label
                        key={t}
                        className={`theme-tile${theme === t ? " selected" : ""}`}
                        aria-label={`${labels[t]} theme`}
                      >
                        <input
                          type="radio"
                          name="theme"
                          value={t}
                          checked={theme === t}
                          onChange={() => onThemeChange(t)}
                          className="sr-only"
                        />
                        <span className="material-symbols-outlined" aria-hidden="true">{icons[t]}</span>
                        <span>{labels[t]}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Editor section */}
          {activeSection === "editor" && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h2>Editor Environment</h2>
                <p>Configure the text editing canvas for optimal readability.</p>
              </div>

              <div className="settings-grid-2">
                {/* Font size */}
                <div className="settings-field">
                  <label className="label-caps" htmlFor="setting-font-size">Font Size (px)</label>
                  <input
                    id="setting-font-size"
                    type="number"
                    min="10"
                    max="32"
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                  />
                </div>

                {/* Line height */}
                <div className="settings-field">
                  <label className="label-caps" htmlFor="setting-line-height">Line Height</label>
                  <div style={{ position: "relative" }}>
                    <select
                      id="setting-line-height"
                      value={lineHeight}
                      onChange={(e) => setLineHeight(e.target.value)}
                      style={{ appearance: "none", paddingRight: "32px" }}
                    >
                      <option value="1.2">1.2 (Tight)</option>
                      <option value="1.5">1.5 (Normal)</option>
                      <option value="1.6">1.6 (Relaxed)</option>
                      <option value="2.0">2.0 (Double)</option>
                    </select>
                    <span
                      className="material-symbols-outlined"
                      style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--on-surface-variant)", fontSize: "18px" }}
                      aria-hidden="true"
                    >expand_more</span>
                  </div>
                </div>
              </div>

              {/* Auto-save toggle */}
              <div className="settings-field">
                <div className="settings-toggle-row">
                  <div>
                    <div style={{ fontSize: "14px", color: "var(--on-surface)", fontFamily: "var(--font-display)" }}>Auto-save Document</div>
                    <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px" }}>Automatically save changes every 30 seconds.</div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-btn${autosave ? " on" : ""}`}
                    role="switch"
                    aria-checked={autosave}
                    aria-label="Auto-save"
                    onClick={() => setAutosave((v) => !v)}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ActionDialog>
  )
}
