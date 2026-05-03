import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { withCanvasShapes, type CanvasCamera, type CanvasDocument, type CanvasPoint } from '@/features/canvas-engine'
import { getShapesAfterPreciseErase } from './konvaEraserHitTest'

type UseKonvaEraserSessionOptions = {
  cameraRef: { current: CanvasCamera }
  documentRef: { current: CanvasDocument }
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
}

export function useKonvaEraserSession({ cameraRef, documentRef, onDocumentPreview }: UseKonvaEraserSessionOptions) {
  const [eraserTrail, setEraserTrail] = useState<CanvasPoint[]>([])

  const clearEraserTrail = useCallback((delayMs = 0) => {
    if (delayMs > 0) window.setTimeout(() => setEraserTrail([]), delayMs)
    else setEraserTrail([])
  }, [])

  const updateEraserTrail = useCallback((point: CanvasPoint) => {
    setEraserTrail((trail) => [...trail.slice(-7), point])
  }, [])

  const eraseAtPoint = useCallback((point: CanvasPoint) => {
    const radius = 10 / cameraRef.current.zoom
    const current = documentRef.current
    const nextShapes = getShapesAfterPreciseErase(current.shapes, point, radius)
    if (nextShapes.length === current.shapes.length) return
    const nextDocument = withCanvasShapes(current, nextShapes)
    documentRef.current = nextDocument
    onDocumentPreview(nextDocument)
  }, [cameraRef, documentRef, onDocumentPreview])

  return {
    clearEraserTrail,
    eraseAtPoint,
    eraserTrail,
    updateEraserTrail,
  }
}
