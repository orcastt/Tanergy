'use client'

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import {
  loadLocalBoardDocument,
  type LocalBoardSaveResponse,
} from '@/features/boards/localBoardClient'
import type {
  BoardPersistenceRecord,
  BoardSnapshotRecord,
} from '@/features/boards/boardTypes'
import {
  createGuardedKonvaBoardDocument,
  restoreKonvaBoardDocument,
  type KonvaBoardDocumentSerializationResult,
  type KonvaBoardRestorePayload,
} from '@/features/boards/konvaBoardDocument'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { getDocumentSignature, type BoardAction, type BoardSaveStatus } from '@/components/canvas/boardSaveStatus'
import { createLoadedBoardSaveResponse, createRestoredHistorySaveResponse } from '@/components/canvas/boardSaveResults'

type UseKonvaBoardRestoreLifecycleArgs = {
  autoLoad: boolean
  boardId: string
  clearAutosaveTimer: () => void
  createGuardedDocument: (document: Parameters<typeof createGuardedKonvaBoardDocument>[0]) => KonvaBoardDocumentSerializationResult
  getPreparedDocument: () => Parameters<typeof createGuardedKonvaBoardDocument>[0]
  lastSavedSignatureRef: MutableRefObject<string | null>
  onBoardLoaded?: (board: BoardPersistenceRecord) => void
  onDocumentRestore: (restore: KonvaBoardRestorePayload) => void
  scheduleAutosave: () => void
  setIsRunning: Dispatch<SetStateAction<boolean>>
  setLastAction: Dispatch<SetStateAction<BoardAction | null>>
  setLastSavedAt: Dispatch<SetStateAction<string | null>>
  setResult: Dispatch<SetStateAction<KonvaBoardDocumentSerializationResult | null>>
  setSaveError: Dispatch<SetStateAction<string | null>>
  setSaveResult: Dispatch<SetStateAction<LocalBoardSaveResponse | null>>
  setStatus: Dispatch<SetStateAction<BoardSaveStatus>>
  suppressedDirtySignatureRef: MutableRefObject<string | null>
  workspace?: TangentWorkspace
}

export function useKonvaBoardRestoreLifecycle({
  autoLoad,
  boardId,
  clearAutosaveTimer,
  createGuardedDocument,
  getPreparedDocument,
  lastSavedSignatureRef,
  onBoardLoaded,
  onDocumentRestore,
  scheduleAutosave,
  setIsRunning,
  setLastAction,
  setLastSavedAt,
  setResult,
  setSaveError,
  setSaveResult,
  setStatus,
  suppressedDirtySignatureRef,
  workspace,
}: UseKonvaBoardRestoreLifecycleArgs) {
  const autoLoadedBoardId = useRef<string | null>(null)
  const isRestoringRef = useRef(false)

  const startRestore = useCallback(() => {
    clearAutosaveTimer()
    isRestoringRef.current = true
  }, [clearAutosaveTimer])

  const finishRestore = useCallback(() => {
    requestAnimationFrame(() => {
      isRestoringRef.current = false
    })
  }, [])

  const restoreDocument = useCallback((nextDocument: unknown) => {
    const restored = restoreKonvaBoardDocument(nextDocument, { workspaceId: workspace?.id })
    onDocumentRestore(restored)
    return restored.result
  }, [onDocumentRestore, workspace?.id])

  const loadLocal = useCallback(async () => {
    clearAutosaveTimer()
    isRestoringRef.current = true
    suppressedDirtySignatureRef.current = null
    setIsRunning(true)
    try {
      setSaveError(null)
      setStatus('loading')
      setLastAction('load')
      const loaded = await loadLocalBoardDocument(boardId, workspace)
      const board = loaded.board
      if (!board) throw new Error('Konva board load failed.')
      const restored = restoreKonvaBoardDocument(board.document, { workspaceId: board.workspaceId })
      onDocumentRestore(restored)
      onBoardLoaded?.(board)
      const restoredResult = createGuardedKonvaBoardDocument(restored.document, {
        activePageId: restored.activePageId,
        pages: restored.pages,
      })
      lastSavedSignatureRef.current = getDocumentSignature(restoredResult.document)
      setResult(restoredResult)
      setSaveResult(createLoadedBoardSaveResponse(board, restored.result))
      setLastSavedAt(board.savedAt)
      setStatus('loaded')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Konva board load failed.')
      setStatus('error')
    } finally {
      setIsRunning(false)
      requestAnimationFrame(() => {
        isRestoringRef.current = false
      })
    }
  }, [
    boardId,
    clearAutosaveTimer,
    lastSavedSignatureRef,
    onBoardLoaded,
    onDocumentRestore,
    setIsRunning,
    setLastAction,
    setLastSavedAt,
    setResult,
    setSaveError,
    setSaveResult,
    setStatus,
    suppressedDirtySignatureRef,
    workspace,
  ])

  const handleSnapshotRestored = useCallback((snapshot: BoardSnapshotRecord) => {
    const restoredResult = createGuardedDocument(getPreparedDocument())
    suppressedDirtySignatureRef.current = null
    lastSavedSignatureRef.current = null
    setResult(restoredResult)
    setSaveResult(createRestoredHistorySaveResponse(snapshot))
    setLastAction('load')
    setLastSavedAt(null)
    setSaveError(null)
    setStatus('dirty')
    scheduleAutosave()
  }, [
    createGuardedDocument,
    getPreparedDocument,
    lastSavedSignatureRef,
    scheduleAutosave,
    setLastAction,
    setLastSavedAt,
    setResult,
    setSaveError,
    setSaveResult,
    setStatus,
    suppressedDirtySignatureRef,
  ])

  useEffect(() => {
    if (!autoLoad || autoLoadedBoardId.current === boardId) return
    autoLoadedBoardId.current = boardId
    void loadLocal()
  }, [autoLoad, boardId, loadLocal])

  return {
    finishRestore,
    handleSnapshotRestored,
    isRestoringRef,
    loadLocal,
    restoreDocument,
    startRestore,
  }
}
