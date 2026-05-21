import * as Y from 'yjs'
import { readKonvaYjsRoomRecord, writeKonvaYjsSnapshot, type KonvaYjsRoomRecord } from './konvaYjsSnapshot'

export function readKonvaYjsRoomRecordSafely(ydoc: Y.Doc): KonvaYjsRoomRecord | null {
  try {
    return readKonvaYjsRoomRecord(ydoc)
  } catch {
    return null
  }
}

export function createCompactKonvaYjsStateUpdate(ydoc: Y.Doc) {
  try {
    const record = readKonvaYjsRoomRecordSafely(ydoc)
    if (!record) return null
    const compactedDoc = new Y.Doc({ gc: true })
    try {
      writeKonvaYjsSnapshot(compactedDoc, record)
      return Y.encodeStateAsUpdate(compactedDoc)
    } finally {
      compactedDoc.destroy()
    }
  } catch {
    return null
  }
}

export function dedupeKonvaPageIds(pageIds: readonly string[]) {
  return [...new Set(pageIds.filter((pageId): pageId is string => typeof pageId === 'string' && pageId.length > 0))]
}
