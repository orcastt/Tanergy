import { create } from 'zustand'

export type CanvasSettings = {
  aiChatStyle: 'solid' | 'transparent'
  edgeColorMode: 'follow-handle' | 'standard'
  gridColor: string
  gridRendering: boolean
  gridStyle: 'grid' | 'solid'
  gridUnit: number
  language: 'en' | 'zh'
  snapAlignment: boolean
  snapDistance: number
  zoomSensitivity: number
}

type CanvasSettingsState = {
  save: () => void
  settings: CanvasSettings
  update: (settings: Partial<CanvasSettings>) => void
}

const storageKey = 'tangent.canvas.settings.v1'

export const defaultCanvasSettings: CanvasSettings = {
  aiChatStyle: 'transparent',
  edgeColorMode: 'follow-handle',
  gridColor: '#d8e0ec',
  gridRendering: true,
  gridStyle: 'solid',
  gridUnit: 32,
  language: 'en',
  snapAlignment: true,
  snapDistance: 12,
  zoomSensitivity: 1,
}

export const useCanvasSettingsStore = create<CanvasSettingsState>((set, get) => ({
  save: () => saveSettings(get().settings),
  settings: loadSettings(),
  update: (nextSettings) => set((state) => ({
    settings: clampSettings({ ...state.settings, ...nextSettings }),
  })),
}))

function loadSettings(): CanvasSettings {
  if (typeof window === 'undefined') return defaultCanvasSettings
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return defaultCanvasSettings
    return clampSettings({ ...defaultCanvasSettings, ...JSON.parse(raw) })
  } catch {
    return defaultCanvasSettings
  }
}

function saveSettings(settings: CanvasSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(clampSettings(settings)))
}

function clampSettings(settings: CanvasSettings): CanvasSettings {
  return {
    ...settings,
    gridUnit: clampNumber(settings.gridUnit, 8, 128),
    snapDistance: clampNumber(settings.snapDistance, 2, 48),
    zoomSensitivity: clampNumber(settings.zoomSensitivity, 0.25, 3),
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
