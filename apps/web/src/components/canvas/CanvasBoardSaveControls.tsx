'use client'

import type { SyntheticEvent } from 'react'
import {
  getBoardStatusDetail,
  getBoardStatusLabel,
  type BoardAction,
  type BoardSaveStatus,
} from './boardSaveStatus'

type BoardMigrationSummary = {
  migrated: number
}

export type BoardModeSaveStatusProps = {
  editorAvailable: boolean
  isRunning: boolean
  issueMessage?: string
  issuePath?: string
  lastAction: BoardAction | null
  lastSavedAt: string | null
  migration: BoardMigrationSummary | null
  onHistory: () => void
  onLoad: () => void
  onRefreshPreview: () => void
  onSave: () => void
  onSnapshot: () => void
  saveError: string | null
  snapshotMessage?: string | null
  status: BoardSaveStatus
}

type DevBoardSaveControlsProps = {
  auditState: 'blocked' | 'idle' | 'ok'
  auditStatus: string
  detail?: string
  editorAvailable: boolean
  isRunning: boolean
  issueMessage?: string
  loadLabel: string
  onAudit: () => void
  onLoad: () => void
  onSave: () => void
  saveError: string | null
  saveLabel: string
}

export function BoardModeSaveStatus({
  editorAvailable,
  isRunning,
  issueMessage,
  issuePath,
  lastAction,
  lastSavedAt,
  migration,
  onHistory,
  onLoad,
  onSave,
  onSnapshot,
  saveError,
  snapshotMessage,
  status,
}: BoardModeSaveStatusProps) {
  const boardStatusLabel = getBoardStatusLabel(status, lastAction)
  const boardDetail = saveError ?? snapshotMessage ?? getBoardStatusDetail(status, lastSavedAt, migration, issuePath)
  const actionLabel = status === 'error' && lastAction === 'load' ? 'Retry load' : 'Save now'
  const action = status === 'error' && lastAction === 'load' ? onLoad : onSave

  return (
    <div className="canvas-board-save-status" {...canvasEventProps}>
      <span aria-hidden="true" className="canvas-board-save-status__dot" data-state={status} />
      <span className="canvas-board-save-status__label">{boardStatusLabel}</span>
      {boardDetail ? <small title={saveError ?? issueMessage}>{boardDetail}</small> : null}
      {status === 'dirty' || status === 'blocked' || status === 'error' ? (
        <button disabled={!editorAvailable || isRunning} onClick={action} type="button">
          {actionLabel}
        </button>
      ) : null}
      <button disabled={!editorAvailable || isRunning} onClick={onSnapshot} type="button">
        Snapshot
      </button>
      <button disabled={!editorAvailable || isRunning} onClick={onHistory} type="button">
        History
      </button>
    </div>
  )
}

export function DevBoardSaveControls({
  auditState,
  auditStatus,
  detail,
  editorAvailable,
  isRunning,
  issueMessage,
  loadLabel,
  onAudit,
  onLoad,
  onSave,
  saveError,
  saveLabel,
}: DevBoardSaveControlsProps) {
  return (
    <div className="canvas-board-save-audit" {...canvasEventProps}>
      <button disabled={!editorAvailable || isRunning} onClick={onAudit} type="button">
        {isRunning ? 'Checking' : 'Save audit'}
      </button>
      <button disabled={!editorAvailable || isRunning} onClick={onSave} type="button">
        {saveLabel}
      </button>
      <button disabled={!editorAvailable || isRunning} onClick={onLoad} type="button">
        {loadLabel}
      </button>
      <span data-state={auditState}>{auditStatus}</span>
      {detail ? <small title={saveError ?? issueMessage}>{detail}</small> : null}
    </div>
  )
}

const canvasEventProps = {
  onDoubleClick: stopCanvasEvent,
  onPointerDown: stopCanvasEvent,
  onWheel: stopCanvasEvent,
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}
