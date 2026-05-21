import type { BoardCollaborationShapeOccupancy } from '@/features/boards/boardCollaborationTypes'

export function createRemoteShapeLockOwnerMap(
  occupancy: BoardCollaborationShapeOccupancy[],
  activePageId: string | null,
) {
  const owners = new Map<string, string>()
  for (const entry of occupancy) {
    if (entry.isSelf) continue
    if (!isVisibleOnPage(activePageId, entry.activePageId)) continue
    if (entry.kind !== 'editing' && entry.kind !== 'selection') continue
    for (const shapeId of entry.shapeIds) {
      if (!owners.has(shapeId)) owners.set(shapeId, entry.displayName)
    }
  }
  return owners
}

export function hasRemoteShapeLock(
  shapeIds: string[],
  remoteLockedShapeOwnerById: ReadonlyMap<string, string> | null | undefined,
) {
  if (!remoteLockedShapeOwnerById || remoteLockedShapeOwnerById.size === 0) return false
  return shapeIds.some((shapeId) => remoteLockedShapeOwnerById.has(shapeId))
}

function isVisibleOnPage(activePageId: string | null, entryPageId: string | null) {
  if (!activePageId || !entryPageId) return true
  return activePageId === entryPageId
}
