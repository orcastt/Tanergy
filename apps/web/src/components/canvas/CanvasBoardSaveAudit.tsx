'use client'

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import type { Editor } from 'tldraw'
import { migrateRuntimeImageAssets, type RuntimeAssetMigrationResult } from '@/features/assets/runtimeAssetMigration'
import {
  loadLocalBoardDocument,
  saveLocalBoardDocument,
  type LocalBoardSaveResponse,
} from '@/features/boards/localBoardClient'
import { restoreBoardDocument } from '@/features/boards/boardDocumentRestore'
import {
  createGuardedBoardDocument,
  type BoardDocumentSerializationResult,
} from '@/features/boards/boardDocumentSerializer'
import { useNodeEdgeStore } from '@/features/node-runtime/nodeEdges'
import {
  boardAutosaveDelayMs,
  getBoardStatusDetail,
  getBoardStatusLabel,
  getDocumentSignature,
  hasBoardDocumentChange,
  shouldWarnBeforeUnload,
  type BoardAction,
  type BoardSaveStatus,
} from './boardSaveStatus'

type CanvasBoardSaveAuditProps = {
  autoLoad?: boolean
  boardId?: string
  boardTitle?: string
  editor: Editor | null
  mode?: 'board' | 'dev'
}

const defaultBoardId = 'canvas-spike-local'
const defaultBoardTitle = 'Canvas Spike Local'

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasBoardSaveAudit({
  autoLoad = false,
  boardId = defaultBoardId,
  boardTitle = defaultBoardTitle,
  editor,
  mode = 'dev',
}: CanvasBoardSaveAuditProps) {
  const autoLoadedBoardId = useRef<string | null>(null)
  const autosaveTimer = useRef<number | null>(null)
  const isRestoring = useRef(false)
  const isSaving = useRef(false)
  const lastActionRef = useRef<BoardAction | null>(null)
  const saveNowRef = useRef<(() => void) | null>(null)
  const statusRef = useRef<BoardSaveStatus>('idle')
  const [isRunning, setIsRunning] = useState(false)
  const [lastAction, setLastAction] = useState<BoardAction | null>(null)
  const [migration, setMigration] = useState<RuntimeAssetMigrationResult | null>(null)
  const [result, setResult] = useState<BoardDocumentSerializationResult | null>(null)
  const [saveResult, setSaveResult] = useState<LocalBoardSaveResponse | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [status, setStatus] = useState<BoardSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    lastActionRef.current = lastAction
  }, [lastAction])

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

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimer.current === null) return
    window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = null
  }, [])

  const scheduleAutosave = useCallback(() => {
    if (mode !== 'board') return
    clearAutosaveTimer()
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null
      saveNowRef.current?.()
    }, boardAutosaveDelayMs)
  }, [clearAutosaveTimer, mode])

  const saveLocal = useCallback(async () => {
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
      const saved = await saveLocalBoardDocument({
        boardId,
        document: nextResult.document,
        title: boardTitle,
      })
      const savedBoard = saved.board
      if (!savedBoard) throw new Error('Local board save failed.')
      const savedSignature = getDocumentSignature(nextResult.document)
      const currentResult = createGuardedBoardDocument(editor)
      const currentSignature = getDocumentSignature(currentResult.document)
      const hasNewChanges = savedSignature !== currentSignature

      setLastAction('save')
      setSaveResult(saved)
      setLastSavedAt(savedBoard.savedAt)
      setResult(hasNewChanges ? currentResult : nextResult)
      setStatus(hasNewChanges ? 'dirty' : 'saved')
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
    saveNowRef.current = () => void saveLocal()
  }, [saveLocal])

  const markDirty = useCallback(() => {
    if (mode !== 'board' || !editor || isRestoring.current) return
    setStatus((current) => current === 'loading' ? current : 'dirty')
    setSaveError(null)
    if (!isSaving.current) scheduleAutosave()
  }, [editor, mode, scheduleAutosave])

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
      setSaveResult({
        board: {
          byteSize: board.byteSize,
          id: board.id,
          ownerId: board.ownerId,
          savedAt: board.savedAt,
          title: `${restore.shapeCount} shape(s) loaded from ${board.title}`,
          workspaceId: board.workspaceId,
        },
        ok: true,
      })
      setLastSavedAt(board.savedAt)
      setResult(createGuardedBoardDocument(editor))
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
  }, [boardId, clearAutosaveTimer, editor])

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

  useEffect(() => {
    if (mode !== 'board') return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnBeforeUnload(statusRef.current, isSaving.current, lastActionRef.current)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [mode])

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
    const boardStatusLabel = getBoardStatusLabel(status, lastAction)
    const boardDetail = saveError ?? getBoardStatusDetail(status, lastSavedAt, migration, issue?.path)
    const actionLabel = status === 'error' && lastAction === 'load' ? 'Retry load' : 'Save now'

    return (
      <div
        className="canvas-board-save-status"
        onDoubleClick={stopCanvasEvent}
        onPointerDown={stopCanvasEvent}
        onWheel={stopCanvasEvent}
      >
        <span aria-hidden="true" className="canvas-board-save-status__dot" data-state={status} />
        <span className="canvas-board-save-status__label">{boardStatusLabel}</span>
        {boardDetail ? <small title={saveError ?? issue?.message}>{boardDetail}</small> : null}
        {status === 'dirty' || status === 'blocked' || status === 'error' ? (
          <button
            disabled={!editor || isRunning}
            onClick={() => void (status === 'error' && lastAction === 'load' ? loadLocal() : saveLocal())}
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="canvas-board-save-audit"
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <button disabled={!editor || isRunning} onClick={() => void runAudit()} type="button">
        {isRunning ? 'Checking' : 'Save audit'}
      </button>
      <button disabled={!editor || isRunning} onClick={() => void saveLocal()} type="button">
        {saveLabel}
      </button>
      <button disabled={!editor || isRunning} onClick={() => void loadLocal()} type="button">
        {loadLabel}
      </button>
      <span data-state={result?.audit.ok ? 'ok' : result ? 'blocked' : 'idle'}>{auditStatus}</span>
      {detail ? <small title={saveError ?? issue?.message}>{detail}</small> : null}
    </div>
  )
}
