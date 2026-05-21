export const boardAutosaveDelayMs = 1200

export type BoardSaveStatus = 'idle' | 'loading' | 'loaded' | 'dirty' | 'saving' | 'saved' | 'blocked' | 'error'
export type BoardAction = 'audit' | 'load' | 'save'

type StoreChanges = {
  added?: Record<string, unknown>
  removed?: Record<string, unknown>
  updated?: Record<string, unknown>
}

type StoreRecordLike = {
  id?: string
  props?: unknown
  typeName?: string
}

type MigrationSummary = {
  migrated: number
}

export function hasBoardDocumentChange(changes: StoreChanges) {
  const addedOrRemoved = [
    ...Object.values(changes.added ?? {}),
    ...Object.values(changes.removed ?? {}),
  ]
  if (addedOrRemoved.some(isPersistedBoardRecord)) return true

  return Object.values(changes.updated ?? {}).some((record) => {
    const update = normalizeUpdatedRecord(record)
    return update ? isPersistedBoardRecord(update.to) : false
  })
}

export function getDocumentSignature(document: unknown) {
  const stableDocument = document && typeof document === 'object'
    ? { ...(document as Record<string, unknown>), serializedAt: '' }
    : document
  return JSON.stringify(stableDocument)
}

export function shouldWarnBeforeUnload(status: BoardSaveStatus, saving: boolean, lastAction: BoardAction | null) {
  return saving || status === 'dirty' || status === 'saving' || status === 'blocked' || (
    status === 'error' &&
    lastAction === 'save'
  )
}

export function getBoardStatusLabel(status: BoardSaveStatus, lastAction: BoardAction | null) {
  if (status === 'loading') return 'Loading'
  if (status === 'dirty') return 'Unsaved'
  if (status === 'saving') return 'Saving'
  if (status === 'saved') return 'Saved'
  if (status === 'loaded') return lastAction === 'load' ? 'Loaded' : 'Ready'
  if (status === 'blocked') return 'Blocked'
  if (status === 'error') return lastAction === 'load' ? 'Load failed' : 'Save failed'
  return 'Ready'
}

export function getBoardStatusDetail(
  status: BoardSaveStatus,
  lastSavedAt: string | null,
  migration: MigrationSummary | null,
  issuePath?: string
) {
  if (status === 'blocked') return issuePath
  if (lastSavedAt && (status === 'saved' || status === 'loaded')) return formatTime(lastSavedAt)
  if (migration?.migrated) return `${migration.migrated} asset(s) migrated`
  return null
}

function isPersistedBoardRecord(record: unknown) {
  const item = asStoreRecord(record)
  return Boolean(
    item &&
    (item.typeName === 'shape' ||
      item.typeName === 'asset' ||
      item.typeName === 'camera' ||
      item.typeName === 'page')
  )
}

function normalizeUpdatedRecord(record: unknown) {
  return Array.isArray(record) && record.length >= 2
    ? { from: record[0], to: record[1] }
    : null
}

function asStoreRecord(record: unknown): StoreRecordLike | null {
  return record && typeof record === 'object' ? record as StoreRecordLike : null
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
