import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import {
  type CanvasDocument,
  type CanvasPoint,
  type CanvasShape,
  withCanvasShapes,
} from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { deleteKonvaShapes, duplicateKonvaShapes, reorderKonvaShapes } from './konvaCanvasStyle'
import { pasteKonvaClipboardData, writeKonvaShapesToSystemClipboard } from './konvaClipboardCommands'
import { konvaToolShortcuts, type KonvaCanvasTool } from './konvaCanvasTypes'
import { applyFrameContainment } from './konvaFrameContainment'
import { expandKonvaGroupedShapeIds, groupKonvaShapes, setKonvaShapesLocked, ungroupKonvaShapes } from './konvaGroupCommands'
import { removeKonvaRuntimeEdge } from './konvaRuntimeEdges'
import { getShapesByIds, moveShapesFromOrigins } from './konvaSelectionUtils'
import { copyKonvaShapes } from './konvaShapeCommands'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
  redo: () => void
  undo: () => void
}

type UseKonvaCanvasShortcutsOptions = {
  clipboardRef: MutableRefObject<CanvasShape[]>
  document: CanvasDocument
  enabled?: boolean
  history: KonvaCanvasHistory
  selectedIds: string[]
  selectedEdgeId?: string | null
  getPastePoint: () => CanvasPoint
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onClipboardChange?: (shapeCount: number) => void
  onCopySelectionSvg?: () => void
  onEdgeSelectionChange?: (edgeId: string | null) => void
  onPanningChange: (isPanning: boolean) => void
  onRedo?: () => void
  onSelectionChange: (shapeIds: string[]) => void
  onToolChange: (tool: KonvaCanvasTool) => void
  onUndo?: () => void
  workspace?: TangentWorkspace
}

export function useKonvaCanvasShortcuts(options: UseKonvaCanvasShortcutsOptions) {
  useEffect(() => {
    if (options.enabled === false) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const key = event.key.toLowerCase()
      const command = event.metaKey || event.ctrlKey

      if (event.code === 'Space') {
        event.preventDefault()
        options.onPanningChange(true)
        return
      }
      if (event.key === 'Escape') {
        options.onToolChange('select')
        options.onPanningChange(false)
        return
      }
      if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) (options.onRedo ?? options.history.redo)()
        else (options.onUndo ?? options.history.undo)()
        return
      }
      if (command && key === 'c') {
        event.preventDefault()
        if (event.shiftKey && options.selectedIds.length > 0 && options.onCopySelectionSvg) {
          options.onCopySelectionSvg()
          return
        }
        options.clipboardRef.current = copyKonvaShapes(options.document, options.selectedIds)
        options.onClipboardChange?.(options.clipboardRef.current.length)
        void writeKonvaShapesToSystemClipboard(options.clipboardRef.current)
        return
      }
      if (command && key === 'x') {
        event.preventDefault()
        runCut(options)
        return
      }
      if (command && key === 'd') {
        event.preventDefault()
        runDuplicate(options)
        return
      }
      if (command && key === 'g') {
        event.preventDefault()
        runGroupAction(options, event.shiftKey ? 'ungroup' : 'group')
        return
      }
      if (command && key === 'a') {
        event.preventDefault()
        options.onSelectionChange(options.document.shapes.map((shape) => shape.id))
        return
      }
      if (!command && event.shiftKey && key === 'l') {
        event.preventDefault()
        runLockToggle(options)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        runDelete(options)
        return
      }
      if (!command && isNudgeKey(event.key)) {
        event.preventDefault()
        runNudge(options, getNudgeDelta(event.key, event.shiftKey))
        return
      }
      if (!command && (event.key === '[' || event.key === ']')) {
        event.preventDefault()
        runLayerAction(options, event.key === ']'
          ? event.altKey ? 'forward' : 'front'
          : event.altKey ? 'backward' : 'back')
        return
      }
      const tool = getShortcutTool(event.key)
      if (tool && !command && !event.altKey) {
        event.preventDefault()
        options.onToolChange(tool)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') options.onPanningChange(false)
    }
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target) || !event.clipboardData) return
      event.preventDefault()
      void pasteFromClipboardData(options, event.clipboardData)
    }
    const handleBlur = () => options.onPanningChange(false)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('paste', handlePaste)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('paste', handlePaste)
      window.removeEventListener('blur', handleBlur)
    }
  }, [options])
}

function runDelete(options: UseKonvaCanvasShortcutsOptions) {
  if (options.selectedEdgeId) {
    const edgeId = options.selectedEdgeId
    options.history.checkpoint(options.document)
    options.onDocumentChange((current) => removeKonvaRuntimeEdge(current, edgeId))
    options.onEdgeSelectionChange?.(null)
    return
  }
  if (options.selectedIds.length === 0) return
  options.history.checkpoint(options.document)
  const result = deleteKonvaShapes(options.document, options.selectedIds)
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
}

function runCut(options: UseKonvaCanvasShortcutsOptions) {
  if (options.selectedEdgeId) {
    const edgeId = options.selectedEdgeId
    options.history.checkpoint(options.document)
    options.onDocumentChange((current) => removeKonvaRuntimeEdge(current, edgeId))
    options.onEdgeSelectionChange?.(null)
    return
  }
  if (options.selectedIds.length === 0) return
  options.clipboardRef.current = copyKonvaShapes(options.document, options.selectedIds)
  options.onClipboardChange?.(options.clipboardRef.current.length)
  void writeKonvaShapesToSystemClipboard(options.clipboardRef.current)
  runDelete(options)
}

function runDuplicate(options: UseKonvaCanvasShortcutsOptions) {
  if (options.selectedIds.length === 0) return
  options.history.checkpoint(options.document)
  const result = duplicateKonvaShapes(options.document, options.selectedIds)
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
}

function runGroupAction(options: UseKonvaCanvasShortcutsOptions, action: 'group' | 'ungroup') {
  if (options.selectedIds.length === 0) return
  options.history.checkpoint(options.document)
  const result = action === 'group'
    ? groupKonvaShapes(options.document, options.selectedIds)
    : ungroupKonvaShapes(options.document, options.selectedIds)
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
}

function runLockToggle(options: UseKonvaCanvasShortcutsOptions) {
  if (options.selectedIds.length === 0) return
  const selected = new Set(options.selectedIds)
  const selectedShapes = options.document.shapes.filter((shape) => selected.has(shape.id))
  const shouldLock = selectedShapes.some((shape) => !shape.isLocked)
  options.history.checkpoint(options.document)
  const result = setKonvaShapesLocked(options.document, options.selectedIds, shouldLock)
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
}

function runLayerAction(options: UseKonvaCanvasShortcutsOptions, action: Parameters<typeof reorderKonvaShapes>[2]) {
  if (options.selectedIds.length === 0) return
  options.history.checkpoint(options.document)
  options.onDocumentChange(reorderKonvaShapes(options.document, options.selectedIds, action))
}

function runNudge(options: UseKonvaCanvasShortcutsOptions, delta: CanvasPoint) {
  if (options.selectedIds.length === 0) return
  const shapeIds = expandKonvaGroupedShapeIds(options.document.shapes, expandFrameChildren(options.document.shapes, options.selectedIds))
  const originShapes = getShapesByIds(options.document.shapes, shapeIds)
  if (originShapes.length === 0 || originShapes.some((shape) => shape.isLocked)) return
  options.history.checkpoint(options.document)
  const movedShapes = moveShapesFromOrigins(options.document.shapes, originShapes, delta)
  options.onDocumentChange(withCanvasShapes(options.document, applyFrameContainment(movedShapes, shapeIds)))
}

function isNudgeKey(key: string) {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight'
}

function getNudgeDelta(key: string, large: boolean): CanvasPoint {
  const amount = large ? 10 : 1
  if (key === 'ArrowUp') return { x: 0, y: -amount }
  if (key === 'ArrowDown') return { x: 0, y: amount }
  if (key === 'ArrowLeft') return { x: -amount, y: 0 }
  return { x: amount, y: 0 }
}

function expandFrameChildren(shapes: CanvasDocument['shapes'], shapeIds: string[]) {
  const expanded = new Set(shapeIds)
  let changed = true
  while (changed) {
    changed = false
    for (const shape of shapes) {
      if (shape.parentId && expanded.has(shape.parentId) && !expanded.has(shape.id)) {
        expanded.add(shape.id)
        changed = true
      }
    }
  }
  return [...expanded]
}

async function pasteFromClipboardData(options: UseKonvaCanvasShortcutsOptions, data: DataTransfer) {
  await pasteKonvaClipboardData({
    clipboardRef: options.clipboardRef,
    document: options.document,
    history: options.history,
    onClipboardChange: options.onClipboardChange,
    onDocumentChange: options.onDocumentChange,
    onSelectionChange: options.onSelectionChange,
    point: options.getPastePoint(),
    selectedIds: options.selectedIds,
    workspace: options.workspace,
  }, data)
}

function getShortcutTool(key: string): KonvaCanvasTool | null {
  const normalizedKey = key.toUpperCase()
  return (Object.keys(konvaToolShortcuts) as KonvaCanvasTool[]).find((tool) => konvaToolShortcuts[tool] === normalizedKey) ?? null
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'))
}
