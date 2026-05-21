import { useCallback, useEffect, useRef } from 'react'
import type { CanvasShape } from '@/features/canvas-engine'
import { createCollaborationDraftPreview } from './konvaCollaborationDraftPreview'

const draftPresencePublishIntervalMs = 72

type UseKonvaCollaborationDraftPresenceOptions = {
  onDraftPreviewChange?: (shape: CanvasShape | null) => void
}

export function useKonvaCollaborationDraftPresence({
  onDraftPreviewChange,
}: UseKonvaCollaborationDraftPresenceOptions) {
  const draftPresenceTimerRef = useRef<number | null>(null)
  const lastDraftPresencePublishAtRef = useRef(0)
  const latestDraftPresenceRef = useRef<CanvasShape | null>(null)
  const onDraftPreviewChangeRef = useRef(onDraftPreviewChange)

  useEffect(() => {
    onDraftPreviewChangeRef.current = onDraftPreviewChange
  }, [onDraftPreviewChange])

  const clearDraftPresenceTimer = useCallback(() => {
    if (draftPresenceTimerRef.current === null) return
    window.clearTimeout(draftPresenceTimerRef.current)
    draftPresenceTimerRef.current = null
  }, [])

  const flushDraftPresence = useCallback(() => {
    clearDraftPresenceTimer()
    lastDraftPresencePublishAtRef.current = Date.now()
    onDraftPreviewChangeRef.current?.(latestDraftPresenceRef.current)
  }, [clearDraftPresenceTimer])

  const scheduleDraftPresence = useCallback((shape: CanvasShape | null, options: { immediate?: boolean } = {}) => {
    latestDraftPresenceRef.current = shape ? createCollaborationDraftPreview(shape) : null
    if (!onDraftPreviewChangeRef.current) return
    if (options.immediate) {
      flushDraftPresence()
      return
    }
    const elapsedMs = Date.now() - lastDraftPresencePublishAtRef.current
    const waitMs = Math.max(0, draftPresencePublishIntervalMs - elapsedMs)
    if (waitMs === 0) {
      flushDraftPresence()
      return
    }
    if (draftPresenceTimerRef.current !== null) return
    draftPresenceTimerRef.current = window.setTimeout(() => {
      flushDraftPresence()
    }, waitMs)
  }, [flushDraftPresence])

  useEffect(() => () => {
    clearDraftPresenceTimer()
    onDraftPreviewChangeRef.current?.(null)
  }, [clearDraftPresenceTimer])

  return { scheduleDraftPresence }
}
