'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import type { CanvasCamera, CanvasDocument } from '@/features/canvas-engine'
import {
  loadLocalBoardDocument,
  saveLocalBoardDocument,
  type LocalBoardSaveResponse,
} from '@/features/boards/localBoardClient'
import type { BoardPersistenceRecord, BoardSnapshotReason, BoardSnapshotRecord } from '@/features/boards/boardTypes'
import {
  createGuardedKonvaBoardDocument,
  restoreKonvaBoardDocument,
  type KonvaBoardDocumentSerializationResult,
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
  autoLoad?: boolean
  boardId?: string
  boardTitle?: string
  camera: CanvasCamera
  document: CanvasDocument
  mode?: 'board' | 'dev'
  onBoardLoaded?: (board: BoardPersistenceRecord) => void
  onDocumentRestore: (document: CanvasDocument) => void
  stage: Konva.Stage | null
}

const defaultBoardId = 'konva-spike-local'
const defaultBoardTitle = 'Konva Spike Local'
type SaveLocalOptions = { refreshThumbnail?: boolean }

export function KonvaBoardSaveAudit({
  autoLoad = false,
  boardId = defaultBoardId,
  boardTitle = defaultBoardTitle,
  camera,
  document,
  mode = 'dev',
  onBoardLoaded,
  onDocumentRestore,
  stage,
}: KonvaBoardSaveAuditProps) {
  const autoLoadedBoardId = useRef<string | null>(null)
  const isRestoring = useRef(false)
  const isSaving = useRef(false)
  const lastSavedSignature = useRef<string | null>(null)
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

  useEffect(() => {
    latestCameraRef.current = camera
    latestDocumentRef.current = document
    latestStageRef.current = stage
  }, [camera, document, stage])

  const getPreparedDocument = useCallback(() => ({
    ...latestDocumentRef.current,
    camera: latestCameraRef.current,
  }), [])

  const prepareDocument = useCallback(async () => {
    const nextResult = createGuardedKonvaBoardDocument(getPreparedDocument())
    setResult(nextResult)
    return nextResult
  }, [getPreparedDocument])

  const captureThumbnail = useCallback(async () => {
    const currentStage = latestStageRef.current
    if (!currentStage) return null
    return captureKonvaBoardThumbnailUrl(currentStage, getPreparedDocument(), boardTitle)
  }, [boardTitle, getPreparedDocument])

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
      const needsThumbnail = mode === 'board' && (!currentThumbnailUrl || options.refreshThumbnail)
      const capturedThumbnailUrl = needsThumbnail
        ? await captureThumbnail().catch(() => currentThumbnailUrl)
        : currentThumbnailUrl
      const thumbnailUrl = capturedThumbnailUrl ?? currentThumbnailUrl
      const saved = await saveLocalBoardDocument({
        boardId,
        document: nextResult.document,
        thumbnailUrl,
        title: boardTitle,
      })
      const savedBoard = saved.board
      if (!savedBoard) throw new Error('Konva board save failed.')
      const currentResult = createGuardedKonvaBoardDocument(getPreparedDocument())
      const currentSignature = getDocumentSignature(currentResult.document)
      const hasNewChanges = savedSignature !== currentSignature

      lastSavedSignature.current = savedSignature
      setLastAction('save')
      setSaveResult(saved)
      setLastSavedAt(savedBoard.savedAt)
      setResult(hasNewChanges ? currentResult : nextResult)
      setStatus(hasNewChanges ? 'dirty' : 'saved')
      await recordHistoryRef.current?.(nextResult, historyReason, { silent: historyReason === 'autosave', thumbnailUrl: savedBoard.thumbnailUrl ?? thumbnailUrl })
      if (hasNewChanges) scheduleAutosave()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Konva board save failed.')
      setStatus((current) => current === 'blocked' ? 'blocked' : 'error')
    } finally {
      isSaving.current = false
      setIsRunning(false)
    }
  }, [boardId, boardTitle, captureThumbnail, clearAutosaveTimer, getPreparedDocument, mode, prepareDocument, saveResult, scheduleAutosave])

  useEffect(() => {
    saveNowRef.current = (source) => void saveLocal(source)
  }, [saveLocal])

  useBoardKeyboardSaveShortcut(mode, saveLocal)

  const restoreDocument = useCallback((nextDocument: unknown) => {
    const restored = restoreKonvaBoardDocument(nextDocument)
    onDocumentRestore(restored.document)
    return restored.result
  }, [onDocumentRestore])

  const loadLocal = useCallback(async () => {
    clearAutosaveTimer()
    isRestoring.current = true
    setIsRunning(true)
    try {
      setSaveError(null)
      setStatus('loading')
      setLastAction('load')
      const loaded = await loadLocalBoardDocument(boardId)
      const board = loaded.board
      if (!board) throw new Error('Konva board load failed.')
      const restored = restoreKonvaBoardDocument(board.document)
      onDocumentRestore(restored.document)
      onBoardLoaded?.(board)
      const restoredResult = createGuardedKonvaBoardDocument(restored.document)
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
  }, [boardId, clearAutosaveTimer, onBoardLoaded, onDocumentRestore])

  const handleSnapshotRestored = useCallback((snapshot: BoardSnapshotRecord) => {
    const restoredResult = createGuardedKonvaBoardDocument(getPreparedDocument())
    lastSavedSignature.current = null
    setResult(restoredResult)
    setSaveResult(createRestoredHistorySaveResponse(snapshot))
    setLastAction('load')
    setLastSavedAt(null)
    setSaveError(null)
    setStatus('dirty')
    scheduleAutosave()
  }, [getPreparedDocument, scheduleAutosave])

  const snapshots = useKonvaBoardSnapshots({
    boardId,
    boardTitle,
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
    if (mode !== 'board' || isRestoring.current) return
    const nextResult = createGuardedKonvaBoardDocument(getPreparedDocument())
    const nextSignature = getDocumentSignature(nextResult.document)
    if (lastSavedSignature.current !== nextSignature) markDirty()
  }, [document, camera, getPreparedDocument, markDirty, mode])

  useEffect(() => () => clearAutosaveTimer(), [clearAutosaveTimer])

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
}
