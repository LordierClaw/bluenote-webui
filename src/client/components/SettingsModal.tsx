import { ActionDialog } from "./ActionDialog"

type SettingsModalProps = {
  open: boolean
  onClose: () => void
  theme: "light" | "dark"
  onThemeChange: (theme: "light" | "dark") => void
}

export function SettingsModal({ open, onClose, theme, onThemeChange }: SettingsModalProps) {
  return (
    <ActionDialog open={open} title="Settings" onClose={onClose} className="settings-modal-dialog">
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <div className="settings-nav-label">
            <span className="label-caps">Configuration</span>
          </div>
          <div className="settings-nav-item active" aria-current="page">
            <span className="material-symbols-outlined icon-sm" aria-hidden="true">tune</span>
            <span>General</span>
          </div>
        </nav>

        <main className="settings-content">
          <div className="settings-section">
            <div className="settings-section-header">
              <h2>General</h2>
              <p>Manage your core application preferences.</p>
            </div>

            <div className="settings-field">
              <label className="label-caps" id="theme-label">Interface Theme</label>
              <div className="theme-picker-row" role="radiogroup" aria-labelledby="theme-label">
                {(["dark", "light"] as const).map((nextTheme) => {
                  const icons = { dark: "dark_mode", light: "light_mode" }
                  const labels = { dark: "Dark", light: "Light" }
                  return (
                    <label
                      key={nextTheme}
                      className={`theme-tile${theme === nextTheme ? " selected" : ""}`}
                      aria-label={`${labels[nextTheme]} theme`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={nextTheme}
                        checked={theme === nextTheme}
                        onChange={() => onThemeChange(nextTheme)}
                        className="sr-only"
                      />
                      <span className="material-symbols-outlined" aria-hidden="true">{icons[nextTheme]}</span>
                      <span>{labels[nextTheme]}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ActionDialog>
  )
}
