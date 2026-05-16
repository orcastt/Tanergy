import { createEmptyCanvasDocument } from '@/features/canvas-engine'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import { restoreKonvaBoardDocument } from '@/features/boards/konvaBoardDocument'
import { createSeedShapes } from './konvaSeedShapes'

export function createInitialKonvaSpikeDocument({
  boardTitle,
  initialBoard,
  seedOnMount,
  workspaceId,
}: {
  boardTitle: string
  initialBoard: BoardPersistenceRecord | null
  seedOnMount: boolean
  workspaceId?: string
}) {
  if (initialBoard) {
    try {
      return restoreKonvaBoardDocument(initialBoard.document, {
        workspaceId: initialBoard.workspaceId ?? workspaceId,
      }).document
    } catch {
      // Fall back to an empty document if the shared payload cannot be restored.
    }
  }
  return createEmptyCanvasDocument({
    camera: { x: 120, y: 112, zoom: 1 },
    name: boardTitle,
    shapes: seedOnMount ? createSeedShapes() : [],
  })
}

export function isBoardSavedAtNewer(nextSavedAt: string, currentSavedAt: string | null) {
  const nextTime = Date.parse(nextSavedAt)
  if (Number.isNaN(nextTime)) return false
  if (!currentSavedAt) return true
  const currentTime = Date.parse(currentSavedAt)
  if (Number.isNaN(currentTime)) return true
  return nextTime > currentTime
}

export function createRemoteEditingOwnerMap(
  occupancy: Array<{
    displayName: string
    isSelf: boolean
    kind: 'editing' | 'hover' | 'selection'
    shapeIds: string[]
  }>,
) {
  const owners = new Map<string, string>()
  for (const entry of occupancy) {
    if (entry.kind !== 'editing' || entry.isSelf) continue
    for (const shapeId of entry.shapeIds) {
      if (!owners.has(shapeId)) owners.set(shapeId, entry.displayName)
    }
  }
  return owners
}
