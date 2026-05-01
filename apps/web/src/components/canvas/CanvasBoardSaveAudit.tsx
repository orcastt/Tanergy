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
  const [isRunning, setIsRunning] = useState(false)
  const [lastAction, setLastAction] = useState<'loaded' | 'saved' | null>(null)
  const [migration, setMigration] = useState<RuntimeAssetMigrationResult | null>(null)
  const [result, setResult] = useState<BoardDocumentSerializationResult | null>(null)
  const [saveResult, setSaveResult] = useState<LocalBoardSaveResponse | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

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
      await prepareDocument()
    } finally {
      setIsRunning(false)
    }
  }

  const saveLocal = async () => {
    setIsRunning(true)
    try {
      setSaveError(null)
      const nextResult = await prepareDocument()
      if (!nextResult?.audit.ok) throw new Error(nextResult?.audit.issues[0]?.message ?? 'Board document is blocked.')
      const saved = await saveLocalBoardDocument({
        boardId,
        document: nextResult.document,
        title: boardTitle,
      })
      setLastAction('saved')
      setSaveResult(saved)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Local board save failed.')
    } finally {
      setIsRunning(false)
    }
  }

  const loadLocal = useCallback(async () => {
    if (!editor) return
    setIsRunning(true)
    try {
      setSaveError(null)
      const loaded = await loadLocalBoardDocument(boardId)
      const board = loaded.board
      if (!board) throw new Error('Local board load failed.')
      const restore = restoreBoardDocument(editor, board.document)
      setLastAction('loaded')
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
      setResult(createGuardedBoardDocument(editor))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Local board load failed.')
    } finally {
      setIsRunning(false)
    }
  }, [boardId, editor])

  useEffect(() => {
    if (!autoLoad || !editor || autoLoadedBoardId.current === boardId) return
    autoLoadedBoardId.current = boardId
    void loadLocal()
  }, [autoLoad, boardId, editor, loadLocal])

  const issue = result?.audit.issues.find((item) => item.blocking)
  const status = !result
    ? 'Not checked'
    : saveResult?.board
      ? `${lastAction === 'loaded' ? 'Loaded' : 'Saved'} ${saveResult.board.byteSize} bytes`
    : result.audit.ok
      ? `${result.audit.byteSize} bytes`
      : issue?.code ?? 'Blocked'
  const detail = saveError ?? (migration?.migrated ? `${migration.migrated} asset(s) migrated` : issue?.path)
  const saveLabel = mode === 'board' ? 'Save board' : 'Save local'
  const loadLabel = mode === 'board' ? 'Load board' : 'Load local'

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
      <span data-state={result?.audit.ok ? 'ok' : result ? 'blocked' : 'idle'}>{status}</span>
      {detail ? <small title={saveError ?? issue?.message}>{detail}</small> : null}
    </div>
  )
}
