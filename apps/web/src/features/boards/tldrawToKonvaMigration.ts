import type { CanvasCamera, CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import { createEmptyCanvasDocument } from '@/features/canvas-engine'
import type { SerializedBoardDocument } from './boardDocumentSerializer'
import type { SerializedKonvaBoardDocument } from './konvaBoardDocument'
import { createKonvaBoardPage } from './konvaBoardPageContract'
import {
  collectMigratedAssets,
  migrateRuntimeEdges,
  migrateTldrawShapeToKonva,
} from './tldrawToKonvaShapeMigration'

export type TldrawToKonvaMigrationResult = {
  document: SerializedKonvaBoardDocument
  migratedShapeCount: number
  skippedShapeCount: number
}

export function migrateTldrawV1BoardToKonvaV2(
  source: unknown,
  options: { boardId?: string; title?: string } = {}
): TldrawToKonvaMigrationResult {
  if (!isSerializedTldrawBoardDocument(source)) throw new Error('Only serialized tldraw v1 Boards can be copied to Konva v2.')
  const assetMap = new Map(source.assets.map((asset) => [asset.id, asset]))
  const shapes: CanvasShape[] = []
  let skippedShapeCount = 0

  for (const shape of source.shapes) {
    const migrated = migrateTldrawShapeToKonva(shape, assetMap)
    if (migrated) shapes.push(migrated)
    else skippedShapeCount += 1
  }

  const canvasDocument = createEmptyCanvasDocument({
    camera: migrateCamera(source.camera),
    id: `canvas-document-${options.boardId ?? source.pageId ?? Date.now()}`,
    name: options.title ?? 'Migrated Board',
    now: source.serializedAt,
    shapes,
  })
  const runtimeEdges = migrateRuntimeEdges(source.runtimeEdges, new Set(shapes.map((shape) => shape.id)))
  const migratedCanvasDocument: CanvasDocument = { ...canvasDocument, runtimeEdges }
  const serializedAt = new Date().toISOString()
  const page = createKonvaBoardPage(migratedCanvasDocument, {
    id: source.pageId || 'page-1',
    now: serializedAt,
    title: options.title ?? 'Migrated Board',
  })

  return {
    document: {
      activePageId: page.id,
      assets: collectMigratedAssets(source.assets, shapes),
      canvasDocument: migratedCanvasDocument,
      canvasSettings: source.canvasSettings,
      pages: [page],
      renderer: 'konva',
      serializedAt,
      version: 2,
    },
    migratedShapeCount: shapes.length,
    skippedShapeCount,
  }
}

function migrateCamera(camera: SerializedBoardDocument['camera']): Partial<CanvasCamera> {
  return {
    x: Number.isFinite(camera.x) ? camera.x : 0,
    y: Number.isFinite(camera.y) ? camera.y : 0,
    zoom: Number.isFinite(camera.z) && camera.z > 0 ? camera.z : 1,
  }
}

function isSerializedTldrawBoardDocument(value: unknown): value is SerializedBoardDocument {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SerializedBoardDocument>
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.assets) &&
    Array.isArray(candidate.shapes) &&
    Array.isArray(candidate.runtimeEdges) &&
    Boolean(candidate.camera && typeof candidate.camera === 'object')
  )
}
