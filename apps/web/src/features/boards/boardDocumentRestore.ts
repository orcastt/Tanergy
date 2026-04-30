import type { Editor, TLAsset, TLAssetId, TLShapeId } from 'tldraw'
import { setNodeEdgesSnapshot, syncNodeEdgeInputCounts } from '@/features/node-runtime/nodeEdges'
import { auditBoardDocument } from './boardDocumentGuard'
import type { SerializedBoardAsset, SerializedBoardDocument, SerializedBoardShape } from './boardDocumentSerializer'

type RestoreResult = {
  assetCount: number
  edgeCount: number
  shapeCount: number
}

type CreateShapesInput = Parameters<Editor['createShapes']>[0]

export function restoreBoardDocument(editor: Editor, document: unknown): RestoreResult {
  if (!isSerializedBoardDocument(document)) throw new Error('Local board document is not restorable.')
  const audit = auditBoardDocument(document)
  if (!audit.ok) throw new Error(audit.issues.find((issue) => issue.blocking)?.message ?? 'Board document is blocked.')

  const currentShapes = editor.getCurrentPageShapes().map((shape) => shape.id)
  if (currentShapes.length > 0) editor.deleteShapes(currentShapes)
  const currentAssets = editor.getAssets().map((asset) => asset.id)
  if (currentAssets.length > 0) editor.deleteAssets(currentAssets)

  const assets = document.assets.map(createTldrawAsset).filter(Boolean) as TLAsset[]
  if (assets.length > 0) editor.createAssets(assets)

  const shapes = document.shapes.map(createTldrawShape) as CreateShapesInput
  if (shapes.length > 0) editor.createShapes(shapes)

  setNodeEdgesSnapshot(document.runtimeEdges)
  syncNodeEdgeInputCounts(editor)
  editor.setCamera(document.camera)

  return {
    assetCount: assets.length,
    edgeCount: document.runtimeEdges.length,
    shapeCount: shapes.length,
  }
}

function createTldrawAsset(asset: SerializedBoardAsset): TLAsset | null {
  if (asset.type !== 'image') return null
  return {
    id: asset.id as TLAssetId,
    meta: asset.serverAsset ? { tangentAsset: asset.serverAsset } : {},
    props: {
      h: asset.height ?? asset.serverAsset?.height ?? 0,
      isAnimated: false,
      mimeType: asset.mimeType ?? asset.serverAsset?.mime ?? null,
      name: asset.name ?? asset.serverAsset?.title ?? 'Image',
      src: asset.sourceUrl ?? asset.serverAsset?.originalUrl ?? null,
      w: asset.width ?? asset.serverAsset?.width ?? 0,
    },
    type: 'image',
    typeName: 'asset',
  }
}

function createTldrawShape(shape: SerializedBoardShape): CreateShapesInput[number] {
  return {
    id: shape.id as TLShapeId,
    index: shape.index,
    isLocked: shape.isLocked,
    opacity: shape.opacity,
    parentId: shape.parentId,
    props: shape.props,
    rotation: shape.rotation,
    type: shape.type,
    x: shape.x,
    y: shape.y,
  } as CreateShapesInput[number]
}

function isSerializedBoardDocument(value: unknown): value is SerializedBoardDocument {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'version' in value &&
    value.version === 1 &&
    'assets' in value &&
    Array.isArray(value.assets) &&
    'shapes' in value &&
    Array.isArray(value.shapes) &&
    'runtimeEdges' in value &&
    Array.isArray(value.runtimeEdges) &&
    'camera' in value &&
    value.camera &&
    typeof value.camera === 'object'
  )
}
