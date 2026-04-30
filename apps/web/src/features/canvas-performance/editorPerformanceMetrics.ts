import type { Editor } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import { useCanvasPerformanceStore } from './canvasPerformanceStore'

type StoreChanges = {
  added?: Record<string, unknown>
  removed?: Record<string, unknown>
  updated?: Record<string, unknown>
}

type ShapeRecordLike = {
  props?: unknown
  type?: string
  typeName?: string
}

export function updateCanvasViewPerformanceMetrics(editor: Editor) {
  useCanvasPerformanceStore.getState().updateMetrics({
    viewportWidth: window.innerWidth,
    zoom: editor.getZoomLevel(),
  })
}

export function updateCanvasImagePerformanceMetrics(editor: Editor) {
  useCanvasPerformanceStore.getState().updateMetrics({
    imageLikeCount: getImageLikeCount(editor),
    viewportWidth: window.innerWidth,
    zoom: editor.getZoomLevel(),
  })
}

export function hasImageLikeStructureChange(changes: StoreChanges) {
  const records = [
    ...Object.values(changes.added ?? {}),
    ...Object.values(changes.removed ?? {}),
  ]
  if (records.some(isImageLikeRecord)) return true

  return Object.values(changes.updated ?? {}).some((record) => {
    const update = normalizeUpdatedRecord(record)
    return update ? isImageLikeRecord(update.from) !== isImageLikeRecord(update.to) : false
  })
}

function getImageLikeCount(editor: Editor) {
  return editor.getCurrentPageShapes().filter((shape) => (
    shape.type === 'image' ||
    (isNodeCard(shape) && shape.props.nodeType === 'image')
  )).length
}

function isImageLikeRecord(record: unknown) {
  const item = asShapeRecord(record)
  return Boolean(
    item &&
    item.typeName === 'shape' &&
    (item.type === 'image' || (item.type === 'node_card' && getNodeType(item.props) === 'image'))
  )
}

function getNodeType(props: unknown) {
  return props && typeof props === 'object' && 'nodeType' in props
    ? (props as { nodeType?: unknown }).nodeType
    : null
}

function normalizeUpdatedRecord(record: unknown) {
  if (Array.isArray(record)) return { from: record[0], to: record[1] }
  if (record && typeof record === 'object' && 'to' in record) {
    return record as { from: unknown; to: unknown }
  }
  return null
}

function asShapeRecord(record: unknown): ShapeRecordLike | null {
  return record && typeof record === 'object' ? (record as ShapeRecordLike) : null
}

function isNodeCard(shape: unknown): shape is NodeCardShape {
  return Boolean(shape && typeof shape === 'object' && 'type' in shape && shape.type === 'node_card')
}
