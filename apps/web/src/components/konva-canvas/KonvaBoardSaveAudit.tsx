'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type Konva from 'konva'
import type { CanvasCamera, CanvasDocument } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  loadLocalBoardDocument,
  saveLocalBoardDocument,
  updateLocalBoardMetadata,
  type LocalBoardSaveResponse,
} from '@/features/boards/localBoardClient'
import type { BoardPersistenceRecord, BoardPersistenceSummary, BoardSnapshotReason, BoardSnapshotRecord } from '@/features/boards/boardTypes'
import {
  createGuardedKonvaBoardDocument,
  restoreKonvaBoardDocument,
  type KonvaBoardDocumentSerializationOptions,
  type KonvaBoardDocumentSerializationResult,
  type KonvaBoardRestorePayload,
} from '@/features/boards/konvaBoardDocument'
import {
  getDocumentSignature,
  type BoardAction,
  type BoardSaveStatus,
} from '@/components/canvas/boardSaveStatus'
import { createLoadedBoardSaveResponse, createRestoredHistorySaveResponse } from '@/components/canvas/boardSaveResults'
import { CanvasBoardModeControls } from '@/components/canvas/CanvasBoardModeControls'
import { DevBoardSaveControls } from '@/components/canvas/CanvasBoardSaveControls'
import {
  useBoardAutosaveTimer,
  useBoardBeforeUnloadWarning,
  useBoardKeyboardSaveShortcut,
  useBoardSettingsDirtyTracking,
} from '@/components/canvas/useBoardSaveLifecycle'
import { captureKonvaBoardThumbnailUrl } from './konvaBoardThumbnailCapture'
import { useKonvaBoardSnapshots } from './useKonvaBoardSnapshots'

type KonvaBoardSaveAuditProps = {
  activePageId?: string
  autoLoad?: boolean
  boardId?: string
  boardTitle?: string
  camera: CanvasCamera
  document: CanvasDocument
  mode?: 'board' | 'dev'
  onBoardLoaded?: (board: BoardPersistenceRecord) => void
  onBoardSaved?: (board: BoardPersistenceSummary) => void
  onDocumentRestore: (restore: KonvaBoardRestorePayload) => void
  stage: Konva.Stage | null
  getPageEnvelope?: (document: CanvasDocument) => KonvaBoardDocumentSerializationOptions
  historyTitle?: string
  pageRevision?: number
  workspace?: TangentWorkspace
}

const defaultBoardId = 'konva-spike-local'
const defaultBoardTitle = 'Konva Spike Local'
type SaveLocalOptions = { refreshThumbnail?: boolean }
export type KonvaBoardSaveAuditHandle = {
  acknowledgeExternalDocument: (signature: string | null) => void
}

export const KonvaBoardSaveAudit = forwardRef<KonvaBoardSaveAuditHandle, KonvaBoardSaveAuditProps>(function KonvaBoardSaveAudit({
  activePageId,
  autoLoad = false,
  boardId = defaultBoardId,
  boardTitle = defaultBoardTitle,
  camera,
  document,
  getPageEnvelope,
  historyTitle,
  mode = 'dev',
  onBoardLoaded,
  onBoardSaved,
  onDocumentRestore,
  pageRevision = 0,
  stage,
  workspace,
}, ref) {
  const autoLoadedBoardId = useRef<string | null>(null)
  const isRestoring = useRef(false)
  const isSaving = useRef(false)
  const dirtyCheckTimer = useRef<number | null>(null)
  const lastSavedSignature = useRef<string | null>(null)
  const suppressedDirtySignatureRef = useRef<string | null>(null)
  const recordHistoryRef = useRef<((result: KonvaBoardDocumentSerializationResult | undefined, reason: BoardSnapshotReason, options?: { silent?: boolean; thumbnailUrl?: string | null }) => Promise<void>) | null>(null)
  const saveNowRef = useRef<((source: 'autosave') => void) | null>(null)
  const latestCameraRef = useRef(camera)
  const latestDocumentRef = useRef(document)
  const latestStageRef = useRef(stage)
  const [isRunning, setIsRunning] = useState(false)
  const [lastAction, setLastAction] = useState<BoardAction | null>(null)
  const [result, setResult] = useState<KonvaBoardDocumentSerializationResult | null>(null)
  const [saveResult, setSaveResult] = useState<LocalBoardSaveResponse | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [status, setStatus] = useState<BoardSaveStatus>(mode === 'board' ? 'dirty' : 'idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const { clearAutosaveTimer, scheduleAutosave } = useBoardAutosaveTimer(mode, saveNowRef)
  useBoardBeforeUnloadWarning(mode, status, isSaving, lastAction)

  useImperativeHandle(ref, () => ({
    acknowledgeExternalDocument(signature) {
      clearAutosaveTimer()
      suppressedDirtySignatureRef.current = signature
      setLastAction('load')
      setSaveError(null)
      setStatus((current) => current === 'loading' ? current : 'loaded')
    },
  }), [clearAutosaveTimer])

  useEffect(() => {
    latestCameraRef.current = camera
    latestDocumentRef.current = document
    latestStageRef.current = stage
  }, [camera, document, stage])

  const getPreparedDocument = useCallback(() => ({
    ...latestDocumentRef.current,
    camera: latestCameraRef.current,
  }), [])

  const createGuardedDocument = useCallback((nextDocument: CanvasDocument) => (
    createGuardedKonvaBoardDocument(nextDocument, getPageEnvelope?.(nextDocument))
  ), [getPageEnvelope])

  const prepareDocument = useCallback(async () => {
    const nextResult = createGuardedDocument(getPreparedDocument())
    setResult(nextResult)
    return nextResult
  }, [createGuardedDocument, getPreparedDocument])

  const captureThumbnail = useCallback(async () => {
    const currentStage = latestStageRef.current
    if (!currentStage) return null
    return captureKonvaBoardThumbnailUrl(currentStage, getPreparedDocument(), boardTitle, workspace)
  }, [boardTitle, getPreparedDocument, workspace])

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

  const markDirty = useCallback(() => {
    if (mode !== 'board' || isRestoring.current) return
    setStatus((current) => current === 'loading' ? current : 'dirty')
    setSaveError(null)
    if (!isSaving.current) scheduleAutosave()
  }, [mode, scheduleAutosave])
  useBoardSettingsDirtyTracking(mode, markDirty)

  const saveLocal = useCallback(async (historyReason: BoardSnapshotReason = 'manual_save', options: SaveLocalOptions = {}) => {
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
        document: nextResult.document,
        thumbnailUrl,
        title: boardTitle,
      }, workspace)
      const savedBoard = saved.board
      if (!savedBoard) throw new Error('Konva board save failed.')
      const currentResult = createGuardedDocument(getPreparedDocument())
      const currentSignature = getDocumentSignature(currentResult.document)
      const hasNewChanges = savedSignature !== currentSignature

      lastSavedSignature.current = savedSignature
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
  }, [boardId, boardTitle, captureThumbnail, clearAutosaveTimer, createGuardedDocument, getPreparedDocument, mode, onBoardSaved, prepareDocument, refreshThumbnailInBackground, saveResult, scheduleAutosave, workspace])

  useEffect(() => {
    saveNowRef.current = (source) => void saveLocal(source)
  }, [saveLocal])

  useBoardKeyboardSaveShortcut(mode, saveLocal)

  const restoreDocument = useCallback((nextDocument: unknown) => {
    const restored = restoreKonvaBoardDocument(nextDocument, { workspaceId: workspace?.id })
    onDocumentRestore(restored)
    return restored.result
  }, [onDocumentRestore, workspace?.id])

  const loadLocal = useCallback(async () => {
    clearAutosaveTimer()
    isRestoring.current = true
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
      lastSavedSignature.current = getDocumentSignature(restoredResult.document)
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
        isRestoring.current = false
      })
    }
  }, [boardId, clearAutosaveTimer, onBoardLoaded, onDocumentRestore, workspace])

  const handleSnapshotRestored = useCallback((snapshot: BoardSnapshotRecord) => {
    const restoredResult = createGuardedDocument(getPreparedDocument())
    suppressedDirtySignatureRef.current = null
    lastSavedSignature.current = null
    setResult(restoredResult)
    setSaveResult(createRestoredHistorySaveResponse(snapshot))
    setLastAction('load')
    setLastSavedAt(null)
    setSaveError(null)
    setStatus('dirty')
    scheduleAutosave()
  }, [createGuardedDocument, getPreparedDocument, scheduleAutosave])

  const snapshots = useKonvaBoardSnapshots({
    boardId,
    boardTitle: historyTitle?.trim() || boardTitle,
    captureThumbnail,
    mode,
    onRestoreEnd: () => requestAnimationFrame(() => { isRestoring.current = false }),
    onRestoreStart: () => {
      clearAutosaveTimer()
      isRestoring.current = true
    },
    onSnapshotRestored: handleSnapshotRestored,
    prepareDocument,
    restoreDocument: (nextDocument) => { restoreDocument(nextDocument) },
    workspace,
  })

  useEffect(() => {
    recordHistoryRef.current = snapshots.recordHistory
    return () => {
      recordHistoryRef.current = null
    }
  }, [snapshots.recordHistory])

  useEffect(() => {
    if (!autoLoad || autoLoadedBoardId.current === boardId) return
    autoLoadedBoardId.current = boardId
    void loadLocal()
  }, [autoLoad, boardId, loadLocal])

  useEffect(() => {
    if (dirtyCheckTimer.current !== null) {
      window.clearTimeout(dirtyCheckTimer.current)
      dirtyCheckTimer.current = null
    }
    if (mode !== 'board' || isRestoring.current) return
    dirtyCheckTimer.current = window.setTimeout(() => {
      dirtyCheckTimer.current = null
      if (isRestoring.current) return
      const nextResult = createGuardedDocument(getPreparedDocument())
      const nextSignature = getDocumentSignature(nextResult.document)
      if (suppressedDirtySignatureRef.current === nextSignature) return
      suppressedDirtySignatureRef.current = null
      if (lastSavedSignature.current !== nextSignature) markDirty()
    }, 420)
  }, [camera, createGuardedDocument, document, getPreparedDocument, markDirty, mode, pageRevision])

  useEffect(() => () => {
    if (dirtyCheckTimer.current !== null) window.clearTimeout(dirtyCheckTimer.current)
    clearAutosaveTimer()
  }, [clearAutosaveTimer])

  const issue = result?.audit.issues.find((item) => item.blocking)
  const auditStatus = !result
    ? 'Not checked'
    : saveResult?.board
      ? `${lastAction === 'load' ? 'Loaded' : 'Saved'} ${saveResult.board.byteSize} bytes`
      : result.audit.ok
        ? `${result.audit.byteSize} bytes`
        : issue?.code ?? 'Blocked'
  const detail = saveError ?? issue?.path

  if (mode === 'board') {
    return (
      <CanvasBoardModeControls
        editorAvailable={Boolean(stage)}
        isRunning={isRunning || snapshots.isSnapshotRunning}
        activePageId={activePageId}
        activePageTitle={historyTitle}
        issueMessage={issue?.message}
        issuePath={issue?.path}
        lastAction={lastAction}
        lastSavedAt={lastSavedAt}
        migration={null}
        onHistory={snapshots.openHistory}
        onLoad={() => void loadLocal()}
        onRefreshPreview={() => void saveLocal('manual_save', { refreshThumbnail: true })}
        onSave={() => void saveLocal('manual_save')}
        onSnapshot={() => void snapshots.saveSnapshot('manual')}
        saveError={saveError ?? snapshots.snapshotError}
        snapshotMessage={snapshots.snapshotMessage}
        snapshots={snapshots}
        status={status}
      />
    )
  }

  return (
    <DevBoardSaveControls
      auditState={result?.audit.ok ? 'ok' : result ? 'blocked' : 'idle'}
      auditStatus={auditStatus}
      detail={detail}
      editorAvailable={Boolean(stage)}
      isRunning={isRunning}
      issueMessage={issue?.message}
      loadLabel="Load Konva"
      onAudit={() => { void prepareDocument() }}
      onLoad={() => void loadLocal()}
      onSave={() => void saveLocal('manual_save')}
      saveError={saveError}
      saveLabel="Save Konva"
    />
  )
})

KonvaBoardSaveAudit.displayName = 'KonvaBoardSaveAudit'
