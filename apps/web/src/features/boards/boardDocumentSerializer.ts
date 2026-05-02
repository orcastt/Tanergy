import type { Editor } from 'tldraw'
import type { TangentAssetRecord } from '@/features/assets/assetTypes'
import { getSerializableCanvasSettings, type CanvasSettings } from '@/features/canvas-settings/canvasSettingsStore'
import { getNodeEdgesSnapshot, type NodeRuntimeEdge } from '@/features/node-runtime/nodeEdges'
import { auditBoardDocument, type BoardDocumentGuardResult } from './boardDocumentGuard'

export type SerializedBoardDocument = {
  assets: SerializedBoardAsset[]
  camera: { x: number; y: number; z: number }
  canvasSettings?: CanvasSettings
  pageId: string
  runtimeEdges: NodeRuntimeEdge[]
  serializedAt: string
  shapes: SerializedBoardShape[]
  version: 1
  viewport: { h: number; w: number; x: number; y: number }
}

export type SerializedBoardShape = {
  id: string
  index?: string
  isLocked?: boolean
  opacity?: number
  parentId?: string
  props: unknown
  rotation?: number
  type: string
  x: number
  y: number
}

export type SerializedBoardAsset = {
  height?: number
  id: string
  mimeType?: string
  name?: string
  serverAsset?: TangentAssetRecord
  sourceUrl?: string
  type: string
  width?: number
}

export type BoardDocumentSerializationResult = {
  audit: BoardDocumentGuardResult
  document: SerializedBoardDocument
}

type EditorShapeRecord = SerializedBoardShape & {
  props?: unknown
}

type EditorAssetRecord = {
  id: string
  meta?: { tangentAsset?: TangentAssetRecord }
  props?: {
    h?: number
    mimeType?: string
    name?: string
    src?: string
    w?: number
  }
  type: string
}

export function serializeBoardDocument(editor: Editor): SerializedBoardDocument {
  const camera = editor.getCamera()
  const viewport = editor.getViewportPageBounds()
  return {
    assets: editor.getAssets().map((asset) => serializeAsset(asset as EditorAssetRecord)),
    camera: { x: camera.x, y: camera.y, z: camera.z },
    canvasSettings: getSerializableCanvasSettings(),
    pageId: String(editor.getCurrentPageId()),
    runtimeEdges: getNodeEdgesSnapshot(),
    serializedAt: new Date().toISOString(),
    shapes: editor.getCurrentPageShapesSorted().map((shape) => serializeShape(shape as EditorShapeRecord)),
    version: 1,
    viewport: {
      h: viewport.height,
      w: viewport.width,
      x: viewport.x,
      y: viewport.y,
    },
  }
}

export function createGuardedBoardDocument(editor: Editor): BoardDocumentSerializationResult {
  const document = serializeBoardDocument(editor)
  return {
    audit: auditBoardDocument(document),
    document,
  }
}

function serializeShape(shape: EditorShapeRecord): SerializedBoardShape {
  return {
    id: String(shape.id),
    ...(shape.index ? { index: String(shape.index) } : {}),
    ...(typeof shape.isLocked === 'boolean' ? { isLocked: shape.isLocked } : {}),
    ...(typeof shape.opacity === 'number' ? { opacity: shape.opacity } : {}),
    ...(shape.parentId ? { parentId: String(shape.parentId) } : {}),
    props: cloneJsonValue(shape.props ?? {}),
    ...(typeof shape.rotation === 'number' ? { rotation: shape.rotation } : {}),
    type: String(shape.type),
    x: Number(shape.x) || 0,
    y: Number(shape.y) || 0,
  }
}

function serializeAsset(asset: EditorAssetRecord): SerializedBoardAsset {
  return {
    height: asset.props?.h,
    id: String(asset.id),
    mimeType: asset.props?.mimeType,
    name: asset.props?.name,
    serverAsset: asset.meta?.tangentAsset,
    sourceUrl: asset.props?.src,
    type: String(asset.type),
    width: asset.props?.w,
  }
}

function cloneJsonValue(value: unknown) {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value)) as unknown
}
