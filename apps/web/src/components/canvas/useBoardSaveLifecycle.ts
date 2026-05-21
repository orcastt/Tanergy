'use client'

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import {
  boardAutosaveDelayMs,
  shouldWarnBeforeUnload,
  type BoardAction,
  type BoardSaveStatus,
} from './boardSaveStatus'

export function useBoardAutosaveTimer(
  mode: 'board' | 'dev',
  saveNowRef: MutableRefObject<((source: 'autosave') => void) | null>
) {
  const autosaveTimer = useRef<number | null>(null)

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimer.current === null) return
    window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = null
  }, [])

  const scheduleAutosave = useCallback(() => {
    if (mode !== 'board') return
    clearAutosaveTimer()
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null
      saveNowRef.current?.('autosave')
    }, boardAutosaveDelayMs)
  }, [clearAutosaveTimer, mode, saveNowRef])

  useEffect(() => clearAutosaveTimer, [clearAutosaveTimer])

  return { clearAutosaveTimer, scheduleAutosave }
}

export function useBoardSettingsDirtyTracking(mode: 'board' | 'dev', markDirty: () => void) {
  useEffect(() => {
    if (mode !== 'board') return
    return useCanvasSettingsStore.subscribe((state, previousState) => {
      if (state.settings !== previousState.settings) markDirty()
    })
  }, [markDirty, mode])
}

export function useBoardKeyboardSaveShortcut(
  mode: 'board' | 'dev',
  saveLocal: (source: 'keyboard') => void
) {
  useEffect(() => {
    if (mode !== 'board') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveLocal('keyboard')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, saveLocal])
}

export function useBoardBeforeUnloadWarning(
  mode: 'board' | 'dev',
  status: BoardSaveStatus,
  saving: MutableRefObject<boolean>,
  lastAction: BoardAction | null
) {
  const guardActive = useRef(false)
  const statusRef = useRef<BoardSaveStatus>(status)
  const lastActionRef = useRef<BoardAction | null>(lastAction)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    lastActionRef.current = lastAction
  }, [lastAction])

  useEffect(() => {
    if (mode !== 'board') return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnBeforeUnload(statusRef.current, saving.current, lastActionRef.current)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [mode, saving])

  useEffect(() => {
    if (mode !== 'board' || typeof window === 'undefined') return
    if (!shouldWarnBeforeUnload(status, saving.current, lastAction) || guardActive.current) return
    window.history.pushState({ tangentUnsavedGuard: true }, '', window.location.href)
    guardActive.current = true
  }, [lastAction, mode, saving, status])

  useEffect(() => {
    if (mode !== 'board' || typeof window === 'undefined') return
    const handlePopState = () => {
      if (!guardActive.current) return
      if (!shouldWarnBeforeUnload(statusRef.current, saving.current, lastActionRef.current)) {
        guardActive.current = false
        window.history.back()
        return
      }
      const confirmed = window.confirm('You have unsaved changes. Leave this board?')
      if (confirmed) {
        guardActive.current = false
        window.history.back()
        return
      }
      window.history.pushState({ tangentUnsavedGuard: true }, '', window.location.href)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [mode, saving])
}
