import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'

type UseKonvaDocumentPreviewSchedulerOptions = {
  documentRef: { current: CanvasDocument }
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
}

export function useKonvaDocumentPreviewScheduler({
  documentRef,
  onDocumentPreview,
}: UseKonvaDocumentPreviewSchedulerOptions) {
  const frameRef = useRef<number | null>(null)
  const pendingDocumentRef = useRef<CanvasDocument | null>(null)

  const flushPreviewDocument = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const pendingDocument = pendingDocumentRef.current
    pendingDocumentRef.current = null
    if (pendingDocument) onDocumentPreview(pendingDocument)
  }, [onDocumentPreview])

  const previewDocument = useCallback((document: CanvasDocument) => {
    documentRef.current = document
    pendingDocumentRef.current = document
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const pendingDocument = pendingDocumentRef.current
      pendingDocumentRef.current = null
      if (pendingDocument) onDocumentPreview(pendingDocument)
    })
  }, [documentRef, onDocumentPreview])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  return { flushPreviewDocument, previewDocument }
}
