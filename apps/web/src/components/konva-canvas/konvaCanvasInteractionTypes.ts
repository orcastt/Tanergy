import type { Dispatch, SetStateAction } from 'react'
import type { CanvasBounds, CanvasCamera, CanvasDocument, CanvasShape, CanvasShapeStyle } from '@/features/canvas-engine'
import type {
  BoardCollaborationConnectionPreview,
  BoardCollaborationTransformKind,
} from '@/features/boards/boardCollaborationTypes'
import type { KonvaCanvasTool } from './konvaCanvasTypes'

export type UseKonvaCanvasInteractionsOptions = {
  activeTool: KonvaCanvasTool
  camera: CanvasCamera
  document: CanvasDocument
  isSpacePanning: boolean
  nextStyle: CanvasShapeStyle
  onInteractionShapeIdsChange?: (shapeIds: string[]) => void
  remoteLockedShapeOwnerById?: ReadonlyMap<string, string>
  selectedIds: string[]
  onCameraCommit: (camera: CanvasCamera) => void
  onCameraPreview: (camera: CanvasCamera) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreview: Dispatch<SetStateAction<CanvasDocument>>
  onDocumentPreviewStateChange?: (active: boolean) => void
  onDraftPreviewChange?: (shape: CanvasShape | null) => void
  onHistoryCheckpoint: (document: CanvasDocument) => void
  onLocalDocumentCommit?: () => void
  onConnectionPreviewChange?: (preview: BoardCollaborationConnectionPreview | null) => void
  onSelectionBoxChange?: (bounds: CanvasBounds | null) => void
  onTransformPreviewChange?: (preview: { bounds: CanvasBounds; kind: BoardCollaborationTransformKind } | null) => void
  onSelectionChange: (shapeIds: string[]) => void
  onToolChange: (tool: KonvaCanvasTool) => void
  onTextEditStart?: (shapeId: string) => void
}
