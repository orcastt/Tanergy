'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KonvaPendingImagePaste } from './KonvaPendingImagePasteLayer'

type UseKonvaPendingImagePastesOptions = {
  activePageId: string
}

export function useKonvaPendingImagePastes({ activePageId }: UseKonvaPendingImagePastesOptions) {
  const [pendingImagePastes, setPendingImagePastes] = useState<KonvaPendingImagePaste[]>([])
  const pendingImagePasteTimeoutsRef = useRef(new Map<string, number>())

  const clearPendingImagePasteTimeout = useCallback((pendingId: string) => {
    const timeoutId = pendingImagePasteTimeoutsRef.current.get(pendingId)
    if (timeoutId === undefined) return
    window.clearTimeout(timeoutId)
    pendingImagePasteTimeoutsRef.current.delete(pendingId)
  }, [])

  const handlePendingImagePasteStateChange = useCallback((state: KonvaPendingImagePaste) => {
    clearPendingImagePasteTimeout(state.id)
    setPendingImagePastes((current) => {
      const next = current.filter((item) => item.id !== state.id)
      next.push(state)
      return next
    })
    if (state.status !== 'failed') return
    const timeoutId = window.setTimeout(() => {
      pendingImagePasteTimeoutsRef.current.delete(state.id)
      setPendingImagePastes((current) => current.filter((item) => item.id !== state.id))
    }, 1800)
    pendingImagePasteTimeoutsRef.current.set(state.id, timeoutId)
  }, [clearPendingImagePasteTimeout])

  const handlePendingImagePasteComplete = useCallback((pendingId: string) => {
    clearPendingImagePasteTimeout(pendingId)
    setPendingImagePastes((current) => current.filter((item) => item.id !== pendingId))
  }, [clearPendingImagePasteTimeout])

  const visiblePendingImagePastes = useMemo(() => (
    pendingImagePastes.filter((item) => item.pageId === activePageId)
  ), [activePageId, pendingImagePastes])

  useEffect(() => () => {
    for (const timeoutId of pendingImagePasteTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId)
    }
    pendingImagePasteTimeoutsRef.current.clear()
  }, [])

  return {
    handlePendingImagePasteComplete,
    handlePendingImagePasteStateChange,
    visiblePendingImagePastes,
  }
}
