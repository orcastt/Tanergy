import { useCallback, type Dispatch, type SetStateAction } from 'react'
import {
  withCanvasShapes,
  zoomCameraAtScreenPoint,
  type CanvasCamera,
  type CanvasDocument,
} from '@/features/canvas-engine'
import { createStressStrokes } from './konvaSeedShapes'
import { konvaMaxZoom, konvaMinZoom } from './konvaZoomLimits'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaCanvasControlsOptions = {
  camera: CanvasCamera
  history: KonvaCanvasHistory
  size: { height: number; width: number }
  onCameraChange: Dispatch<SetStateAction<CanvasCamera>>
  onCameraDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onContentDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onEdgeSelectionChange: (edgeId: string | null) => void
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaCanvasControls({
  camera,
  history,
  onCameraChange,
  onCameraDocumentChange,
  onContentDocumentChange,
  onEdgeSelectionChange,
  onSelectionChange,
  size,
}: UseKonvaCanvasControlsOptions) {
  const handleCameraPreview = useCallback((nextCamera: CanvasCamera) => {
    onCameraChange(nextCamera)
  }, [onCameraChange])

  const handleCameraCommit = useCallback((nextCamera: CanvasCamera) => {
    onCameraChange(nextCamera)
    onCameraDocumentChange((current) => ({ ...current, camera: nextCamera }))
  }, [onCameraChange, onCameraDocumentChange])

  const zoomAtCenter = useCallback((factor: number) => {
    handleCameraCommit(zoomCameraAtScreenPoint(camera, { x: size.width / 2, y: size.height / 2 }, camera.zoom * factor, konvaMinZoom, konvaMaxZoom))
  }, [camera, handleCameraCommit, size.height, size.width])

  const resetZoom = useCallback(() => {
    handleCameraCommit(zoomCameraAtScreenPoint(camera, { x: size.width / 2, y: size.height / 2 }, 1, konvaMinZoom, konvaMaxZoom))
  }, [camera, handleCameraCommit, size.height, size.width])

  const addStressStrokes = useCallback(() => {
    history.checkpoint()
    onContentDocumentChange((current) => withCanvasShapes(current, [...current.shapes, ...createStressStrokes(current.shapes.length)]))
  }, [history, onContentDocumentChange])

  const clearCanvas = useCallback(() => {
    history.checkpoint()
    onContentDocumentChange((current) => withCanvasShapes(current, []))
    onSelectionChange([])
    onEdgeSelectionChange(null)
  }, [history, onContentDocumentChange, onEdgeSelectionChange, onSelectionChange])

  return {
    addStressStrokes,
    clearCanvas,
    handleCameraCommit,
    handleCameraPreview,
    resetZoom,
    zoomAtCenter,
  }
}
