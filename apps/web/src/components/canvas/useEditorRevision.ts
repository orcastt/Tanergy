'use client'

import { useEffect, useReducer } from 'react'
import type { Editor } from 'tldraw'

type EditorRevisionMode =
  | 'all'
  | 'arrow-geometry'
  | 'document'
  | 'node-content'
  | 'node-geometry'
  | 'selection'
  | 'style-panel'
  | 'viewport-document'

type RecordLike = {
  cameraState?: unknown
  croppingShapeId?: unknown
  currentPageId?: unknown
  editingShapeId?: unknown
  focusedGroupId?: unknown
  id?: string
  isGridMode?: unknown
  isToolLocked?: unknown
  opacityForNextShape?: unknown
  props?: unknown
  selectedShapeIds?: unknown
  stylesForNextShape?: unknown
  type?: string
  typeName?: string
}

export function useEditorRevision(editor: Editor | null, mode: EditorRevisionMode = 'all') {
  const [, bumpRevision] = useReducer((revision: number) => revision + 1, 0)

  useEffect(() => {
    if (!editor) return
    return editor.store.listen((entry) => {
      if (mode === 'all' || shouldBumpForMode(editor, entry.changes, mode)) {
        bumpRevision()
      }
    }, { scope: 'all', source: 'all' })
  }, [editor, mode])
}

function shouldBumpForMode(
  editor: Editor,
  changes: {
    added?: Record<string, unknown>
    removed?: Record<string, unknown>
    updated?: Record<string, unknown>
  },
  mode: Exclude<EditorRevisionMode, 'all'>
) {
  switch (mode) {
    case 'arrow-geometry':
      return hasArrowGeometryRecordChanges(changes)
    case 'document':
      return hasDocumentRecordChanges(changes, 'document')
    case 'node-content':
      return hasDocumentRecordChanges(changes, 'node-content')
    case 'node-geometry':
      return hasNodeGeometryRecordChanges(changes)
    case 'selection':
      return hasSelectionRecordChanges(changes)
    case 'style-panel':
      return !editor.inputs.getIsDragging() && hasStylePanelRecordChanges(changes)
    case 'viewport-document':
      return hasViewportDocumentRecordChanges(changes, editor.inputs.getIsDragging())
  }
}

function hasDocumentRecordChanges(changes: {
  added?: Record<string, unknown>
  removed?: Record<string, unknown>
  updated?: Record<string, unknown>
}, mode: Exclude<EditorRevisionMode, 'all'>) {
  const records = [
    ...Object.values(changes.added ?? {}),
    ...Object.values(changes.removed ?? {}),
  ]

  if (records.some((record) => isRelevantDocumentRecord(record, mode))) return true

  return Object.values(changes.updated ?? {}).some((record) => {
    const update = normalizeUpdatedRecord(record)
    return update ? isRelevantUpdatedRecord(update.from, update.to, mode) : false
  })
}

function isRelevantDocumentRecord(record: unknown, mode: Exclude<EditorRevisionMode, 'all'>) {
  const item = asRecordLike(record)
  if (!item) return false
  if (item.typeName === 'asset') return true
  if (item.typeName !== 'shape') return false
  return mode === 'document' || item.type === 'node_card'
}

function isRelevantUpdatedRecord(from: unknown, to: unknown, mode: Exclude<EditorRevisionMode, 'all'>) {
  const before = asRecordLike(from)
  const after = asRecordLike(to)
  if (!after) return false
  if (after.typeName === 'asset') return true
  if (after.typeName !== 'shape') return false
  if (mode === 'node-content' && after.type !== 'node_card') return false
  return before?.type !== after.type || before?.props !== after.props
}

function hasNodeGeometryRecordChanges(changes: StoreChanges) {
  return hasRecordChange(changes, isNodeCardOrCameraRecord, (from, to) => {
    const before = asRecordLike(from)
    const after = asRecordLike(to)
    if (!before || !after) return isNodeCardOrCameraRecord(from) || isNodeCardOrCameraRecord(to)
    if (isNodeCardRecord(before) || isNodeCardRecord(after)) return true
    if (after.typeName === 'camera') return true
    if (after.typeName === 'instance') {
      return before.currentPageId !== after.currentPageId || before.cameraState !== after.cameraState
    }
    return false
  })
}

function hasArrowGeometryRecordChanges(changes: StoreChanges) {
  return hasRecordChange(changes, isArrowGeometryRecord, (from, to) => {
    const before = asRecordLike(from)
    const after = asRecordLike(to)
    if (!before || !after) return isArrowGeometryRecord(from) || isArrowGeometryRecord(to)
    if (isArrowOrNodeShapeRecord(before) || isArrowOrNodeShapeRecord(after)) return true
    if (after.typeName === 'binding' || after.typeName === 'camera') return true
    if (after.typeName === 'instance') {
      return before.currentPageId !== after.currentPageId || before.cameraState !== after.cameraState
    }
    if (after.typeName === 'instance_page_state') {
      return before.selectedShapeIds !== after.selectedShapeIds
    }
    return false
  })
}

function hasSelectionRecordChanges(changes: StoreChanges) {
  return hasRecordChange(changes, isSelectionRecord, (from, to) => {
    const before = asRecordLike(from)
    const after = asRecordLike(to)
    if (!before || !after) return isSelectionRecord(from) || isSelectionRecord(to)
    return (
      before.typeName !== after.typeName ||
      before.selectedShapeIds !== after.selectedShapeIds ||
      before.editingShapeId !== after.editingShapeId ||
      before.croppingShapeId !== after.croppingShapeId ||
      before.focusedGroupId !== after.focusedGroupId ||
      before.cameraState !== after.cameraState
    )
  })
}

function hasStylePanelRecordChanges(changes: StoreChanges) {
  return hasRecordChange(changes, isStylePanelRecord, (from, to) => {
    const before = asRecordLike(from)
    const after = asRecordLike(to)
    if (!before || !after) return isStylePanelRecord(from) || isStylePanelRecord(to)
    if (before.typeName !== after.typeName) return true
    if (after.typeName === 'shape') return before.type !== after.type || before.props !== after.props
    if (after.typeName === 'instance') {
      return (
        before.isGridMode !== after.isGridMode ||
        before.isToolLocked !== after.isToolLocked ||
        before.opacityForNextShape !== after.opacityForNextShape ||
        before.stylesForNextShape !== after.stylesForNextShape
      )
    }
    return hasSelectionRecordChanges({ updated: { record: [from, to] } })
  })
}

function hasViewportDocumentRecordChanges(changes: StoreChanges, skipShapeUpdates: boolean) {
  return hasRecordChange(changes, isViewportDocumentRecord, (from, to) => {
    const before = asRecordLike(from)
    const after = asRecordLike(to)
    if (!before || !after) return isViewportDocumentRecord(from) || isViewportDocumentRecord(to)
    if (before.typeName !== after.typeName) return true
    if (after.typeName === 'shape') {
      return !skipShapeUpdates && (before.type !== after.type || before.props !== after.props)
    }
    if (after.typeName === 'instance') {
      return before.currentPageId !== after.currentPageId || before.cameraState !== after.cameraState
    }
    return after.typeName === 'asset' || after.typeName === 'camera'
  })
}

type StoreChanges = {
  added?: Record<string, unknown>
  removed?: Record<string, unknown>
  updated?: Record<string, unknown>
}

function hasRecordChange(
  changes: StoreChanges,
  isRelevantRecord: (record: unknown) => boolean,
  isRelevantUpdate: (from: unknown, to: unknown) => boolean
) {
  const records = [
    ...Object.values(changes.added ?? {}),
    ...Object.values(changes.removed ?? {}),
  ]
  if (records.some(isRelevantRecord)) return true

  return Object.values(changes.updated ?? {}).some((record) => {
    const update = normalizeUpdatedRecord(record)
    return update ? isRelevantUpdate(update.from, update.to) : false
  })
}

function isNodeCardOrCameraRecord(record: unknown) {
  const item = asRecordLike(record)
  return Boolean(
    item &&
    (item.typeName === 'camera' ||
      item.typeName === 'instance' ||
      isNodeCardRecord(item))
  )
}

function isArrowGeometryRecord(record: unknown) {
  const item = asRecordLike(record)
  return Boolean(
    item &&
    (item.typeName === 'camera' ||
      item.typeName === 'binding' ||
      item.typeName === 'instance_page_state' ||
      item.typeName === 'instance' ||
      isArrowOrNodeShapeRecord(item))
  )
}

function isSelectionRecord(record: unknown) {
  const item = asRecordLike(record)
  return Boolean(item && (item.typeName === 'instance_page_state' || item.typeName === 'instance'))
}

function isStylePanelRecord(record: unknown) {
  const item = asRecordLike(record)
  return Boolean(
    item &&
    (item.typeName === 'instance' ||
      item.typeName === 'instance_page_state' ||
      item.typeName === 'asset' ||
      item.typeName === 'shape')
  )
}

function isViewportDocumentRecord(record: unknown) {
  const item = asRecordLike(record)
  return Boolean(
    item &&
    (item.typeName === 'camera' ||
      item.typeName === 'instance' ||
      item.typeName === 'asset' ||
      item.typeName === 'shape')
  )
}

function isNodeCardRecord(record: unknown) {
  const item = asRecordLike(record)
  return Boolean(item && item.typeName === 'shape' && item.type === 'node_card')
}

function isArrowOrNodeShapeRecord(record: unknown) {
  const item = asRecordLike(record)
  return Boolean(item && item.typeName === 'shape' && (item.type === 'arrow' || item.type === 'node_card'))
}

function normalizeUpdatedRecord(record: unknown) {
  if (Array.isArray(record)) {
    return { from: record[0], to: record[1] }
  }
  if (record && typeof record === 'object' && 'to' in record) {
    return { from: asObjectWithFromTo(record).from, to: asObjectWithFromTo(record).to }
  }
  return null
}

function asRecordLike(record: unknown): RecordLike | null {
  return record && typeof record === 'object' ? (record as RecordLike) : null
}

function asObjectWithFromTo(record: unknown): { from: unknown; to: unknown } {
  return record as { from: unknown; to: unknown }
}
