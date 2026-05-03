import { useCallback, useEffect, useRef, useState } from 'react'
import type { CanvasShape } from '@/features/canvas-engine'

export function useKonvaDraftPreview() {
  const rafRef = useRef<number | null>(null)
  const pendingDraftRef = useRef<CanvasShape | null>(null)
  const [draft, setDraft] = useState<CanvasShape | null>(null)

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const clearDraft = useCallback(() => {
    pendingDraftRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setDraft(null)
  }, [])

  const scheduleDraft = useCallback((shape: CanvasShape) => {
    pendingDraftRef.current = shape
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setDraft(pendingDraftRef.current)
    })
  }, [])

  return { clearDraft, draft, scheduleDraft }
}
