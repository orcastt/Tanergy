import { create } from "zustand"

type Theme = "light" | "dark"

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem("tangent_theme", theme)
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("tangent_theme") as Theme | null
  if (saved === "light" || saved === "dark") return saved
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark"
  return "light"
}

const initial = getInitialTheme()
applyTheme(initial)

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light"
      applyTheme(next)
      return { theme: next }
    }),
}))
