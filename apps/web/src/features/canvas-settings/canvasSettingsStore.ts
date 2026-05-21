import { create } from 'zustand'

export type CanvasSettings = {
  aiChatStyle: 'solid' | 'transparent'
  backgroundColor: string
  backgroundStyle: 'dots' | 'grid' | 'solid'
  edgeColorMode: 'follow-handle' | 'standard'
  gridRendering: boolean
  gridUnit: number
  language: 'en' | 'zh'
  snapAlignment: boolean
  snapDistance: number
  smartDrawing: boolean
  themeMode: 'dark' | 'light' | 'system'
  zoomSensitivity: number
}

type CanvasSettingsState = {
  replace: (settings: Partial<CanvasSettings>) => void
  save: () => void
  settings: CanvasSettings
  update: (settings: Partial<CanvasSettings>) => void
}

const storageKey = 'tangent.canvas.settings.v1'
const aiChatStyles = ['solid', 'transparent'] as const
const edgeColorModes = ['follow-handle', 'standard'] as const
const languages = ['en', 'zh'] as const
const themeModes = ['system', 'light', 'dark'] as const

export const defaultCanvasSettings: CanvasSettings = {
  aiChatStyle: 'transparent',
  backgroundColor: '#ffffff',
  backgroundStyle: 'dots',
  edgeColorMode: 'follow-handle',
  gridRendering: true,
  gridUnit: 12,
  language: 'en',
  snapAlignment: true,
  snapDistance: 12,
  smartDrawing: true,
  themeMode: 'system',
  zoomSensitivity: 1,
}

export const useCanvasSettingsStore = create<CanvasSettingsState>((set, get) => ({
  replace: (nextSettings) => set({ settings: normalizeCanvasSettings(nextSettings) }),
  save: () => saveSettings(get().settings),
  settings: loadSettings(),
  update: (nextSettings) => set((state) => ({
    settings: normalizeCanvasSettings({ ...state.settings, ...nextSettings }),
  })),
}))

export function normalizeCanvasSettings(settings: Partial<CanvasSettings> & { gridStyle?: unknown } = {}): CanvasSettings {
  const backgroundStyle = getBackgroundStyle(settings.backgroundStyle, settings.gridStyle)
  const normalized: CanvasSettings = {
    ...defaultCanvasSettings,
    ...settings,
    aiChatStyle: getChoice(settings.aiChatStyle, aiChatStyles, defaultCanvasSettings.aiChatStyle),
    backgroundColor: normalizeHexColor(settings.backgroundColor, defaultCanvasSettings.backgroundColor),
    backgroundStyle,
    edgeColorMode: getChoice(settings.edgeColorMode, edgeColorModes, defaultCanvasSettings.edgeColorMode),
    gridRendering: backgroundStyle !== 'solid',
    gridUnit: clampNumber(Number(settings.gridUnit ?? defaultCanvasSettings.gridUnit), 8, 128),
    language: getChoice(settings.language, languages, defaultCanvasSettings.language),
    snapAlignment: typeof settings.snapAlignment === 'boolean' ? settings.snapAlignment : defaultCanvasSettings.snapAlignment,
    snapDistance: clampNumber(Number(settings.snapDistance ?? defaultCanvasSettings.snapDistance), 2, 48),
    smartDrawing: typeof settings.smartDrawing === 'boolean' ? settings.smartDrawing : defaultCanvasSettings.smartDrawing,
    themeMode: getChoice(settings.themeMode, themeModes, defaultCanvasSettings.themeMode),
    zoomSensitivity: clampNumber(Number(settings.zoomSensitivity ?? defaultCanvasSettings.zoomSensitivity), 0.25, 3),
  }
  return normalized
}

export function getSerializableCanvasSettings(settings = useCanvasSettingsStore.getState().settings): CanvasSettings {
  return normalizeCanvasSettings(settings)
}

function loadSettings(): CanvasSettings {
  if (typeof window === 'undefined') return defaultCanvasSettings
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return defaultCanvasSettings
    return normalizeCanvasSettings(JSON.parse(raw))
  } catch {
    return defaultCanvasSettings
  }
}

function saveSettings(settings: CanvasSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(normalizeCanvasSettings(settings)))
}

function getBackgroundStyle(value: unknown, legacyGridStyle: unknown): CanvasSettings['backgroundStyle'] {
  if (value === 'dots' || value === 'grid' || value === 'solid') return value
  if (legacyGridStyle === 'solid') return 'grid'
  if (legacyGridStyle === 'grid') return 'dots'
  return defaultCanvasSettings.backgroundStyle
}

function normalizeHexColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function getChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T) {
  return choices.includes(value as T) ? value as T : fallback
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
