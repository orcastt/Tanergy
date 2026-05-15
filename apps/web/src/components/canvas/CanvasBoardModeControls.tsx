'use client'

import { BoardModeSaveStatus, type BoardModeSaveStatusProps } from './CanvasBoardSaveControls'
import { CanvasBoardHistoryPanel } from './CanvasBoardHistoryPanel'
import type { BoardSnapshotSummary } from '@/features/boards/boardTypes'

export type CanvasBoardSnapshotsControls = {
  clearHistory: () => Promise<void>
  closeHistory: () => void
  isHistoryOpen: boolean
  isSnapshotRunning: boolean
  refreshSnapshots: () => Promise<void>
  restoreSnapshot: (snapshotId: string) => Promise<void>
  snapshotError: string | null
  snapshots: BoardSnapshotSummary[]
}

type CanvasBoardModeControlsProps = BoardModeSaveStatusProps & {
  activePageId?: string
  activePageTitle?: string
  snapshots: CanvasBoardSnapshotsControls
}

export function CanvasBoardModeControls({ activePageId, activePageTitle, snapshots, ...statusProps }: CanvasBoardModeControlsProps) {
  const refreshHistory = async () => {
    try {
      await statusProps.onRefreshPreview()
    } finally {
      await snapshots.refreshSnapshots().catch(() => {})
    }
  }

  return (
    <>
      <BoardModeSaveStatus {...statusProps} />
      {snapshots.isHistoryOpen ? (
        <CanvasBoardHistoryPanel
          activePageId={activePageId}
          activePageTitle={activePageTitle}
          error={snapshots.snapshotError}
          isRunning={snapshots.isSnapshotRunning}
          onClose={snapshots.closeHistory}
          onClear={() => void snapshots.clearHistory()}
          onRefresh={() => void refreshHistory()}
          onRestore={(snapshotId) => void snapshots.restoreSnapshot(snapshotId)}
          snapshots={snapshots.snapshots}
        />
      ) : null}
    </>
  )
}
