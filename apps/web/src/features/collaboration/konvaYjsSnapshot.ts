'use client'

import * as Y from 'yjs'
import type { CanvasDocument, CanvasImageShape, CanvasNodeShape } from '@/features/canvas-engine'
import { getDocumentSignature } from '@/components/canvas/boardSaveStatus'
import type { SerializedKonvaBoardAsset, SerializedKonvaBoardDocument } from '@/features/boards/konvaBoardDocument'
import { normalizeKonvaBoardPages, type SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import { getRuntimeGraphGeneratedOutputRefs, getRuntimeGraphImageAssetRef, type RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'
import { mergeActiveKonvaBoardPages, mergeKonvaBoardPages } from './konvaYjsPageMerge'
import {
  createKonvaYjsUndoManager,
  readKonvaYjsStructuredSnapshot,
  writeKonvaYjsStructuredSnapshot,
} from './konvaYjsStructure'

export { createKonvaYjsUndoManager }

export type KonvaYjsSnapshotWriteMode = 'active-page' | 'page-batch' | 'full-board'

export type KonvaYjsRoomRecord = {
  activePageId?: string
  actorId: string
  canvasSettings?: SerializedKonvaBoardDocument['canvasSettings']
  changedPageIds: string[]
  mode: KonvaYjsSnapshotWriteMode
  pages: SerializedKonvaBoardPage[]
  publishedAt: string
  serializedAt: string
  signature: string
}

type KonvaYjsSnapshotWriteOptions = {
  activePageId?: string
  basePages?: SerializedKonvaBoardPage[] | null
  changedPageIds?: string[]
  mode?: KonvaYjsSnapshotWriteMode
}

export function readKonvaYjsRoomRecord(ydoc: Y.Doc): KonvaYjsRoomRecord | null {
  const nativeSnapshot = readKonvaYjsStructuredSnapshot(ydoc)
  if (!nativeSnapshot) return null
  return {
    activePageId: nativeSnapshot.activePageId,
    actorId: nativeSnapshot.actorId,
    canvasSettings: nativeSnapshot.canvasSettings,
    changedPageIds: nativeSnapshot.changedPageIds,
    mode: nativeSnapshot.mode,
    pages: nativeSnapshot.pages,
    publishedAt: nativeSnapshot.publishedAt,
    serializedAt: nativeSnapshot.serializedAt,
    signature: nativeSnapshot.signature,
  }
}

export function writeKonvaYjsSnapshot(
  ydoc: Y.Doc,
  record: KonvaYjsRoomRecord,
  origin?: unknown,
  options: KonvaYjsSnapshotWriteOptions = {},
) {
  const nextRecord = buildNextKonvaYjsRecord(ydoc, record, options)
  writeKonvaYjsStructuredSnapshot(ydoc, nextRecord, origin, {
    basePages: options.basePages ?? null,
  })
  return nextRecord
}

function buildNextKonvaYjsRecord(
  ydoc: Y.Doc,
  incomingRecord: KonvaYjsRoomRecord,
  options: KonvaYjsSnapshotWriteOptions,
) {
  const normalizedIncoming = createRoomRecord({
    activePageId: incomingRecord.activePageId,
    actorId: incomingRecord.actorId,
    canvasSettings: incomingRecord.canvasSettings,
    changedPageIds: incomingRecord.changedPageIds,
    mode: options.mode ?? incomingRecord.mode,
    pages: incomingRecord.pages,
    publishedAt: incomingRecord.publishedAt,
    serializedAt: incomingRecord.serializedAt,
  })
  const currentRecord = readKonvaYjsRoomRecord(ydoc)
  const basePages = options.basePages ?? null
  if (!currentRecord || !basePages) return normalizedIncoming

  const currentPages = currentRecord.pages
  const resolvedMode = options.mode ?? incomingRecord.mode ?? 'full-board'
  if ((options.mode ?? 'full-board') === 'active-page') {
    const targetPageId = options.activePageId ?? normalizedIncoming.activePageId
    if (!targetPageId) return normalizedIncoming
    const mergedPages = mergeActiveKonvaBoardPages(
      currentPages,
      normalizedIncoming.pages,
      targetPageId,
      basePages,
    )
    return createRoomRecord({
      activePageId: normalizedIncoming.activePageId,
      actorId: incomingRecord.actorId,
      canvasSettings: normalizedIncoming.canvasSettings ?? currentRecord.canvasSettings,
      changedPageIds: normalizedIncoming.changedPageIds,
      mode: resolvedMode,
      pages: mergedPages,
      publishedAt: incomingRecord.publishedAt,
      serializedAt: normalizedIncoming.serializedAt,
    })
  }

  if ((options.mode ?? 'full-board') === 'page-batch') {
    return createRoomRecord({
      activePageId: normalizedIncoming.activePageId,
      actorId: incomingRecord.actorId,
      canvasSettings: normalizedIncoming.canvasSettings ?? currentRecord.canvasSettings,
      changedPageIds: normalizedIncoming.changedPageIds,
      mode: resolvedMode,
      pages: mergeKonvaBoardPages(currentPages, normalizedIncoming.pages, basePages),
      publishedAt: incomingRecord.publishedAt,
      serializedAt: normalizedIncoming.serializedAt,
    })
  }

  return createRoomRecord({
    activePageId: normalizedIncoming.activePageId,
    actorId: incomingRecord.actorId,
    canvasSettings: normalizedIncoming.canvasSettings ?? currentRecord.canvasSettings,
    changedPageIds: normalizedIncoming.changedPageIds,
    mode: resolvedMode,
    pages: mergeKonvaBoardPages(currentPages, normalizedIncoming.pages, basePages),
    publishedAt: incomingRecord.publishedAt,
    serializedAt: normalizedIncoming.serializedAt,
  })
}

function createRoomRecord(options: {
  activePageId?: string
  actorId: string
  canvasSettings?: SerializedKonvaBoardDocument['canvasSettings']
  changedPageIds?: readonly string[]
  mode: KonvaYjsSnapshotWriteMode
  pages: SerializedKonvaBoardPage[]
  publishedAt: string
  serializedAt?: string
}) {
  const snapshot = createStructuredKonvaSnapshot({
    activePageId: options.activePageId,
    canvasSettings: options.canvasSettings,
    pages: options.pages,
    serializedAt: options.serializedAt,
  })
  return {
    activePageId: snapshot.activePageId,
    actorId: options.actorId,
    canvasSettings: snapshot.canvasSettings,
    changedPageIds: getChangedPageIds(snapshot.pages ?? [], {
      activePageId: options.activePageId,
      changedPageIds: options.changedPageIds ? [...options.changedPageIds] : undefined,
      mode: options.mode,
    }),
    mode: options.mode,
    pages: snapshot.pages ?? [],
    publishedAt: options.publishedAt,
    serializedAt: snapshot.serializedAt,
    signature: getDocumentSignature(snapshot),
  } satisfies KonvaYjsRoomRecord
}

function createStructuredKonvaSnapshot(options: {
  activePageId?: string
  canvasSettings?: SerializedKonvaBoardDocument['canvasSettings']
  pages: SerializedKonvaBoardPage[]
  serializedAt?: string
}): SerializedKonvaBoardDocument {
  const serializedAt = options.serializedAt ?? new Date().toISOString()
  const sourcePage = options.pages.find((page) => page.id === options.activePageId) ?? options.pages[0]
  if (!sourcePage) {
    throw new Error('Konva Yjs snapshots require at least one serialized page.')
  }
  const sourceDocument = cloneJsonValue(sourcePage.canvasDocument) as CanvasDocument
  const pages = normalizeKonvaBoardPages({
    activePageId: options.activePageId,
    canvasDocument: sourceDocument,
    pages: options.pages,
    serializedAt,
  })
  const activePage = pages.find((page) => page.id === (options.activePageId ?? pages[0]?.id)) ?? pages[0]
  if (!activePage) {
    throw new Error('Konva Yjs snapshots require at least one normalized page.')
  }
  const canvasDocument = cloneJsonValue(activePage.canvasDocument) as CanvasDocument
  return {
    activePageId: activePage.id,
    assets: collectKonvaBoardAssets(pages.map((page) => page.canvasDocument)),
    canvasDocument,
    canvasSettings: options.canvasSettings,
    pages,
    renderer: 'konva',
    serializedAt,
    version: 2,
  }
}

function getChangedPageIds(pages: SerializedKonvaBoardPage[], options: KonvaYjsSnapshotWriteOptions) {
  const snapshotPageIds = pages.map((page) => page.id)
  const explicitIds = dedupePageIds(options.changedPageIds?.filter((pageId) => snapshotPageIds.includes(pageId)) ?? [])
  if (explicitIds.length > 0) return explicitIds
  if ((options.mode ?? 'full-board') === 'active-page') {
    return options.activePageId ? [options.activePageId] : []
  }
  return snapshotPageIds
}

function collectKonvaBoardAssets(documents: CanvasDocument[]) {
  const assets = new Map<string, SerializedKonvaBoardAsset>()
  for (const document of documents) {
    for (const shape of document.shapes) {
      if (shape.type === 'image') addImageShapeAsset(assets, shape)
      if (shape.type === 'node_card') addNodeShapeAssets(assets, shape)
    }
  }
  return [...assets.values()]
}

function addImageShapeAsset(assets: Map<string, SerializedKonvaBoardAsset>, shape: CanvasImageShape) {
  rememberAsset(assets, {
    height: shape.props.height,
    id: shape.props.assetId,
    mimeType: shape.props.mime,
    name: shape.props.title,
    sourceUrl: shape.props.originalUrl,
    type: 'image',
    width: shape.props.width,
  })
}

function addNodeShapeAssets(assets: Map<string, SerializedKonvaBoardAsset>, shape: CanvasNodeShape) {
  const ownRef = getRuntimeGraphImageAssetRef(shape.props.data)
  if (ownRef) rememberAssetRef(assets, ownRef)
  for (const ref of getRuntimeGraphGeneratedOutputRefs(shape.props.data)) rememberAssetRef(assets, ref)
}

function rememberAssetRef(assets: Map<string, SerializedKonvaBoardAsset>, ref: RuntimeGraphImageAssetRef) {
  rememberAsset(assets, {
    height: ref.imageHeight,
    id: ref.assetId,
    name: ref.title,
    sourceUrl: ref.originalUrl,
    type: 'image',
    width: ref.imageWidth,
  })
}

function rememberAsset(assets: Map<string, SerializedKonvaBoardAsset>, asset: SerializedKonvaBoardAsset) {
  if (!asset.id || asset.id.startsWith('input:')) return
  assets.set(asset.id, pruneUndefined(asset))
}

function cloneJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function dedupePageIds(pageIds: readonly string[]) {
  return [...new Set(pageIds.filter((pageId): pageId is string => typeof pageId === 'string' && pageId.length > 0))]
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}
