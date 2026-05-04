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
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onEdgeSelectionChange: (edgeId: string | null) => void
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaCanvasControls({
  camera,
  history,
  onCameraChange,
  onDocumentChange,
  onEdgeSelectionChange,
  onSelectionChange,
  size,
}: UseKonvaCanvasControlsOptions) {
  const handleCameraPreview = useCallback((nextCamera: CanvasCamera) => {
    onCameraChange(nextCamera)
  }, [onCameraChange])

  const handleCameraCommit = useCallback((nextCamera: CanvasCamera) => {
    onCameraChange(nextCamera)
    onDocumentChange((current) => ({ ...current, camera: nextCamera }))
  }, [onCameraChange, onDocumentChange])

  const zoomAtCenter = useCallback((factor: number) => {
    handleCameraCommit(zoomCameraAtScreenPoint(camera, { x: size.width / 2, y: size.height / 2 }, camera.zoom * factor, konvaMinZoom, konvaMaxZoom))
  }, [camera, handleCameraCommit, size.height, size.width])

  const resetZoom = useCallback(() => {
    handleCameraCommit(zoomCameraAtScreenPoint(camera, { x: size.width / 2, y: size.height / 2 }, 1, konvaMinZoom, konvaMaxZoom))
  }, [camera, handleCameraCommit, size.height, size.width])

  const addStressStrokes = useCallback(() => {
    history.checkpoint()
    onDocumentChange((current) => withCanvasShapes(current, [...current.shapes, ...createStressStrokes(current.shapes.length)]))
  }, [history, onDocumentChange])

  const clearCanvas = useCallback(() => {
    history.checkpoint()
    onDocumentChange((current) => withCanvasShapes(current, []))
    onSelectionChange([])
    onEdgeSelectionChange(null)
  }, [history, onDocumentChange, onEdgeSelectionChange, onSelectionChange])

  return {
    addStressStrokes,
    clearCanvas,
    handleCameraCommit,
    handleCameraPreview,
    resetZoom,
    zoomAtCenter,
  }
}
