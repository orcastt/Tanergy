import { useCallback, useRef, type DragEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import { screenToWorld, type CanvasCamera, type CanvasDocument, type CanvasPoint } from '@/features/canvas-engine'
import { getKonvaContextTargetSelection } from './konvaContextSelection'

type ContextMenuState = { worldX: number; worldY: number; x: number; y: number }
type DropHintKind = 'image' | 'pdf' | null

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
  onDropHintChange: (kind: DropHintKind) => void
  onToolChange: (tool: 'select') => void
  onUploadDropFileAtPoint: (file: File, point: CanvasPoint, fallbackCenterPoint: CanvasPoint) => void
}

export function useKonvaStageDomEvents({
  camera,
  document,
  lastPastePointRef,
  nodeMenuOpen,
  onCanvasDoubleClick,
  onContextMenuChange,
  onDropHintChange,
  onNodeMenuClose,
  onSelectionChange,
  onShellRectChange,
  onToolChange,
  onUploadDropFileAtPoint,
  selectedIds,
}: UseKonvaStageDomEventsOptions) {
  const dragDepthRef = useRef(0)

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    const kind = getDropHintKind(event.dataTransfer)
    if (!kind) return
    event.preventDefault()
    onDropHintChange(kind)
  }, [onDropHintChange])

  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    const kind = getDropHintKind(event.dataTransfer)
    if (!kind) return
    event.preventDefault()
    dragDepthRef.current += 1
    onDropHintChange(kind)
  }, [onDropHintChange])

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!getDropHintKind(event.dataTransfer)) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) onDropHintChange(null)
  }, [onDropHintChange])

  const handleDrop = useCallback((event: DragEvent<HTMLElement>) => {
    const file = Array.from(event.dataTransfer.files).find(isReferenceFile)
    if (!file) return
    event.preventDefault()
    dragDepthRef.current = 0
    onDropHintChange(null)
    const rect = event.currentTarget.getBoundingClientRect()
    const world = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, camera)
    const worldCenter = screenToWorld({ x: rect.width / 2, y: rect.height / 2 }, camera)
    onUploadDropFileAtPoint(file, world, worldCenter)
  }, [camera, onDropHintChange, onUploadDropFileAtPoint])

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
    handleDragEnter,
    handleDragLeave,
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

function isReferenceFile(file: File) {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
}

function getDropHintKind(dataTransfer: DataTransfer): DropHintKind {
  if (Array.from(dataTransfer.items).some((item) => item.type.startsWith('image/'))) return 'image'
  if (Array.from(dataTransfer.items).some((item) => item.type === 'application/pdf')) return 'pdf'
  return null
}
