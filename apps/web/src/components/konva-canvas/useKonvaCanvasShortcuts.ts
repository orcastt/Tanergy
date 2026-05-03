import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import {
  screenToWorld,
  type CanvasCamera,
  type CanvasDocument,
  type CanvasShape,
} from '@/features/canvas-engine'
import { deleteKonvaShapes, duplicateKonvaShapes, reorderKonvaShapes } from './konvaCanvasStyle'
import { konvaToolShortcuts, type KonvaCanvasTool } from './konvaCanvasTypes'
import { copyKonvaShapes, pasteKonvaShapes } from './konvaShapeCommands'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
  redo: () => void
  undo: () => void
}

type UseKonvaCanvasShortcutsOptions = {
  camera: CanvasCamera
  clipboardRef: MutableRefObject<CanvasShape[]>
  document: CanvasDocument
  history: KonvaCanvasHistory
  selectedIds: string[]
  size: { height: number; width: number }
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onClipboardChange?: (shapeCount: number) => void
  onPanningChange: (isPanning: boolean) => void
  onSelectionChange: (shapeIds: string[]) => void
  onToolChange: (tool: KonvaCanvasTool) => void
}

export function useKonvaCanvasShortcuts(options: UseKonvaCanvasShortcutsOptions) {
  useEffect(() => {
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
        if (event.shiftKey) options.history.redo()
        else options.history.undo()
        return
      }
      if (command && key === 'c') {
        event.preventDefault()
        options.clipboardRef.current = copyKonvaShapes(options.document, options.selectedIds)
        options.onClipboardChange?.(options.clipboardRef.current.length)
        void writeClipboard(options.clipboardRef.current)
        return
      }
      if (command && key === 'v') {
        event.preventDefault()
        void pasteFromClipboard(options)
        return
      }
      if (command && key === 'd') {
        event.preventDefault()
        runDuplicate(options)
        return
      }
      if (command && key === 'a') {
        event.preventDefault()
        options.onSelectionChange(options.document.shapes.map((shape) => shape.id))
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        runDelete(options)
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
    const handleBlur = () => options.onPanningChange(false)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [options])
}

function runDelete(options: UseKonvaCanvasShortcutsOptions) {
  if (options.selectedIds.length === 0) return
  options.history.checkpoint(options.document)
  const result = deleteKonvaShapes(options.document, options.selectedIds)
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
}

function runDuplicate(options: UseKonvaCanvasShortcutsOptions) {
  if (options.selectedIds.length === 0) return
  options.history.checkpoint(options.document)
  const result = duplicateKonvaShapes(options.document, options.selectedIds)
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
}

function runLayerAction(options: UseKonvaCanvasShortcutsOptions, action: Parameters<typeof reorderKonvaShapes>[2]) {
  if (options.selectedIds.length === 0) return
  options.history.checkpoint(options.document)
  options.onDocumentChange(reorderKonvaShapes(options.document, options.selectedIds, action))
}

async function pasteFromClipboard(options: UseKonvaCanvasShortcutsOptions) {
  if (options.clipboardRef.current.length === 0) {
    options.clipboardRef.current = await readClipboard()
    options.onClipboardChange?.(options.clipboardRef.current.length)
  }
  if (options.clipboardRef.current.length === 0) return
  options.history.checkpoint(options.document)
  const center = screenToWorld({ x: options.size.width / 2, y: options.size.height / 2 }, options.camera)
  const result = pasteKonvaShapes(options.document, options.clipboardRef.current, center)
  options.onDocumentChange(result.document)
  options.onSelectionChange(result.selectedIds)
}

async function writeClipboard(shapes: CanvasShape[]) {
  if (shapes.length === 0 || !navigator.clipboard?.writeText) return
  await navigator.clipboard.writeText(JSON.stringify({ shapes, type: 'tangent/konva-shapes' }))
}

async function readClipboard() {
  if (!navigator.clipboard?.readText) return []
  try {
    const parsed = JSON.parse(await navigator.clipboard.readText()) as { shapes?: CanvasShape[]; type?: string }
    return parsed.type === 'tangent/konva-shapes' && Array.isArray(parsed.shapes) ? parsed.shapes : []
  } catch {
    return []
  }
}

function getShortcutTool(key: string): KonvaCanvasTool | null {
  const normalizedKey = key.toUpperCase()
  return (Object.keys(konvaToolShortcuts) as KonvaCanvasTool[]).find((tool) => konvaToolShortcuts[tool] === normalizedKey) ?? null
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'))
}
