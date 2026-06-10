import { useCallback, useEffect, useState } from "react"

export type ThemePreference = "light" | "dark"

const THEME_STORAGE_KEY = "bluenote-webui-theme"

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark"
}

function getInitialTheme(): ThemePreference {
  if (typeof window === "undefined") return "light"

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemePreference(stored)) return stored
  } catch {
    // Ignore storage errors and fall through to system preference.
  }

  try {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark"
  } catch {
    // Ignore media query errors and use the stable fallback.
  }

  return "light"
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>(() => getInitialTheme())

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme
    }

    if (typeof window === "undefined") return

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Theme still applies even if localStorage is unavailable.
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => current === "light" ? "dark" : "light")
  }, [])

  return { theme, toggleTheme }
}
