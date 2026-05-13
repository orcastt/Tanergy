import * as Y from 'yjs'
import type { CanvasDocument, CanvasRuntimeEdge, CanvasShape } from '@/features/canvas-engine'
import type { SerializedKonvaBoardDocument } from '@/features/boards/konvaBoardDocument'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import {
  ensureArray,
  ensureMap,
  isPlainObject,
  pruneUndefined,
  readIdArray,
  readPlainValue,
  setOptionalPrimitive,
  setPrimitive,
  syncIdArray,
  syncPlainField,
  syncPlainObject,
} from './yjsJsonTree'

const rootKey = 'konva-board'
const nativeFormat = 'pages-v2-yjs'
const pagesStoreKey = 'pages'
const pageOrderKey = 'pageOrder'
const changedPageIdsKey = 'changedPageIds'
const canvasDocumentKey = 'canvasDocument'
const shapesStoreKey = 'shapes'
const shapeOrderKey = 'shapeOrder'
const runtimeEdgesStoreKey = 'runtimeEdges'
const runtimeEdgeOrderKey = 'runtimeEdgeOrder'

type KonvaYjsWriteMode = 'active-page' | 'page-batch' | 'full-board'

export type KonvaYjsStructuredSnapshot = {
  activePageId?: string
  actorId: string
  canvasSettings?: SerializedKonvaBoardDocument['canvasSettings']
  changedPageIds: string[]
  mode: KonvaYjsWriteMode
  pages: SerializedKonvaBoardPage[]
  publishedAt: string
  serializedAt: string
  signature: string
}

export function createKonvaYjsUndoManager(ydoc: Y.Doc, trackedOrigins: Iterable<unknown>) {
  return new Y.UndoManager(getRoot(ydoc), {
    captureTimeout: 250,
    trackedOrigins: new Set(trackedOrigins),
  })
}

export function readKonvaYjsStructuredSnapshot(ydoc: Y.Doc): KonvaYjsStructuredSnapshot | null {
  const root = getRoot(ydoc)
  if (root.get('format') !== nativeFormat) return null
  const actorId = root.get('actorId')
  const publishedAt = root.get('publishedAt')
  const serializedAt = root.get('serializedAt')
  const signature = root.get('signature')
  const activePageId = root.get('activePageId')
  const mode = root.get('writeMode')
  if (
    typeof actorId !== 'string'
    || typeof publishedAt !== 'string'
    || typeof serializedAt !== 'string'
    || typeof signature !== 'string'
    || (activePageId !== undefined && typeof activePageId !== 'string')
    || (mode !== undefined && mode !== 'active-page' && mode !== 'page-batch' && mode !== 'full-board')
  ) {
    return null
  }

  const pages = readPages(root)
  if (pages.length === 0) return null
  return {
    activePageId: typeof activePageId === 'string' ? activePageId : pages[0]?.id,
    actorId,
    canvasSettings: readPlainValue(root.get('canvasSettings')) as SerializedKonvaBoardDocument['canvasSettings'] | undefined,
    changedPageIds: readIdArray(root.get(changedPageIdsKey), pages.map((page) => page.id)),
    mode: mode === 'active-page'
      ? 'active-page'
      : mode === 'page-batch'
        ? 'page-batch'
        : 'full-board',
    pages,
    publishedAt,
    serializedAt,
    signature,
  }
}

export function writeKonvaYjsStructuredSnapshot(
  ydoc: Y.Doc,
  snapshot: KonvaYjsStructuredSnapshot,
  origin?: unknown,
  options: {
    basePages?: SerializedKonvaBoardPage[] | null
  } = {},
) {
  const root = getRoot(ydoc)
  ydoc.transact(() => {
    setPrimitive(root, 'format', nativeFormat)
    setPrimitive(root, 'actorId', snapshot.actorId)
    setPrimitive(root, 'publishedAt', snapshot.publishedAt)
    setPrimitive(root, 'serializedAt', snapshot.serializedAt)
    setPrimitive(root, 'signature', snapshot.signature)
    setPrimitive(root, 'writeMode', snapshot.mode)
    setOptionalPrimitive(root, 'activePageId', snapshot.activePageId ?? null)
    syncPlainField(root, 'canvasSettings', snapshot.canvasSettings)
    syncIdArray(ensureArray(root, changedPageIdsKey), snapshot.changedPageIds)
    syncPageStore(root, snapshot.pages, {
      basePages: options.basePages,
      changedPageIds: snapshot.changedPageIds,
      mode: snapshot.mode,
    })
    clearLegacySnapshotKeys(root)
  }, origin)
}

function readPages(root: Y.Map<unknown>) {
  const pagesStore = root.get(pagesStoreKey)
  const pageOrder = root.get(pageOrderKey)
  if (!(pagesStore instanceof Y.Map) || !(pageOrder instanceof Y.Array)) return []
  return readEntityStore<SerializedKonvaBoardPage>(pagesStore, pageOrder, readPage)
}

function syncPageStore(
  root: Y.Map<unknown>,
  pages: SerializedKonvaBoardPage[],
  options: {
    basePages?: SerializedKonvaBoardPage[] | null
    changedPageIds?: readonly string[]
    mode: KonvaYjsWriteMode
  },
) {
  const store = ensureMap(root, pagesStoreKey) as Y.Map<Y.Map<unknown>>
  const order = ensureArray<string>(root, pageOrderKey)
  const basePagesById = new Map((options.basePages ?? []).map((page) => [page.id, page]))
  const pageIds = pages.map((page) => page.id)
  const changedPageIds = new Set(options.changedPageIds?.filter((pageId) => typeof pageId === 'string' && pageId.length > 0) ?? [])
  const syncAllPageFields = options.mode !== 'active-page'
  const syncAllCanvasDocuments = options.mode === 'full-board'

  for (const key of Array.from(store.keys())) {
    if (!pageIds.includes(key)) store.delete(key)
  }
  syncIdArray(order, pageIds)

  for (const page of pages) {
    const existing = store.get(page.id)
    const pageMap = existing instanceof Y.Map ? existing : new Y.Map<unknown>()
    if (!(existing instanceof Y.Map)) store.set(page.id, pageMap)

    const shouldSyncPageFields = syncAllPageFields || changedPageIds.has(page.id) || !(existing instanceof Y.Map)
    if (shouldSyncPageFields) {
      syncPlainObject(pageMap, {
        createdAt: page.createdAt,
        id: page.id,
        index: page.index,
        thumbnailUrl: page.thumbnailUrl ?? null,
        title: page.title,
        updatedAt: page.updatedAt,
      }, new Set([canvasDocumentKey]))
    }

    const shouldSyncCanvasDocument = syncAllCanvasDocuments || changedPageIds.has(page.id) || !(existing instanceof Y.Map)
    if (shouldSyncCanvasDocument) {
      syncCanvasDocument(ensureMap(pageMap, canvasDocumentKey), page.canvasDocument, {
        baseDocument: basePagesById.get(page.id)?.canvasDocument ?? null,
        mode: options.mode,
      })
    }
  }
}

function readPage(pageMap: Y.Map<unknown>) {
  const canvasDocument = pageMap.get(canvasDocumentKey)
  if (!(canvasDocument instanceof Y.Map)) return null
  const id = pageMap.get('id')
  const title = pageMap.get('title')
  const createdAt = pageMap.get('createdAt')
  const updatedAt = pageMap.get('updatedAt')
  const index = pageMap.get('index')
  const thumbnailUrl = pageMap.get('thumbnailUrl')
  if (
    typeof id !== 'string'
    || typeof title !== 'string'
    || typeof createdAt !== 'string'
    || typeof updatedAt !== 'string'
    || typeof index !== 'number'
    || (thumbnailUrl !== undefined && thumbnailUrl !== null && typeof thumbnailUrl !== 'string')
  ) {
    return null
  }
  const document = readCanvasDocument(canvasDocument)
  if (!document) return null
  return {
    canvasDocument: document,
    createdAt,
    id,
    index,
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : null,
    title,
    updatedAt,
  }
}

function syncCanvasDocument(
  documentMap: Y.Map<unknown>,
  document: CanvasDocument,
  options: {
    baseDocument?: CanvasDocument | null
    mode: KonvaYjsWriteMode
  },
) {
  syncPlainObject(documentMap, {
    camera: document.camera,
    id: document.id,
    metadata: document.metadata,
    schemaVersion: document.schemaVersion,
  }, new Set([runtimeEdgesStoreKey, runtimeEdgeOrderKey, shapesStoreKey, shapeOrderKey]))
  const baseDocument = options.baseDocument ?? null
  const syncAllEntities = options.mode === 'full-board' || !baseDocument
  const changedShapeIds = syncAllEntities
    ? null
    : deriveChangedEntityIds(document.shapes, baseDocument.shapes)
  const changedRuntimeEdgeIds = syncAllEntities
    ? null
    : deriveChangedEntityIds(document.runtimeEdges, baseDocument.runtimeEdges)
  syncEntityStore(
    ensureMap(documentMap, shapesStoreKey),
    ensureArray<string>(documentMap, shapeOrderKey),
    document.shapes,
    (shapeMap, shape) => syncPlainObject(shapeMap, pruneUndefined(shape as Record<string, unknown>)),
    { changedIds: changedShapeIds },
  )
  syncEntityStore(
    ensureMap(documentMap, runtimeEdgesStoreKey),
    ensureArray<string>(documentMap, runtimeEdgeOrderKey),
    document.runtimeEdges,
    (edgeMap, edge) => syncPlainObject(edgeMap, pruneUndefined(edge as Record<string, unknown>)),
    { changedIds: changedRuntimeEdgeIds },
  )
}

function readCanvasDocument(documentMap: Y.Map<unknown>): CanvasDocument | null {
  const id = documentMap.get('id')
  const schemaVersion = documentMap.get('schemaVersion')
  const camera = readPlainValue(documentMap.get('camera'))
  const metadata = readPlainValue(documentMap.get('metadata'))
  const shapes = readEntityStore<CanvasShape>(
    documentMap.get(shapesStoreKey),
    documentMap.get(shapeOrderKey),
    (shapeMap) => readPlainValue(shapeMap) as CanvasShape | null,
  )
  const runtimeEdges = readEntityStore<CanvasRuntimeEdge>(
    documentMap.get(runtimeEdgesStoreKey),
    documentMap.get(runtimeEdgeOrderKey),
    (edgeMap) => readPlainValue(edgeMap) as CanvasRuntimeEdge | null,
  )
  if (
    typeof id !== 'string'
    || schemaVersion !== 1
    || !isPlainObject(camera)
    || !isPlainObject(metadata)
  ) {
    return null
  }
  return {
    camera: camera as CanvasDocument['camera'],
    id,
    metadata: metadata as CanvasDocument['metadata'],
    runtimeEdges,
    schemaVersion,
    shapes,
  }
}

function readEntityStore<T>(
  storeValue: unknown,
  orderValue: unknown,
  reader: (entityMap: Y.Map<unknown>) => null | T,
) {
  if (!(storeValue instanceof Y.Map) || !(orderValue instanceof Y.Array)) return []
  const entities: T[] = []
  for (const entityId of orderValue.toArray()) {
    if (typeof entityId !== 'string') continue
    const entityValue = storeValue.get(entityId)
    if (!(entityValue instanceof Y.Map)) continue
    const entity = reader(entityValue)
    if (entity) entities.push(entity)
  }
  return entities
}

function syncEntityStore<T extends { id: string }>(
  store: Y.Map<unknown>,
  order: Y.Array<string>,
  entities: readonly T[],
  writer: (entityMap: Y.Map<unknown>, entity: T) => void,
  options: {
    changedIds?: ReadonlySet<string> | null
  } = {},
) {
  const entityIds = entities.map((entity) => entity.id)
  const nextIds = new Set(entityIds)
  for (const key of Array.from(store.keys())) {
    if (!nextIds.has(key)) store.delete(key)
  }
  syncIdArray(order, entityIds)
  for (const entity of entities) {
    const existing = store.get(entity.id)
    const entityMap = existing instanceof Y.Map ? existing : new Y.Map<unknown>()
    if (!(existing instanceof Y.Map)) store.set(entity.id, entityMap)
    if (existing instanceof Y.Map && options.changedIds && !options.changedIds.has(entity.id)) continue
    writer(entityMap, entity)
  }
}

function deriveChangedEntityIds<T extends { id: string }>(entities: readonly T[], baseEntities: readonly T[]) {
  const changedIds = new Set<string>()
  const entityById = new Map(entities.map((entity) => [entity.id, entity]))
  const baseById = new Map(baseEntities.map((entity) => [entity.id, entity]))

  for (const entity of entities) {
    const baseEntity = baseById.get(entity.id)
    if (!baseEntity || !isSameJsonValue(entity, baseEntity)) changedIds.add(entity.id)
  }
  for (const baseEntity of baseEntities) {
    if (!entityById.has(baseEntity.id)) changedIds.add(baseEntity.id)
  }

  return changedIds
}

function isSameJsonValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function getRoot(ydoc: Y.Doc) {
  return ydoc.getMap<unknown>(rootKey)
}

function clearLegacySnapshotKeys(root: Y.Map<unknown>) {
  if (root.has('snapshot')) root.delete('snapshot')
  for (const key of Array.from(root.keys())) {
    if (key.startsWith('page:')) root.delete(key)
  }
}
