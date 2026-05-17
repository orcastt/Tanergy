'use client'

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'

type UseKonvaCanvasDocumentChangeBridgeOptions = {
  activePageId: string
  bridgeRef: MutableRefObject<Dispatch<SetStateAction<CanvasDocument>> | null>
  updatePageDocument: (pageId: string, updater: (document: CanvasDocument) => CanvasDocument) => boolean
}

export function useKonvaCanvasDocumentChangeBridge({
  activePageId,
  bridgeRef,
  updatePageDocument,
}: UseKonvaCanvasDocumentChangeBridgeOptions) {
  useEffect(() => {
    bridgeRef.current = (update) => {
      updatePageDocument(activePageId, (current) => (
        typeof update === 'function'
          ? (update as (document: CanvasDocument) => CanvasDocument)(current)
          : update
      ))
    }
    return () => {
      if (bridgeRef.current) bridgeRef.current = null
    }
  }, [activePageId, bridgeRef, updatePageDocument])
}
