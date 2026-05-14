import { getSerializableCanvasSettings, defaultCanvasSettings, useCanvasSettingsStore, type CanvasSettings } from '@/features/canvas-settings/canvasSettingsStore'
import type { CanvasDocument, CanvasImageShape, CanvasNodeShape } from '@/features/canvas-engine'
import { persistenceAssetProxyUrl } from '@/features/api/persistenceApi'
import { getRuntimeGraphGeneratedOutputRefs, getRuntimeGraphImageAssetRef, type RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'
import { auditBoardDocument, type BoardDocumentGuardResult } from './boardDocumentGuard'
import {
  createKonvaBoardPage,
  defaultKonvaBoardPageId,
  getActiveKonvaBoardPage,
  normalizeKonvaBoardPages,
  type SerializedKonvaBoardPage,
} from './konvaBoardPageContract'

export type SerializedKonvaBoardAsset = {
  height?: number
  id: string
  mimeType?: string
  name?: string
  sourceUrl?: string
  type: 'image'
  width?: number
}

export type SerializedKonvaBoardDocument = {
  activePageId?: string
  assets: SerializedKonvaBoardAsset[]
  canvasDocument: CanvasDocument
  canvasSettings?: CanvasSettings
  pages?: SerializedKonvaBoardPage[]
  renderer: 'konva'
  serializedAt: string
  version: 2
}

export type KonvaBoardDocumentSerializationResult = {
  audit: BoardDocumentGuardResult
  document: SerializedKonvaBoardDocument
}

export type KonvaBoardDocumentSerializationOptions = {
  activePageId?: string
  pages?: SerializedKonvaBoardPage[]
}

export type KonvaBoardRestoreResult = {
  assetCount: number
  edgeCount: number
  pageCount: number
  shapeCount: number
}

export type KonvaBoardRestorePayload = {
  activePageId: string
  document: CanvasDocument
  pages: SerializedKonvaBoardPage[]
  result: KonvaBoardRestoreResult
}

export type KonvaBoardHydratedPagesPayload = {
  activePageId: string
  pages: SerializedKonvaBoardPage[]
}

export type KonvaBoardPagesRestoreOptions = {
  activePageId?: string
  pages: SerializedKonvaBoardPage[]
  serializedAt?: string
  workspaceId?: string
}

export function serializeKonvaBoardDocument(
  document: CanvasDocument,
  options: KonvaBoardDocumentSerializationOptions = {}
): SerializedKonvaBoardDocument {
  const canvasDocument = cloneJsonValue(document) as CanvasDocument
  const serializedAt = new Date().toISOString()
  const activePageId = options.activePageId ?? defaultKonvaBoardPageId
  const pages = withActivePageDocument(
    normalizeKonvaBoardPages({
      activePageId,
      canvasDocument,
      pages: options.pages,
      serializedAt,
    }),
    activePageId,
    canvasDocument,
    serializedAt
  )
  return {
    activePageId,
    assets: collectKonvaBoardAssets(pages.map((page) => page.canvasDocument)),
    canvasDocument,
    canvasSettings: getSerializableCanvasSettings(),
    pages,
    renderer: 'konva',
    serializedAt,
    version: 2,
  }
}

export function createGuardedKonvaBoardDocument(
  document: CanvasDocument,
  options: KonvaBoardDocumentSerializationOptions = {}
): KonvaBoardDocumentSerializationResult {
  const serialized = serializeKonvaBoardDocument(document, options)
  return {
    audit: auditBoardDocument(serialized),
    document: serialized,
  }
}

export function restoreKonvaBoardDocument(
  document: unknown,
  options: { workspaceId?: string } = {},
): KonvaBoardRestorePayload {
  const hydrated = hydrateKonvaBoardPages(document)
  return restoreKonvaBoardPages({
    activePageId: hydrated.activePageId,
    pages: hydrated.pages,
    workspaceId: options.workspaceId,
  })
}

export function restoreKonvaBoardPages(options: KonvaBoardPagesRestoreOptions): KonvaBoardRestorePayload {
  if (!Array.isArray(options.pages) || options.pages.length === 0) {
    throw new Error('Konva board pages are not restorable.')
  }
  const normalizedPagesInput = normalizePersistedAssetUrls(options.pages, options.workspaceId)
  const seedDocument = cloneJsonValue(normalizedPagesInput[0]?.canvasDocument) as CanvasDocument
  const pages = normalizeKonvaBoardPages({
    activePageId: options.activePageId,
    canvasDocument: seedDocument,
    pages: normalizedPagesInput,
    serializedAt: options.serializedAt,
  })
  const activePage = pages.find((page) => page.id === (options.activePageId ?? pages[0]?.id)) ?? pages[0]
  if (!activePage) throw new Error('Konva board document has no active page.')
  return {
    activePageId: activePage.id,
    document: cloneJsonValue(activePage.canvasDocument) as CanvasDocument,
    pages,
    result: {
      assetCount: collectKonvaBoardAssets(pages.map((page) => page.canvasDocument)).length,
      edgeCount: pages.reduce((total, page) => total + page.canvasDocument.runtimeEdges.length, 0),
      pageCount: pages.length,
      shapeCount: pages.reduce((total, page) => total + page.canvasDocument.shapes.length, 0),
    },
  }
}

export function hydrateKonvaBoardPages(document: unknown): KonvaBoardHydratedPagesPayload {
  if (!isSerializedKonvaBoardDocument(document)) throw new Error('Konva board document is not restorable.')
  const audit = auditBoardDocument(document)
  if (!audit.ok) throw new Error(audit.issues.find((issue) => issue.blocking)?.message ?? 'Board document is blocked.')

  useCanvasSettingsStore.getState().replace(document.canvasSettings ?? defaultCanvasSettings)
  const pages = normalizeKonvaBoardPages(document)
  const activePage = getActiveKonvaBoardPage({ ...document, pages })
  return {
    activePageId: activePage.id,
    pages,
  }
}

export function isSerializedKonvaBoardDocument(value: unknown): value is SerializedKonvaBoardDocument {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SerializedKonvaBoardDocument>
  return (
    candidate.version === 2 &&
    candidate.renderer === 'konva' &&
    Boolean(candidate.canvasDocument && typeof candidate.canvasDocument === 'object') &&
    Array.isArray(candidate.assets) &&
    (candidate.pages === undefined || Array.isArray(candidate.pages))
  )
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

function withActivePageDocument(
  pages: SerializedKonvaBoardPage[],
  activePageId: string,
  canvasDocument: CanvasDocument,
  now: string
) {
  let didReplace = false
  const nextPages = pages.map((page, index) => {
    if (page.id !== activePageId) return { ...page, index }
    didReplace = true
    return {
      ...page,
      canvasDocument: cloneJsonValue(canvasDocument) as CanvasDocument,
      index,
      title: page.title || canvasDocument.metadata.name || `Page ${index + 1}`,
      updatedAt: canvasDocument.metadata.updatedAt || now,
    }
  })
  if (didReplace) return nextPages
  return [
    ...nextPages,
    createKonvaBoardPage(canvasDocument, {
      id: activePageId,
      index: nextPages.length,
      now,
      title: canvasDocument.metadata.name ?? `Page ${nextPages.length + 1}`,
    }),
  ]
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
  for (const ref of getRuntimeGraphGeneratedOutputRefs(shape.props.data)) {
    rememberAssetRef(assets, ref)
  }
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

function normalizePersistedAssetUrls<T>(value: T, workspaceId?: string): T {
  if (typeof value === 'string') {
    return (persistenceAssetProxyUrl(value, workspaceId) ?? value) as T
  }
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => normalizePersistedAssetUrls(item, workspaceId)) as T
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizePersistedAssetUrls(item, workspaceId)])
  ) as T
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}
