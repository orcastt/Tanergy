'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type Konva from 'konva'
import type { CanvasCamera, CanvasDocument } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardPersistenceRecord, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import type {
  KonvaBoardDocumentSerializationOptions,
  KonvaBoardRestorePayload,
} from '@/features/boards/konvaBoardDocument'
import { CanvasBoardModeControls } from '@/components/canvas/CanvasBoardModeControls'
import { DevBoardSaveControls } from '@/components/canvas/CanvasBoardSaveControls'
import { useKonvaBoardPersistenceLifecycle, type KonvaBoardHistoryRecorder } from './useKonvaBoardPersistenceLifecycle'
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
  const recordHistoryRef = useRef<KonvaBoardHistoryRecorder | null>(null)
  const persistence = useKonvaBoardPersistenceLifecycle({
    autoLoad,
    boardId,
    boardTitle,
    camera,
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
  })

  useImperativeHandle(ref, () => ({
    acknowledgeExternalDocument: persistence.acknowledgeExternalDocument,
  }), [persistence.acknowledgeExternalDocument])

  const snapshots = useKonvaBoardSnapshots({
    boardId,
    boardTitle: historyTitle?.trim() || boardTitle,
    captureThumbnail: persistence.captureThumbnail,
    mode,
    onRestoreEnd: persistence.finishRestore,
    onRestoreStart: persistence.startRestore,
    onSnapshotRestored: persistence.handleSnapshotRestored,
    prepareDocument: persistence.prepareDocument,
    restoreDocument: persistence.restoreDocument,
    workspace,
  })

  useEffect(() => {
    recordHistoryRef.current = snapshots.recordHistory
    return () => {
      recordHistoryRef.current = null
    }
  }, [snapshots.recordHistory])

  const issue = persistence.result?.audit.issues.find((item) => item.blocking)
  const auditStatus = !persistence.result
    ? 'Not checked'
    : persistence.saveResult?.board
      ? `${persistence.lastAction === 'load' ? 'Loaded' : 'Saved'} ${persistence.saveResult.board.byteSize} bytes`
      : persistence.result.audit.ok
        ? `${persistence.result.audit.byteSize} bytes`
        : issue?.code ?? 'Blocked'
  const detail = persistence.saveError ?? issue?.path

  if (mode === 'board') {
    return (
      <CanvasBoardModeControls
        editorAvailable={Boolean(stage)}
        isRunning={persistence.isRunning || snapshots.isSnapshotRunning}
        activePageId={activePageId}
        activePageTitle={historyTitle}
        issueMessage={issue?.message}
        issuePath={issue?.path}
        lastAction={persistence.lastAction}
        lastSavedAt={persistence.lastSavedAt}
        migration={null}
        onHistory={snapshots.openHistory}
        onLoad={() => { void persistence.loadLocal() }}
        onRefreshPreview={() => persistence.saveLocal('manual_save', { refreshThumbnail: true })}
        onSave={() => { void persistence.saveLocal('manual_save') }}
        onSnapshot={() => { void snapshots.saveSnapshot('manual') }}
        saveError={persistence.saveError ?? snapshots.snapshotError}
        snapshotMessage={snapshots.snapshotMessage}
        snapshots={snapshots}
        status={persistence.status}
      />
    )
  }

  return (
    <DevBoardSaveControls
      auditState={persistence.result?.audit.ok ? 'ok' : persistence.result ? 'blocked' : 'idle'}
      auditStatus={auditStatus}
      detail={detail}
      editorAvailable={Boolean(stage)}
      isRunning={persistence.isRunning}
      issueMessage={issue?.message}
      loadLabel="Load Konva"
      onAudit={persistence.prepareDocument}
      onLoad={() => { void persistence.loadLocal() }}
      onSave={() => { void persistence.saveLocal('manual_save') }}
      saveError={persistence.saveError}
      saveLabel="Save Konva"
    />
  )
})

KonvaBoardSaveAudit.displayName = 'KonvaBoardSaveAudit'
