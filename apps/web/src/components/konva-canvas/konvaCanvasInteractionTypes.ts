import type { Dispatch, SetStateAction } from 'react'
import type { CanvasCamera, CanvasDocument, CanvasShapeStyle } from '@/features/canvas-engine'
import type { KonvaCanvasTool } from './konvaCanvasTypes'

export type UseKonvaCanvasInteractionsOptions = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  document: CanvasDocument
  isSpacePanning: boolean
  nextStyle: CanvasShapeStyle
  selectedIds: string[]
  onCameraCommit: (camera: CanvasCamera) => void
  onCameraPreview: (camera: CanvasCamera) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onSelectionChange: (shapeIds: string[]) => void
  onToolChange: (tool: KonvaCanvasTool) => void
}
