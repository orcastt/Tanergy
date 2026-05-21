import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'

type UseKonvaDocumentPreviewSchedulerOptions = {
  onDocumentCommit: Dispatch<SetStateAction<CanvasDocument>>
  documentRef: { current: CanvasDocument }
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onPreviewStateChange?: (active: boolean) => void
}

export function useKonvaDocumentPreviewScheduler({
  documentRef,
  onDocumentCommit,
  onDocumentPreview,
  onPreviewStateChange,
}: UseKonvaDocumentPreviewSchedulerOptions) {
  const frameRef = useRef<number | null>(null)
  const isPreviewingRef = useRef(false)
  const pendingDocumentRef = useRef<CanvasDocument | null>(null)
  const latestPreviewDocumentRef = useRef<CanvasDocument | null>(null)

  const setPreviewing = useCallback((active: boolean) => {
    if (isPreviewingRef.current === active) return
    isPreviewingRef.current = active
    onPreviewStateChange?.(active)
  }, [onPreviewStateChange])

  const flushPreviewDocument = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const pendingDocument = latestPreviewDocumentRef.current
    pendingDocumentRef.current = null
    latestPreviewDocumentRef.current = null
    setPreviewing(false)
    if (pendingDocument) onDocumentCommit(pendingDocument)
  }, [onDocumentCommit, setPreviewing])

  const previewDocument = useCallback((document: CanvasDocument) => {
    documentRef.current = document
    latestPreviewDocumentRef.current = document
    pendingDocumentRef.current = document
    setPreviewing(true)
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const pendingDocument = pendingDocumentRef.current
      pendingDocumentRef.current = null
      if (pendingDocument) onDocumentPreview(pendingDocument)
    })
  }, [documentRef, onDocumentPreview, setPreviewing])

  const previewDocumentNow = useCallback((document: CanvasDocument) => {
    documentRef.current = document
    latestPreviewDocumentRef.current = document
    pendingDocumentRef.current = null
    setPreviewing(true)
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    onDocumentPreview(document)
  }, [documentRef, onDocumentPreview, setPreviewing])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    pendingDocumentRef.current = null
    latestPreviewDocumentRef.current = null
    setPreviewing(false)
  }, [setPreviewing])

  return { flushPreviewDocument, previewDocument, previewDocumentNow }
}
