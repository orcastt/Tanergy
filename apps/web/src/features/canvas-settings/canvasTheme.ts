import { useEffect, useState } from 'react'
import { useCanvasSettingsStore, type CanvasSettings } from './canvasSettingsStore'

export type ResolvedCanvasTheme = 'dark' | 'light'

export type CanvasThemePalette = {
  actionBg: string
  actionText: string
  canvasBackground: string
  compactStatus: string
  dropdownBg: string
  fieldBg: string
  fieldStroke: string
  fieldText: string
  gridDot: string
  gridLine: string
  imageEmptyBg: string
  imageSlotBg: string
  mutedText: string
  nodeBg: string
  nodeShadow: string
  nodeStroke: string
  nodeTitle: string
  panelBg: string
  panelBorder: string
  scrollbar: string
  scrollbarTrack: string
  secondaryBg: string
  selectedBg: string
  selectedText: string
  softText: string
}

const palettes: Record<ResolvedCanvasTheme, CanvasThemePalette> = {
  light: {
    actionBg: '#111827',
    actionText: '#ffffff',
    canvasBackground: '#ffffff',
    compactStatus: '#64748b',
    dropdownBg: '#ffffff',
    fieldBg: '#f8fafc',
    fieldStroke: '#dce3ec',
    fieldText: '#1f2937',
    gridDot: 'rgba(88, 98, 112, 0.16)',
    gridLine: 'rgba(88, 98, 112, 0.08)',
    imageEmptyBg: '#eef4fb',
    imageSlotBg: '#e8eef5',
    mutedText: '#475569',
    nodeBg: '#ffffff',
    nodeShadow: 'rgba(15, 23, 42, 0.14)',
    nodeStroke: 'rgba(15, 23, 42, 0.12)',
    nodeTitle: '#0f172a',
    panelBg: 'rgba(255, 255, 255, 0.94)',
    panelBorder: 'rgba(31, 42, 55, 0.1)',
    scrollbar: '#94a3b8',
    scrollbarTrack: 'rgba(148, 163, 184, 0.22)',
    secondaryBg: '#ffffff',
    selectedBg: '#eef2ff',
    selectedText: '#4338ca',
    softText: '#64748b',
  },
  dark: {
    actionBg: '#e5e7eb',
    actionText: '#101827',
    canvasBackground: '#121722',
    compactStatus: '#9aa8bb',
    dropdownBg: '#202938',
    fieldBg: '#172031',
    fieldStroke: 'rgba(148, 163, 184, 0.28)',
    fieldText: '#e5e7eb',
    gridDot: 'rgba(148, 163, 184, 0.22)',
    gridLine: 'rgba(148, 163, 184, 0.12)',
    imageEmptyBg: '#1a2636',
    imageSlotBg: '#1c2635',
    mutedText: '#bac5d6',
    nodeBg: '#111827',
    nodeShadow: 'rgba(0, 0, 0, 0.28)',
    nodeStroke: 'rgba(148, 163, 184, 0.22)',
    nodeTitle: '#f8fafc',
    panelBg: 'rgba(17, 24, 39, 0.94)',
    panelBorder: 'rgba(148, 163, 184, 0.2)',
    scrollbar: '#718096',
    scrollbarTrack: 'rgba(148, 163, 184, 0.16)',
    secondaryBg: '#172031',
    selectedBg: 'rgba(99, 102, 241, 0.22)',
    selectedText: '#c4b5fd',
    softText: '#9aa8bb',
  },
}

export function getCanvasThemePalette(theme: ResolvedCanvasTheme) {
  return palettes[theme]
}

export function useResolvedCanvasThemeMode(): ResolvedCanvasTheme {
  const themeMode = useCanvasSettingsStore((state) => state.settings.themeMode)
  const [systemTheme, setSystemTheme] = useState<ResolvedCanvasTheme>(() => getSystemTheme())

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemTheme(query.matches ? 'dark' : 'light')
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return resolveCanvasThemeMode(themeMode, systemTheme)
}

function resolveCanvasThemeMode(mode: CanvasSettings['themeMode'], systemTheme: ResolvedCanvasTheme): ResolvedCanvasTheme {
  if (mode === 'dark' || mode === 'light') return mode
  return systemTheme
}

function getSystemTheme(): ResolvedCanvasTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
