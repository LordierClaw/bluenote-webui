import { useState } from "react"
import { ActionDialog } from "./ActionDialog"

type SettingsSection = "general" | "editor" | "ai"

type SettingsModalProps = {
  open: boolean
  onClose: () => void
  theme: "light" | "dark" | "system"
  onThemeChange: (theme: "light" | "dark" | "system") => void
}

const NAV_ITEMS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "tune" },
  { id: "editor", label: "Editor", icon: "edit_document" },
  { id: "ai", label: "AI Integration", icon: "smart_toy" },
]

export function SettingsModal({ open, onClose, theme, onThemeChange }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general")
  const [fontSize, setFontSize] = useState("14")
  const [lineHeight, setLineHeight] = useState("1.6")
  const [autosave, setAutosave] = useState(true)
  const [aiProvider, setAiProvider] = useState("openai")
  const [aiModel, setAiModel] = useState("gpt-4o")
  const [showApiKey, setShowApiKey] = useState(false)

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

          {/* AI section */}
          {activeSection === "ai" && (
            <div className="settings-section">
              <div className="settings-section-header">
                <h2>AI Integration</h2>
                <p>Connect external Language Models to enhance your writing experience.</p>
              </div>

              {/* Provider */}
              <div className="settings-field">
                <label className="label-caps" htmlFor="setting-ai-provider">Provider</label>
                <div style={{ position: "relative" }}>
                  <select
                    id="setting-ai-provider"
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    style={{ appearance: "none", paddingRight: "32px" }}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google Gemini</option>
                    <option value="local">Local (Ollama)</option>
                  </select>
                  <span
                    className="material-symbols-outlined"
                    style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--on-surface-variant)", fontSize: "18px" }}
                    aria-hidden="true"
                  >expand_more</span>
                </div>
              </div>

              {/* Model */}
              <div className="settings-field">
                <label className="label-caps" htmlFor="setting-ai-model">Model Architecture</label>
                <div style={{ position: "relative" }}>
                  <select
                    id="setting-ai-model"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    style={{ appearance: "none", paddingRight: "32px" }}
                  >
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                  </select>
                  <span
                    className="material-symbols-outlined"
                    style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--on-surface-variant)", fontSize: "18px" }}
                    aria-hidden="true"
                  >expand_more</span>
                </div>
              </div>

              {/* API Key */}
              <div className="settings-field">
                <label className="label-caps" htmlFor="setting-api-key">API Key</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="setting-api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="sk-..."
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    style={{
                      position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                      border: "none", background: "transparent", color: "var(--on-surface-variant)",
                      cursor: "pointer", padding: "0", display: "flex", alignItems: "center"
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }} aria-hidden="true">
                      {showApiKey ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                  Keys are stored locally and never transmitted to external servers.
                </p>
              </div>

              {/* Test Connection */}
              <button
                type="button"
                style={{ width: "100%", justifyContent: "center", marginTop: "4px" }}
              >
                <span className="material-symbols-outlined icon-sm" aria-hidden="true">sync</span>
                Test Connection
              </button>
            </div>
          )}
        </main>
      </div>
    </ActionDialog>
  )
}
