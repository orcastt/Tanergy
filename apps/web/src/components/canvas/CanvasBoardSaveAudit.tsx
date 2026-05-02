'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import { migrateRuntimeImageAssets, type RuntimeAssetMigrationResult } from '@/features/assets/runtimeAssetMigration'
import {
  loadLocalBoardDocument,
  saveLocalBoardDocument,
  type LocalBoardSaveResponse,
} from '@/features/boards/localBoardClient'
import type { BoardPersistenceRecord, BoardSnapshotReason, BoardSnapshotRecord } from '@/features/boards/boardTypes'
import { restoreBoardDocument } from '@/features/boards/boardDocumentRestore'
import {
  createGuardedBoardDocument,
  type BoardDocumentSerializationResult,
} from '@/features/boards/boardDocumentSerializer'
import { useNodeEdgeStore } from '@/features/node-runtime/nodeEdges'
import {
  getDocumentSignature,
  hasBoardDocumentChange,
  type BoardAction,
  type BoardSaveStatus,
} from './boardSaveStatus'
import { createLoadedBoardSaveResponse, createRestoredHistorySaveResponse } from './boardSaveResults'
import { CanvasBoardModeControls } from './CanvasBoardModeControls'
import { DevBoardSaveControls } from './CanvasBoardSaveControls'
import { useBoardAutosaveTimer, useBoardBeforeUnloadWarning, useBoardSettingsDirtyTracking } from './useBoardSaveLifecycle'
import { useBoardSnapshots } from './useBoardSnapshots'

type CanvasBoardSaveAuditProps = {
  autoLoad?: boolean
  boardId?: string
  boardTitle?: string
  editor: Editor | null
  mode?: 'board' | 'dev'
  onBoardLoaded?: (board: BoardPersistenceRecord) => void
}

const defaultBoardId = 'canvas-spike-local'
const defaultBoardTitle = 'Canvas Spike Local'

export function CanvasBoardSaveAudit({
  autoLoad = false,
  boardId = defaultBoardId,
  boardTitle = defaultBoardTitle,
  editor,
  mode = 'dev',
  onBoardLoaded,
}: CanvasBoardSaveAuditProps) {
  const autoLoadedBoardId = useRef<string | null>(null)
  const isRestoring = useRef(false)
  const isSaving = useRef(false)
  const lastSavedSignature = useRef<string | null>(null)
  const recordHistoryRef = useRef<((result: BoardDocumentSerializationResult | undefined, reason: BoardSnapshotReason, options?: { silent?: boolean }) => Promise<void>) | null>(null)
  const saveNowRef = useRef<((source: 'autosave') => void) | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [lastAction, setLastAction] = useState<BoardAction | null>(null)
  const [migration, setMigration] = useState<RuntimeAssetMigrationResult | null>(null)
  const [result, setResult] = useState<BoardDocumentSerializationResult | null>(null)
  const [saveResult, setSaveResult] = useState<LocalBoardSaveResponse | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [status, setStatus] = useState<BoardSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const { clearAutosaveTimer, scheduleAutosave } = useBoardAutosaveTimer(mode, saveNowRef)
  useBoardBeforeUnloadWarning(mode, status, isSaving, lastAction)

  const prepareDocument = useCallback(async () => {
    if (!editor) return
    const migrationResult = await migrateRuntimeImageAssets(editor)
    const nextResult = createGuardedBoardDocument(editor)
    setMigration(migrationResult)
    setResult(nextResult)
    return nextResult
  }, [editor])

  const runAudit = async () => {
    setIsRunning(true)
    try {
      setSaveError(null)
      setLastAction('audit')
      await prepareDocument()
    } finally {
      setIsRunning(false)
    }
  }

  const saveLocal = useCallback(async (historyReason: BoardSnapshotReason = 'manual_save') => {
    if (!editor || isSaving.current) return
    clearAutosaveTimer()
    isSaving.current = true
    setIsRunning(true)
    try {
      setSaveError(null)
      setStatus('saving')
      setLastAction('save')
      const nextResult = await prepareDocument()
      if (!nextResult?.audit.ok) {
        setStatus('blocked')
        throw new Error(nextResult?.audit.issues[0]?.message ?? 'Board document is blocked.')
      }
      const savedSignature = getDocumentSignature(nextResult.document)
      if (lastSavedSignature.current === savedSignature) {
        setLastAction('save')
        setResult(nextResult)
        setStatus('saved')
        return
      }
      const saved = await saveLocalBoardDocument({
        boardId,
        document: nextResult.document,
        title: boardTitle,
      })
      const savedBoard = saved.board
      if (!savedBoard) throw new Error('Local board save failed.')
      const currentResult = createGuardedBoardDocument(editor)
      const currentSignature = getDocumentSignature(currentResult.document)
      const hasNewChanges = savedSignature !== currentSignature

      lastSavedSignature.current = savedSignature
      setLastAction('save')
      setSaveResult(saved)
      setLastSavedAt(savedBoard.savedAt)
      setResult(hasNewChanges ? currentResult : nextResult)
      setStatus(hasNewChanges ? 'dirty' : 'saved')
      await recordHistoryRef.current?.(nextResult, historyReason, { silent: historyReason === 'autosave' })
      if (hasNewChanges) scheduleAutosave()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Local board save failed.')
      setStatus((current) => current === 'blocked' ? 'blocked' : 'error')
    } finally {
      isSaving.current = false
      setIsRunning(false)
    }
  }, [boardId, boardTitle, clearAutosaveTimer, editor, prepareDocument, scheduleAutosave])

  useEffect(() => {
    saveNowRef.current = (source) => void saveLocal(source)
  }, [saveLocal])

  useEffect(() => {
    if (mode !== 'board') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveLocal('keyboard')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, saveLocal])

  const markDirty = useCallback(() => {
    if (mode !== 'board' || !editor || isRestoring.current) return
    setStatus((current) => current === 'loading' ? current : 'dirty')
    setSaveError(null)
    if (!isSaving.current) scheduleAutosave()
  }, [editor, mode, scheduleAutosave])
  useBoardSettingsDirtyTracking(mode, markDirty)

  const loadLocal = useCallback(async () => {
    if (!editor) return
    clearAutosaveTimer()
    isRestoring.current = true
    setIsRunning(true)
    try {
      setSaveError(null)
      setStatus('loading')
      setLastAction('load')
      const loaded = await loadLocalBoardDocument(boardId)
      const board = loaded.board
      if (!board) throw new Error('Local board load failed.')
      const restore = restoreBoardDocument(editor, board.document)
      onBoardLoaded?.(board)
      setSaveResult(createLoadedBoardSaveResponse(board, restore))
      setLastSavedAt(board.savedAt)
      const restoredResult = createGuardedBoardDocument(editor)
      lastSavedSignature.current = getDocumentSignature(restoredResult.document)
      setResult(restoredResult)
      setStatus('loaded')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Local board load failed.')
      setStatus('error')
    } finally {
      setIsRunning(false)
      requestAnimationFrame(() => {
        isRestoring.current = false
      })
    }
  }, [boardId, clearAutosaveTimer, editor, onBoardLoaded])

  const handleSnapshotRestored = useCallback((snapshot: BoardSnapshotRecord) => {
    if (!editor) return
    const restoredResult = createGuardedBoardDocument(editor)
    setResult(restoredResult)
    setSaveResult(createRestoredHistorySaveResponse(snapshot))
    setLastAction('load')
    setLastSavedAt(null)
    setSaveError(null)
    setStatus('dirty')
    scheduleAutosave()
  }, [editor, scheduleAutosave])

  const snapshots = useBoardSnapshots({
    boardId,
    boardTitle,
    editor,
    mode,
    onRestoreEnd: () => requestAnimationFrame(() => { isRestoring.current = false }),
    onRestoreStart: () => {
      clearAutosaveTimer()
      isRestoring.current = true
    },
    onSnapshotRestored: handleSnapshotRestored,
    prepareDocument,
  })

  useEffect(() => {
    recordHistoryRef.current = snapshots.recordHistory
    return () => {
      recordHistoryRef.current = null
    }
  }, [snapshots.recordHistory])

  useEffect(() => {
    if (!autoLoad || !editor || autoLoadedBoardId.current === boardId) return
    autoLoadedBoardId.current = boardId
    void loadLocal()
  }, [autoLoad, boardId, editor, loadLocal])

  useEffect(() => {
    if (mode !== 'board' || !editor) return
    const stopStoreListen = editor.store.listen(({ changes }) => {
      if (hasBoardDocumentChange(changes)) markDirty()
    }, { scope: 'all', source: 'all' })
    const stopEdgeListen = useNodeEdgeStore.subscribe(markDirty)
    editor.on('resize', markDirty)
    return () => {
      stopStoreListen()
      stopEdgeListen()
      editor.off('resize', markDirty)
      clearAutosaveTimer()
    }
  }, [clearAutosaveTimer, editor, markDirty, mode])

  const issue = result?.audit.issues.find((item) => item.blocking)
  const auditStatus = !result
    ? 'Not checked'
    : saveResult?.board
      ? `${lastAction === 'load' ? 'Loaded' : 'Saved'} ${saveResult.board.byteSize} bytes`
    : result.audit.ok
      ? `${result.audit.byteSize} bytes`
      : issue?.code ?? 'Blocked'
  const detail = saveError ?? (migration?.migrated ? `${migration.migrated} asset(s) migrated` : issue?.path)
  const saveLabel = mode === 'board' ? 'Save board' : 'Save local'
  const loadLabel = mode === 'board' ? 'Load board' : 'Load local'

  if (mode === 'board') {
    return (
      <CanvasBoardModeControls
        editorAvailable={Boolean(editor)}
        isRunning={isRunning || snapshots.isSnapshotRunning}
        issueMessage={issue?.message}
        issuePath={issue?.path}
        lastAction={lastAction}
        lastSavedAt={lastSavedAt}
        migration={migration}
        onHistory={snapshots.openHistory}
        onLoad={() => void loadLocal()}
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
      editorAvailable={Boolean(editor)}
      isRunning={isRunning}
      issueMessage={issue?.message}
      loadLabel={loadLabel}
      onAudit={() => void runAudit()}
      onLoad={() => void loadLocal()}
      onSave={() => void saveLocal('manual_save')}
      saveError={saveError}
      saveLabel={saveLabel}
    />
  )
}
