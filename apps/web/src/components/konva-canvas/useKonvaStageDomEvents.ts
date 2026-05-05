import { useCallback, type DragEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import { screenToWorld, type CanvasCamera, type CanvasDocument, type CanvasPoint } from '@/features/canvas-engine'
import { getKonvaContextTargetSelection } from './konvaContextSelection'

type ContextMenuState = { worldX: number; worldY: number; x: number; y: number }

type UseKonvaStageDomEventsOptions = {
  camera: CanvasCamera
  document: CanvasDocument
  lastPastePointRef: RefObject<CanvasPoint | null>
  nodeMenuOpen: boolean
  selectedIds: string[]
  onContextMenuChange: (contextMenu: ContextMenuState) => void
  onCanvasDoubleClick: (screenPoint: CanvasPoint, worldPoint: CanvasPoint) => void
  onNodeMenuClose: () => void
  onSelectionChange: (shapeIds: string[]) => void
  onShellRectChange: (rect: DOMRect) => void
  onToolChange: (tool: 'select') => void
  onUploadDropFileAtPoint: (file: File, point: CanvasPoint) => void
}

export function useKonvaStageDomEvents({
  camera,
  document,
  lastPastePointRef,
  nodeMenuOpen,
  onCanvasDoubleClick,
  onContextMenuChange,
  onNodeMenuClose,
  onSelectionChange,
  onShellRectChange,
  onToolChange,
  onUploadDropFileAtPoint,
  selectedIds,
}: UseKonvaStageDomEventsOptions) {
  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (Array.from(event.dataTransfer.items).some(isReferenceFileItem)) event.preventDefault()
  }, [])

  const handleDrop = useCallback((event: DragEvent<HTMLElement>) => {
    const file = Array.from(event.dataTransfer.files).find(isReferenceFile)
    if (!file) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const world = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, camera)
    onUploadDropFileAtPoint(file, world)
  }, [camera, onUploadDropFileAtPoint])

  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    onToolChange('select')
    const rect = event.currentTarget.getBoundingClientRect()
    onShellRectChange(rect)
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const world = screenToWorld(point, camera)
    const targetSelection = getKonvaContextTargetSelection(document.shapes, world, selectedIds)
    if (targetSelection.length > 0) onSelectionChange(targetSelection)
    lastPastePointRef.current = world
    onContextMenuChange({ worldX: world.x, worldY: world.y, x: point.x, y: point.y })
  }, [camera, document.shapes, lastPastePointRef, onContextMenuChange, onSelectionChange, onShellRectChange, onToolChange, selectedIds])

  const handleDoubleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!isKonvaCanvasTarget(event.target)) return
    const rect = event.currentTarget.getBoundingClientRect()
    onShellRectChange(rect)
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const world = screenToWorld(point, camera)
    if (getKonvaContextTargetSelection(document.shapes, world, []).length > 0) return
    event.preventDefault()
    onToolChange('select')
    lastPastePointRef.current = world
    onCanvasDoubleClick(point, world)
  }, [camera, document.shapes, lastPastePointRef, onCanvasDoubleClick, onShellRectChange, onToolChange])

  const handlePointerMoveCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    lastPastePointRef.current = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, camera)
  }, [camera, lastPastePointRef])

  const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    if (nodeMenuOpen && !(event.target as Element).closest('.konva-node-create-menu')) onNodeMenuClose()
  }, [nodeMenuOpen, onNodeMenuClose])

  return {
    handleContextMenu,
    handleDoubleClick,
    handleDragOver,
    handleDrop,
    handlePointerDownCapture,
    handlePointerMoveCapture,
  }
}

function isKonvaCanvasTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return target instanceof HTMLCanvasElement || Boolean(target.closest('.konvajs-content'))
}

function isReferenceFileItem(item: DataTransferItem) {
  return item.type.startsWith('image/') || item.type === 'application/pdf'
}

function isReferenceFile(file: File) {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
}
