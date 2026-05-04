'use client'

import { useCallback, useRef, useState } from 'react'
import {
  clearBoardSnapshots,
  createBoardSnapshot,
  listBoardSnapshots,
  loadBoardSnapshot,
} from '@/features/boards/localBoardClient'
import type {
  BoardSnapshotReason,
  BoardSnapshotRecord,
  BoardSnapshotSummary,
} from '@/features/boards/boardTypes'
import type { KonvaBoardDocumentSerializationResult } from '@/features/boards/konvaBoardDocument'
import { getDocumentSignature } from '@/components/canvas/boardSaveStatus'

type UseKonvaBoardSnapshotsArgs = {
  boardId: string
  boardTitle: string
  captureThumbnail: () => Promise<string | null>
  mode: 'board' | 'dev'
  onRestoreEnd: () => void
  onRestoreStart: () => void
  onSnapshotRestored: (snapshot: BoardSnapshotRecord) => void
  prepareDocument: () => Promise<KonvaBoardDocumentSerializationResult | undefined>
  restoreDocument: (document: unknown) => void
}

type RecordHistoryOptions = {
  silent?: boolean
  thumbnailUrl?: string | null
}

export function useKonvaBoardSnapshots({
  boardId,
  boardTitle,
  captureThumbnail,
  mode,
  onRestoreEnd,
  onRestoreStart,
  onSnapshotRestored,
  prepareDocument,
  restoreDocument,
}: UseKonvaBoardSnapshotsArgs) {
  const lastSnapshotSignature = useRef<string | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSnapshotRunning, setIsSnapshotRunning] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<BoardSnapshotSummary[]>([])

  const refreshSnapshots = useCallback(async () => {
    if (mode !== 'board') return
    const response = await listBoardSnapshots(boardId)
    setSnapshots(response.snapshots)
  }, [boardId, mode])

  const openHistory = useCallback(() => {
    setIsHistoryOpen(true)
    setSnapshotError(null)
    void refreshSnapshots().catch((error) => {
      setSnapshotError(error instanceof Error ? error.message : 'Board history failed.')
    })
  }, [refreshSnapshots])

  const recordHistory = useCallback(async (
    result: KonvaBoardDocumentSerializationResult | undefined,
    reason: BoardSnapshotReason,
    options: RecordHistoryOptions = {}
  ) => {
    if (mode !== 'board') return
    if (!result?.audit.ok) {
      if (!options.silent) {
        setSnapshotError(result?.audit.issues[0]?.message ?? 'Board document is blocked.')
      }
      return
    }
    const signature = getDocumentSignature(result.document)
    if (reason === 'autosave' && lastSnapshotSignature.current === signature) return
    setIsSnapshotRunning(true)
    setSnapshotError(null)
    try {
      const response = await createBoardSnapshot({
        boardId,
        document: result.document,
        reason,
        thumbnailUrl: options.thumbnailUrl ?? null,
        title: boardTitle,
      })
      const snapshot = response.snapshot
      if (!snapshot) throw new Error('Board history failed.')
      lastSnapshotSignature.current = signature
      if (!options.silent) setSnapshotMessage(`History saved at ${formatTime(snapshot.createdAt)}`)
      await refreshSnapshots()
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : 'Board history failed.')
    } finally {
      setIsSnapshotRunning(false)
    }
  }, [boardId, boardTitle, mode, refreshSnapshots])

  const saveSnapshot = useCallback(async (reason: BoardSnapshotReason) => {
    if (mode !== 'board') return
    const result = await prepareDocument()
    const thumbnailUrl = await captureThumbnail().catch(() => null)
    await recordHistory(result, reason, { thumbnailUrl })
  }, [captureThumbnail, mode, prepareDocument, recordHistory])

  const restoreSnapshot = useCallback(async (snapshotId: string) => {
    if (mode !== 'board') return
    setIsSnapshotRunning(true)
    setSnapshotError(null)
    onRestoreStart()
    try {
      const response = await loadBoardSnapshot(boardId, snapshotId)
      const snapshot = response.snapshot
      if (!snapshot) throw new Error('Board history load failed.')
      restoreDocument(snapshot.document)
      onSnapshotRestored(snapshot)
      setSnapshotMessage(`Restored snapshot from ${formatTime(snapshot.createdAt)}`)
      setIsHistoryOpen(false)
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : 'Board history restore failed.')
    } finally {
      setIsSnapshotRunning(false)
      onRestoreEnd()
    }
  }, [boardId, mode, onRestoreEnd, onRestoreStart, onSnapshotRestored, restoreDocument])

  const clearHistory = useCallback(async () => {
    if (mode !== 'board') return
    setIsSnapshotRunning(true)
    setSnapshotError(null)
    try {
      const response = await clearBoardSnapshots(boardId)
      lastSnapshotSignature.current = null
      setSnapshots([])
      setSnapshotMessage(`Cleared ${response.deletedCount} history entr${response.deletedCount === 1 ? 'y' : 'ies'}`)
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : 'Board history clear failed.')
    } finally {
      setIsSnapshotRunning(false)
    }
  }, [boardId, mode])

  return {
    clearHistory,
    closeHistory: () => setIsHistoryOpen(false),
    isHistoryOpen,
    isSnapshotRunning,
    openHistory,
    recordHistory,
    refreshSnapshots,
    restoreSnapshot,
    saveSnapshot,
    snapshotError,
    snapshotMessage,
    snapshots,
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
