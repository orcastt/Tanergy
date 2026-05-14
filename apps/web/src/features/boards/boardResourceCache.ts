'use client'

import { normalizeBoardThumbnailUrl, type BoardPersistenceRecord, type BoardPersistenceSummary } from './boardTypes'
import { loadClientResource, primeClientResource, readClientResource } from '@/features/shared/clientResourceCache'

const boardListTtlMs = 45_000
const boardRecordTtlMs = 300_000
const boardListMaxEntries = 12
const boardRecordMaxEntries = 6

type CacheEntry<T> = {
  data?: T
  error?: string | null
  promise?: Promise<T>
  updatedAt: number
}

type LoadOptions = {
  force?: boolean
}

const boardListStore = new Map<string, CacheEntry<BoardPersistenceSummary[]>>()
const boardRecordStore = new Map<string, CacheEntry<BoardPersistenceRecord>>()

export function readCachedBoardList(workspaceId?: string) {
  const key = boardListKey(workspaceId)
  const snapshot = readClientResource(boardListStore, key, {
    maxEntries: boardListMaxEntries,
    storage: 'session',
    storageKey: boardListStorageKey(key),
    storagePrefix: 'tanergy.board-list.',
    ttlMs: boardListTtlMs,
  })
  return snapshot.status === 'ready' ? filterSupportedBoardSummaries(snapshot.data ?? []) : null
}

export function readCachedBoardRecord(boardId: string, workspaceId?: string) {
  const key = boardRecordKey(boardId, workspaceId)
  discardPersistedBoardRecord(key)
  const snapshot = readClientResource(boardRecordStore, key, {
    maxEntries: boardRecordMaxEntries,
    ttlMs: boardRecordTtlMs,
  })
  return snapshot.status === 'ready' ? snapshot.data ?? null : null
}

export function primeBoardListResource(workspaceId: string | undefined, boards: BoardPersistenceSummary[]) {
  const key = boardListKey(workspaceId)
  primeClientResource(boardListStore, key, filterSupportedBoardSummaries(boards).map(sanitizeBoardSummaryForCache), {
    maxEntries: boardListMaxEntries,
    storage: 'session',
    storageKey: boardListStorageKey(key),
    storagePrefix: 'tanergy.board-list.',
    ttlMs: boardListTtlMs,
  })
}

export function primeBoardRecordResource(board: BoardPersistenceRecord, workspaceId: string | undefined = board.workspaceId) {
  const key = boardRecordKey(board.id, workspaceId)
  discardPersistedBoardRecord(key)
  primeClientResource(boardRecordStore, key, board, {
    maxEntries: boardRecordMaxEntries,
    ttlMs: boardRecordTtlMs,
  })
}

export function loadCachedBoardListResource(
  workspaceId: string | undefined,
  loader: () => Promise<BoardPersistenceSummary[]>,
  options: LoadOptions = {},
) {
  const key = boardListKey(workspaceId)
  return loadClientResource(boardListStore, key, async () => (
    filterSupportedBoardSummaries(await loader()).map(sanitizeBoardSummaryForCache)
  ), {
    force: options.force,
    maxEntries: boardListMaxEntries,
    storage: 'session',
    storageKey: boardListStorageKey(key),
    storagePrefix: 'tanergy.board-list.',
    ttlMs: boardListTtlMs,
  })
}

export function loadCachedBoardRecordResource(
  boardId: string,
  workspaceId: string | undefined,
  loader: () => Promise<BoardPersistenceRecord>,
  options: LoadOptions = {},
) {
  const key = boardRecordKey(boardId, workspaceId)
  discardPersistedBoardRecord(key)
  return loadClientResource(boardRecordStore, key, loader, {
    force: options.force,
    maxEntries: boardRecordMaxEntries,
    ttlMs: boardRecordTtlMs,
  })
}

export function upsertBoardSummaryInCaches(board: BoardPersistenceSummary, workspaceId: string | undefined = board.workspaceId) {
  const nextWorkspaceId = workspaceId ?? board.workspaceId
  if (!isSupportedBoardSummary(board)) {
    removeBoardFromCaches(board.id, nextWorkspaceId)
    return
  }
  const currentList = readCachedBoardList(nextWorkspaceId)
  primeBoardListResource(
    nextWorkspaceId,
    sortBoardSummaries([
      board,
      ...(currentList ?? []).filter((item) => item.id !== board.id),
    ]),
  )

  const currentRecord = readCachedBoardRecord(board.id, nextWorkspaceId)
  if (currentRecord) {
    primeBoardRecordResource(
      {
        ...currentRecord,
        ...board,
        workspaceId: board.workspaceId,
      },
      nextWorkspaceId,
    )
  }
}

export function removeBoardFromCaches(boardId: string, workspaceId?: string) {
  const nextWorkspaceId = workspaceId
  const currentList = readCachedBoardList(nextWorkspaceId)
  if (currentList) {
    primeBoardListResource(
      nextWorkspaceId,
      currentList.filter((item) => item.id !== boardId),
    )
  }
  clearBoardRecordResource(boardId, nextWorkspaceId)
}

export function clearBoardRecordResource(boardId: string, workspaceId?: string) {
  const key = boardRecordKey(boardId, workspaceId)
  boardRecordStore.delete(key)
  discardPersistedBoardRecord(key)
}

export function clearCachedBoardResources() {
  boardListStore.clear()
  boardRecordStore.clear()
  if (typeof window === 'undefined') return
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index)
    if (!key?.startsWith('tanergy.board-')) continue
    window.sessionStorage.removeItem(key)
  }
}

function sortBoardSummaries(boards: BoardPersistenceSummary[]) {
  return [...boards].sort((left, right) => (
    new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()
  ))
}

function sanitizeBoardSummaryForCache(board: BoardPersistenceSummary): BoardPersistenceSummary {
  return {
    ...board,
    thumbnailUrl: normalizeBoardThumbnailUrl(board.thumbnailUrl),
  }
}

function filterSupportedBoardSummaries(boards: BoardPersistenceSummary[]) {
  return boards.filter(isSupportedBoardSummary)
}

function isSupportedBoardSummary(board: BoardPersistenceSummary) {
  return board.canvasEngine === 'konva'
}

function boardListKey(workspaceId?: string) {
  return workspaceId?.trim() || 'current'
}

function boardRecordKey(boardId: string, workspaceId?: string) {
  return `${boardListKey(workspaceId)}:${boardId}`
}

function boardListStorageKey(key: string) {
  return `tanergy.board-list.${key}`
}

function boardRecordStorageKey(key: string) {
  return `tanergy.board-record.${key}`
}

function discardPersistedBoardRecord(key: string) {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(boardRecordStorageKey(key))
}
