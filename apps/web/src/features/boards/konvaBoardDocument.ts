import { getSerializableCanvasSettings, defaultCanvasSettings, useCanvasSettingsStore, type CanvasSettings } from '@/features/canvas-settings/canvasSettingsStore'
import type { CanvasDocument, CanvasImageShape, CanvasNodeShape } from '@/features/canvas-engine'
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

export type KonvaBoardRestoreResult = {
  assetCount: number
  edgeCount: number
  pageCount: number
  shapeCount: number
}

export function serializeKonvaBoardDocument(document: CanvasDocument): SerializedKonvaBoardDocument {
  const canvasDocument = cloneJsonValue(document) as CanvasDocument
  const serializedAt = new Date().toISOString()
  const pages = [
    createKonvaBoardPage(canvasDocument, {
      id: defaultKonvaBoardPageId,
      now: serializedAt,
      title: canvasDocument.metadata.name ?? 'Page 1',
    }),
  ]
  return {
    activePageId: defaultKonvaBoardPageId,
    assets: collectKonvaBoardAssets([canvasDocument]),
    canvasDocument,
    canvasSettings: getSerializableCanvasSettings(),
    pages,
    renderer: 'konva',
    serializedAt,
    version: 2,
  }
}

export function createGuardedKonvaBoardDocument(document: CanvasDocument): KonvaBoardDocumentSerializationResult {
  const serialized = serializeKonvaBoardDocument(document)
  return {
    audit: auditBoardDocument(serialized),
    document: serialized,
  }
}

export function restoreKonvaBoardDocument(document: unknown): { document: CanvasDocument; result: KonvaBoardRestoreResult } {
  if (!isSerializedKonvaBoardDocument(document)) throw new Error('Konva board document is not restorable.')
  const audit = auditBoardDocument(document)
  if (!audit.ok) throw new Error(audit.issues.find((issue) => issue.blocking)?.message ?? 'Board document is blocked.')

  useCanvasSettingsStore.getState().replace(document.canvasSettings ?? defaultCanvasSettings)
  const pages = normalizeKonvaBoardPages(document)
  const activePage = getActiveKonvaBoardPage(document)
  const canvasDocument = cloneJsonValue(activePage.canvasDocument) as CanvasDocument
  return {
    document: canvasDocument,
    result: {
      assetCount: document.assets.length,
      edgeCount: canvasDocument.runtimeEdges.length,
      pageCount: pages.length,
      shapeCount: canvasDocument.shapes.length,
    },
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

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}
