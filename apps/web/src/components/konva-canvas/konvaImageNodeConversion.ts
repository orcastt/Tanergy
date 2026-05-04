import { withCanvasShapes, type CanvasDocument, type CanvasImageShape, type CanvasNodeShape } from '@/features/canvas-engine'
import { hasRemotePersistenceApi, persistenceApiUrl, persistenceAssetUrl, persistenceAuthHeaders } from '@/features/api/persistenceApi'
import type { TangentAssetRecord, TangentAssetResponse } from '@/features/assets/assetTypes'
import { createDefaultNodeData, createDefaultRuntimeSummary, getNodeDefinition } from '@/features/node-runtime/registry'
import type { JsonObject } from '@/types/nodeRuntime'

const imageNodeWidth = 420
const imageNodeHeight = 260
const nodeGap = 48

export function createKonvaImageNodeFromCanvasImage(document: CanvasDocument, shapeId: string) {
  const image = document.shapes.find((shape): shape is CanvasImageShape => shape.id === shapeId && shape.type === 'image')
  if (!image) return null
  const node = createImageNodeShapeFromImage(image)
  return {
    document: withCanvasShapes(document, [...document.shapes, node]),
    selectedIds: [node.id],
  }
}

export async function createKonvaCanvasImageFromImageNode(document: CanvasDocument, shapeId: string) {
  const node = document.shapes.find((shape): shape is CanvasNodeShape => shape.id === shapeId && shape.type === 'node_card')
  if (!node || node.props.nodeType !== 'image') return null
  const asset = await readImageNodeAsset(node)
  if (!asset) return null
  const image = createImageShapeFromNode(node, asset)
  if (!image) return null
  return {
    document: withCanvasShapes(document, [...document.shapes, image]),
    selectedIds: [image.id],
  }
}

export function canCreateImageNodeFromSelection(document: CanvasDocument, selectedIds: string[]) {
  return selectedIds.length === 1 && document.shapes.some((shape) => (
    shape.id === selectedIds[0] &&
    shape.type === 'image' &&
    !shape.props.assetId.startsWith('remote-')
  ))
}

export function canCreateCanvasImageFromSelection(document: CanvasDocument, selectedIds: string[]) {
  return selectedIds.length === 1 && document.shapes.some((shape) => (
    shape.id === selectedIds[0] &&
    shape.type === 'node_card' &&
    shape.props.nodeType === 'image' &&
    typeof shape.props.data.assetId === 'string'
  ))
}

function createImageNodeShapeFromImage(image: CanvasImageShape): CanvasNodeShape {
  const definition = getNodeDefinition('image')
  const data = pruneUndefined({
    ...createDefaultNodeData('image'),
    assetId: image.props.assetId,
    imageHeight: image.props.height,
    imageWidth: image.props.width,
    source: 'editor_export',
    title: image.props.title ?? image.props.alt ?? image.props.assetId,
  })
  return {
    id: createKonvaNodeId('image-node'),
    props: {
      data,
      height: imageNodeHeight,
      nodeId: createKonvaNodeId('image'),
      nodeType: 'image',
      runtimeSummary: createDefaultRuntimeSummary('image'),
      version: definition.version,
      width: imageNodeWidth,
    },
    type: 'node_card',
    x: image.x + image.props.width + nodeGap,
    y: image.y,
  }
}

function createImageShapeFromNode(node: CanvasNodeShape, asset: TangentAssetRecord): CanvasImageShape | null {
  const assetId = getStringValue(node.props.data.assetId)
  if (!assetId) return null
  const size = fitCanvasImageSize(
    getNumberValue(node.props.data.imageWidth) ?? asset.width,
    getNumberValue(node.props.data.imageHeight) ?? asset.height
  )
  return {
    id: createKonvaNodeId('image'),
    props: {
      assetId,
      height: size.height,
      mime: asset.mime,
      originalUrl: asset.originalUrl,
      thumbnail1024Url: asset.thumbnail1024Url,
      thumbnail256Url: asset.thumbnail256Url,
      thumbnail512Url: asset.thumbnail512Url,
      title: getStringValue(node.props.data.title) ?? asset.title,
      width: size.width,
    },
    type: 'image',
    x: node.x + node.props.width + nodeGap,
    y: node.y,
  }
}

async function readImageNodeAsset(node: CanvasNodeShape): Promise<TangentAssetRecord | null> {
  const assetId = getStringValue(node.props.data.assetId)
  if (!assetId || assetId.startsWith('remote-')) return null
  try {
    const response = await fetch(
      hasRemotePersistenceApi() ? persistenceApiUrl(`/api/v1/assets/${assetId}`) : `/api/assets/${assetId}`,
      { headers: persistenceAuthHeaders() }
    )
    const payload = await response.json() as TangentAssetResponse
    if (!response.ok || !payload.asset) return null
    return {
      ...payload.asset,
      originalUrl: persistenceAssetUrl(payload.asset.originalUrl) ?? payload.asset.originalUrl,
      thumbnail1024Url: persistenceAssetUrl(payload.asset.thumbnail1024Url),
      thumbnail256Url: persistenceAssetUrl(payload.asset.thumbnail256Url),
      thumbnail512Url: persistenceAssetUrl(payload.asset.thumbnail512Url),
    }
  } catch {
    return null
  }
}

function fitCanvasImageSize(width: number, height: number) {
  const maxEdge = 420
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
  return {
    height: Math.max(24, Math.round(height * scale)),
    width: Math.max(24, Math.round(width * scale)),
  }
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject
}

function createKonvaNodeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
