import type { CanvasRuntimeEdge, CanvasShape } from '@/features/canvas-engine'
import { createDefaultNodeData, createDefaultRuntimeSummary, getDefaultNodeCardSize, getNodeDefinition } from '@/features/node-runtime/registry'
import type { NodeRuntimeSummary } from '@/types/nodeRuntime'
import type { SerializedBoardAsset, SerializedBoardShape } from './boardDocumentSerializer'
import type { SerializedKonvaBoardAsset } from './konvaBoardDocument'
import {
  collectTldrawDrawPoints,
  getNodeType,
  getPoint,
  getPositiveNumber,
  getRichText,
  getString,
  mapColor,
  migrateTldrawStyle,
  sanitizeJsonObject,
  toRecord,
} from './tldrawToKonvaMigrationUtils'

export function migrateTldrawShapeToKonva(shape: SerializedBoardShape, assets: Map<string, SerializedBoardAsset>): CanvasShape | null {
  const props = toRecord(shape.props)
  if (shape.type === 'geo') return migrateGeoShape(shape, props)
  if (shape.type === 'note') return migrateStickyShape(shape, props)
  if (shape.type === 'frame') return migrateFrameShape(shape, props)
  if (shape.type === 'text') return migrateTextShape(shape, props)
  if (shape.type === 'image') return migrateImageShape(shape, props, assets)
  if (shape.type === 'arrow') return migrateArrowShape(shape, props)
  if (shape.type === 'line') return migrateLineShape(shape, props)
  if (shape.type === 'draw') return migrateDrawShape(shape, props)
  if (shape.type === 'node_card') return migrateNodeCardShape(shape, props)
  if (shape.type === 'ai_card') return migrateAiCardPlaceholder(shape, props)
  return migrateUnknownShapePlaceholder(shape)
}

export function migrateRuntimeEdges(edges: unknown[], shapeIds: Set<string>): CanvasRuntimeEdge[] {
  return edges
    .map((edge) => {
      const record = toRecord(edge)
      const sourceShapeId = getString(record.sourceShapeId)
      const targetShapeId = getString(record.targetShapeId)
      const dataType = record.dataType === 'image' || record.dataType === 'text' ? record.dataType : null
      if (!sourceShapeId || !targetShapeId || !dataType || !shapeIds.has(sourceShapeId) || !shapeIds.has(targetShapeId)) return null
      return {
        dataType,
        id: getString(record.id) ?? `edge-${sourceShapeId}-${targetShapeId}-${Date.now()}`,
        sourcePortId: getString(record.sourcePortId) ?? (dataType === 'image' ? 'image_out' : 'text_out'),
        sourceShapeId,
        targetPortId: getString(record.targetPortId) ?? (dataType === 'image' ? 'image_in' : 'text_in'),
        targetShapeId,
      } satisfies CanvasRuntimeEdge
    })
    .filter((edge): edge is CanvasRuntimeEdge => Boolean(edge))
}

export function collectMigratedAssets(sourceAssets: SerializedBoardAsset[], shapes: CanvasShape[]): SerializedKonvaBoardAsset[] {
  const usedAssetIds = new Set(shapes.filter((shape) => shape.type === 'image').map((shape) => shape.props.assetId))
  return sourceAssets
    .filter((asset) => usedAssetIds.has(asset.id))
    .map((asset) => ({
      height: asset.height ?? asset.serverAsset?.height,
      id: asset.id,
      mimeType: asset.mimeType ?? asset.serverAsset?.mime,
      name: asset.name ?? asset.serverAsset?.title,
      sourceUrl: asset.sourceUrl ?? asset.serverAsset?.originalUrl,
      type: 'image' as const,
      width: asset.width ?? asset.serverAsset?.width,
    }))
}

function migrateGeoShape(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape {
  const geo = getString(props.geo)
  const type = geo === 'ellipse' ? 'ellipse' : geo === 'diamond' ? 'diamond' : geo === 'triangle' ? 'triangle' : geo === 'cloud' ? 'cloud' : 'rect'
  return baseShape(shape, {
    props: {
      height: getPositiveNumber(props.h, 120),
      text: getRichText(props),
      width: getPositiveNumber(props.w, 180),
    },
    style: migrateTldrawStyle(props),
    type,
  }) as CanvasShape
}

function migrateStickyShape(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape {
  return baseShape(shape, {
    props: {
      authorName: 'Migrated',
      height: getPositiveNumber(props.h, 180),
      text: getRichText(props),
      width: getPositiveNumber(props.w, 220),
    },
    style: {
      fill: mapColor(getString(props.color), '#fef08a'),
      fillStyle: 'solid',
      stroke: '#eab308',
    },
    type: 'sticky',
  }) as CanvasShape
}

function migrateFrameShape(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape {
  return baseShape(shape, {
    props: {
      height: getPositiveNumber(props.h, 300),
      title: getString(props.name) ?? 'Frame',
      width: getPositiveNumber(props.w, 420),
    },
    type: 'frame',
  }) as CanvasShape
}

function migrateTextShape(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape {
  return baseShape(shape, {
    props: {
      height: getPositiveNumber(props.h, 80),
      text: getRichText(props),
      width: getPositiveNumber(props.w, 280),
    },
    style: migrateTldrawStyle(props),
    type: 'text',
  }) as CanvasShape
}

function migrateImageShape(shape: SerializedBoardShape, props: Record<string, unknown>, assets: Map<string, SerializedBoardAsset>): CanvasShape | null {
  const assetId = getString(props.assetId)
  if (!assetId) return null
  const asset = assets.get(assetId)
  return baseShape(shape, {
    props: {
      assetId,
      height: getPositiveNumber(props.h, asset?.height ?? asset?.serverAsset?.height ?? 240),
      mime: asset?.mimeType ?? asset?.serverAsset?.mime,
      originalUrl: asset?.serverAsset?.originalUrl ?? asset?.sourceUrl,
      title: asset?.serverAsset?.title ?? asset?.name ?? 'Image',
      width: getPositiveNumber(props.w, asset?.width ?? asset?.serverAsset?.width ?? 320),
    },
    type: 'image',
  }) as CanvasShape
}

function migrateArrowShape(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape {
  return baseShape(shape, {
    props: {
      end: getPoint(props.end, null) ?? { x: 120, y: 0 },
      endHead: 'arrow',
      startHead: 'none',
    },
    style: migrateTldrawStyle(props),
    type: 'arrow',
  }) as CanvasShape
}

function migrateLineShape(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape {
  return baseShape(shape, {
    props: {
      end: getPoint(props.end, null) ?? { x: 120, y: 0 },
      endHead: 'none',
      startHead: 'none',
    },
    style: migrateTldrawStyle(props),
    type: 'line',
  }) as CanvasShape
}

function migrateDrawShape(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape | null {
  const points = collectTldrawDrawPoints(props)
  if (points.length < 2) return null
  return baseShape(shape, {
    props: { points },
    style: migrateTldrawStyle(props),
    type: 'stroke',
  }) as CanvasShape
}

function migrateNodeCardShape(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape | null {
  const nodeType = getNodeType(props.nodeType)
  if (!nodeType) return migrateAiCardPlaceholder(shape, props)
  const defaultSize = getDefaultNodeCardSize(nodeType)
  const definition = getNodeDefinition(nodeType)
  return baseShape(shape, {
    props: {
      data: { ...createDefaultNodeData(nodeType), ...sanitizeJsonObject(props.data) },
      height: getPositiveNumber(props.h, defaultSize.height),
      nodeId: getString(props.nodeId) ?? `${nodeType}-${shape.id.slice(-6)}`,
      nodeType,
      runtimeSummary: { ...createDefaultRuntimeSummary(nodeType), ...sanitizeJsonObject(props.runtimeSummary) } as NodeRuntimeSummary,
      version: getPositiveNumber(props.version, definition.version),
      width: getPositiveNumber(props.w, defaultSize.width),
    },
    type: 'node_card',
  }) as CanvasShape
}

function migrateAiCardPlaceholder(shape: SerializedBoardShape, props: Record<string, unknown>): CanvasShape {
  return baseShape(shape, {
    props: {
      height: getPositiveNumber(props.h, 156),
      text: [getString(props.title), getString(props.subtitle), getString(props.detail)].filter(Boolean).join('\n'),
      width: getPositiveNumber(props.w, 270),
    },
    style: { fill: '#f8fafc', fillStyle: 'solid', stroke: '#64748b' },
    type: 'rect',
  }) as CanvasShape
}

function migrateUnknownShapePlaceholder(shape: SerializedBoardShape): CanvasShape {
  return baseShape(shape, {
    props: { height: 96, text: `Unsupported legacy shape: ${shape.type}`, width: 240 },
    style: { fill: '#fff7ed', fillStyle: 'solid', stroke: '#f97316' },
    type: 'rect',
  }) as CanvasShape
}

function baseShape(shape: SerializedBoardShape, input: Pick<CanvasShape, 'props' | 'type'> & { style?: CanvasShape['style'] }) {
  return {
    id: shape.id,
    isLocked: shape.isLocked,
    parentId: shape.parentId ?? null,
    props: input.props,
    rotation: typeof shape.rotation === 'number' ? shape.rotation : undefined,
    style: input.style,
    type: input.type,
    x: Number.isFinite(shape.x) ? shape.x : 0,
    y: Number.isFinite(shape.y) ? shape.y : 0,
  }
}
