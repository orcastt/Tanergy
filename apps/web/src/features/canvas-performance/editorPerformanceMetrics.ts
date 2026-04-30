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
  const counts = getCanvasPerformanceCounts(editor)
  useCanvasPerformanceStore.getState().updateMetrics({
    imageLikeCount: counts.imageLikeCount,
    nodeCardCount: counts.nodeCardCount,
    viewportWidth: window.innerWidth,
    zoom: editor.getZoomLevel(),
  })
}

export function hasCanvasPerformanceStructureChange(changes: StoreChanges) {
  const records = [
    ...Object.values(changes.added ?? {}),
    ...Object.values(changes.removed ?? {}),
  ]
  if (records.some(isPerformanceCountedRecord)) return true

  return Object.values(changes.updated ?? {}).some((record) => {
    const update = normalizeUpdatedRecord(record)
    return update ? isPerformanceCountedRecord(update.from) !== isPerformanceCountedRecord(update.to) : false
  })
}

function getCanvasPerformanceCounts(editor: Editor) {
  return editor.getCurrentPageShapes().reduce((counts, shape) => {
    if (shape.type === 'image') counts.imageLikeCount += 1
    if (isNodeCard(shape)) {
      counts.nodeCardCount += 1
      if (shape.props.nodeType === 'image') counts.imageLikeCount += 1
    }
    return counts
  }, { imageLikeCount: 0, nodeCardCount: 0 })
}

function isPerformanceCountedRecord(record: unknown) {
  const item = asShapeRecord(record)
  return Boolean(
    item &&
    item.typeName === 'shape' &&
    (item.type === 'image' || item.type === 'node_card')
  )
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
