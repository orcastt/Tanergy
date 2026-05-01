'use client'

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import {
  boardAutosaveDelayMs,
  shouldWarnBeforeUnload,
  type BoardAction,
  type BoardSaveStatus,
} from './boardSaveStatus'

export function useBoardAutosaveTimer(
  mode: 'board' | 'dev',
  saveNowRef: MutableRefObject<(() => void) | null>
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
      saveNowRef.current?.()
    }, boardAutosaveDelayMs)
  }, [clearAutosaveTimer, mode, saveNowRef])

  useEffect(() => clearAutosaveTimer, [clearAutosaveTimer])

  return { clearAutosaveTimer, scheduleAutosave }
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
