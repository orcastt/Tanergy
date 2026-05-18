'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type Konva from 'konva'
import type { CanvasCamera, CanvasDocument } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type {
  BoardPersistenceRecord,
  BoardPersistenceSummary,
  BoardSnapshotReason,
} from '@/features/boards/boardTypes'
import {
  type KonvaBoardDocumentSerializationOptions,
  type KonvaBoardDocumentSerializationResult,
  type KonvaBoardRestorePayload,
} from '@/features/boards/konvaBoardDocument'
import {
  saveLocalBoardDocument,
  updateLocalBoardMetadata,
  type LocalBoardSaveResponse,
} from '@/features/boards/localBoardClient'
import {
  getDocumentSignature,
  type BoardAction,
  type BoardSaveStatus,
} from '@/components/canvas/boardSaveStatus'
import {
  useBoardAutosaveTimer,
  useBoardBeforeUnloadWarning,
  useBoardKeyboardSaveShortcut,
  useBoardSettingsDirtyTracking,
} from '@/components/canvas/useBoardSaveLifecycle'
import { useKonvaBoardDocumentPreparation } from './useKonvaBoardDocumentPreparation'
import { useKonvaBoardRestoreLifecycle } from './useKonvaBoardRestoreLifecycle'

type SaveLocalOptions = { refreshThumbnail?: boolean }

export type KonvaBoardHistoryRecorder = (
  result: KonvaBoardDocumentSerializationResult | undefined,
  reason: BoardSnapshotReason,
  options?: { silent?: boolean; thumbnailUrl?: string | null },
) => Promise<void>

type UseKonvaBoardPersistenceLifecycleArgs = {
  autoLoad: boolean
  boardId: string
  boardTitle: string
  camera: CanvasCamera
  createIfMissing?: boolean
  document: CanvasDocument
  getPageEnvelope?: (document: CanvasDocument) => KonvaBoardDocumentSerializationOptions
  mode: 'board' | 'dev'
  onBoardLoaded?: (board: BoardPersistenceRecord) => void
  onBoardSaved?: (board: BoardPersistenceSummary) => void
  onDocumentRestore: (restore: KonvaBoardRestorePayload) => void
  pageRevision: number
  recordHistoryRef: MutableRefObject<KonvaBoardHistoryRecorder | null>
  stage: Konva.Stage | null
  workspace?: TangentWorkspace
}

export function useKonvaBoardPersistenceLifecycle({
  autoLoad,
  boardId,
  boardTitle,
  camera,
  createIfMissing = true,
  document,
  getPageEnvelope,
  mode,
  onBoardLoaded,
  onBoardSaved,
  onDocumentRestore,
  pageRevision,
  recordHistoryRef,
  stage,
  workspace,
}: UseKonvaBoardPersistenceLifecycleArgs) {
  const isSaving = useRef(false)
  const dirtyCheckTimer = useRef<number | null>(null)
  const lastSavedSignatureRef = useRef<string | null>(null)
  const suppressedDirtySignatureRef = useRef<string | null>(null)
  const saveNowRef = useRef<((source: 'autosave') => void) | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [lastAction, setLastAction] = useState<BoardAction | null>(null)
  const [result, setResult] = useState<KonvaBoardDocumentSerializationResult | null>(null)
  const [saveResult, setSaveResult] = useState<LocalBoardSaveResponse | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [status, setStatus] = useState<BoardSaveStatus>(mode === 'board' ? 'dirty' : 'idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const { clearAutosaveTimer, scheduleAutosave } = useBoardAutosaveTimer(mode, saveNowRef)

  useBoardBeforeUnloadWarning(mode, status, isSaving, lastAction)

  const {
    captureThumbnail,
    createGuardedDocument,
    getPreparedDocument,
    prepareDocument,
  } = useKonvaBoardDocumentPreparation({
    boardTitle,
    camera,
    document,
    getPageEnvelope,
    onPrepared: setResult,
    stage,
    workspace,
  })

  const refreshThumbnailInBackground = useCallback((currentThumbnailUrl: string | null) => {
    if (mode !== 'board') return
    void captureThumbnail()
      .then((nextThumbnailUrl) => {
        if (!nextThumbnailUrl || nextThumbnailUrl === currentThumbnailUrl) return null
        return updateLocalBoardMetadata({ boardId, thumbnailUrl: nextThumbnailUrl }, workspace)
      })
      .then((response) => {
        if (!response?.board) return
        setSaveResult((current) => current ? { ...current, board: response.board } : current)
      })
      .catch(() => {})
  }, [boardId, captureThumbnail, mode, workspace])

  const {
    finishRestore,
    handleSnapshotRestored,
    isRestoringRef,
    loadLocal,
    restoreDocument,
    startRestore,
  } = useKonvaBoardRestoreLifecycle({
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
  })

  const markDirty = useCallback(() => {
    if (mode !== 'board' || isRestoringRef.current) return
    setStatus((current) => current === 'loading' ? current : 'dirty')
    setSaveError(null)
    if (!isSaving.current) scheduleAutosave()
  }, [isRestoringRef, mode, scheduleAutosave])

  useBoardSettingsDirtyTracking(mode, markDirty)

  const saveLocal = useCallback(async (
    historyReason: BoardSnapshotReason = 'manual_save',
    options: SaveLocalOptions = {},
  ) => {
    if (isSaving.current) return
    clearAutosaveTimer()
    isSaving.current = true
    suppressedDirtySignatureRef.current = null
    setIsRunning(true)
    try {
      setSaveError(null)
      setStatus('saving')
      setLastAction('save')
      const nextResult = await prepareDocument()
      if (!nextResult.audit.ok) {
        setStatus('blocked')
        throw new Error(nextResult.audit.issues[0]?.message ?? 'Board document is blocked.')
      }
      const savedSignature = getDocumentSignature(nextResult.document)
      const currentThumbnailUrl = saveResult?.board?.thumbnailUrl ?? null
      const shouldRefreshThumbnailNow = mode === 'board' && Boolean(options.refreshThumbnail)
      const capturedThumbnailUrl = shouldRefreshThumbnailNow
        ? await captureThumbnail().catch(() => currentThumbnailUrl)
        : currentThumbnailUrl
      const thumbnailUrl = capturedThumbnailUrl ?? currentThumbnailUrl
      const saved = await saveLocalBoardDocument({
        boardId,
        createIfMissing,
        document: nextResult.document,
        thumbnailUrl,
        title: boardTitle,
      }, workspace)
      const savedBoard = saved.board
      if (!savedBoard) throw new Error('Konva board save failed.')
      const currentResult = createGuardedDocument(getPreparedDocument())
      const currentSignature = getDocumentSignature(currentResult.document)
      const hasNewChanges = savedSignature !== currentSignature

      lastSavedSignatureRef.current = savedSignature
      setLastAction('save')
      setSaveResult(saved)
      setLastSavedAt(savedBoard.savedAt)
      setResult(hasNewChanges ? currentResult : nextResult)
      setStatus(hasNewChanges ? 'dirty' : 'saved')
      onBoardSaved?.(savedBoard)

      const historyPromise = recordHistoryRef.current?.(
        nextResult,
        historyReason,
        { silent: historyReason === 'autosave', thumbnailUrl: savedBoard.thumbnailUrl ?? thumbnailUrl },
      )
      void historyPromise?.catch(() => {})

      if (mode === 'board' && !options.refreshThumbnail && !savedBoard.thumbnailUrl) {
        refreshThumbnailInBackground(currentThumbnailUrl)
      }
      if (hasNewChanges) scheduleAutosave()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Konva board save failed.')
      setStatus((current) => current === 'blocked' ? 'blocked' : 'error')
    } finally {
      isSaving.current = false
      setIsRunning(false)
    }
  }, [
    boardId,
    boardTitle,
    captureThumbnail,
    clearAutosaveTimer,
    createIfMissing,
    createGuardedDocument,
    getPreparedDocument,
    mode,
    onBoardSaved,
    prepareDocument,
    recordHistoryRef,
    refreshThumbnailInBackground,
    saveResult,
    scheduleAutosave,
    workspace,
  ])

  useEffect(() => {
    saveNowRef.current = (source) => { void saveLocal(source) }
  }, [saveLocal])

  useBoardKeyboardSaveShortcut(mode, saveLocal)

  const acknowledgeExternalDocument = useCallback((signature: string | null) => {
    clearAutosaveTimer()
    suppressedDirtySignatureRef.current = signature
    setLastAction('load')
    setSaveError(null)
    setStatus((current) => current === 'loading' ? current : 'loaded')
  }, [clearAutosaveTimer])

  useEffect(() => {
    if (dirtyCheckTimer.current !== null) {
      window.clearTimeout(dirtyCheckTimer.current)
      dirtyCheckTimer.current = null
    }
    if (mode !== 'board' || isRestoringRef.current) return
    dirtyCheckTimer.current = window.setTimeout(() => {
      dirtyCheckTimer.current = null
      if (isRestoringRef.current) return
      const nextResult = createGuardedDocument(getPreparedDocument())
      const nextSignature = getDocumentSignature(nextResult.document)
      if (suppressedDirtySignatureRef.current === nextSignature) return
      suppressedDirtySignatureRef.current = null
      if (lastSavedSignatureRef.current !== nextSignature) markDirty()
    }, 420)
  }, [camera, createGuardedDocument, document, getPreparedDocument, isRestoringRef, markDirty, mode, pageRevision])

  useEffect(() => () => {
    if (dirtyCheckTimer.current !== null) window.clearTimeout(dirtyCheckTimer.current)
    clearAutosaveTimer()
  }, [clearAutosaveTimer])

  return {
    acknowledgeExternalDocument,
    captureThumbnail,
    finishRestore,
    handleSnapshotRestored,
    isRunning,
    lastAction,
    lastSavedAt,
    loadLocal,
    prepareDocument,
    result,
    restoreDocument,
    saveError,
    saveLocal,
    saveResult,
    startRestore,
    status,
  }
}
