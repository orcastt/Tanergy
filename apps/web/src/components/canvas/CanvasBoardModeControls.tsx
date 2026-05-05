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
  snapshots: CanvasBoardSnapshotsControls
}

export function CanvasBoardModeControls({ snapshots, ...statusProps }: CanvasBoardModeControlsProps) {
  return (
    <>
      <BoardModeSaveStatus {...statusProps} />
      {snapshots.isHistoryOpen ? (
        <CanvasBoardHistoryPanel
          error={snapshots.snapshotError}
          isRunning={snapshots.isSnapshotRunning}
          onClose={snapshots.closeHistory}
          onClear={() => void snapshots.clearHistory()}
          onRefresh={() => void snapshots.refreshSnapshots()}
          onRefreshPreview={statusProps.onRefreshPreview}
          onRestore={(snapshotId) => void snapshots.restoreSnapshot(snapshotId)}
          snapshots={snapshots.snapshots}
        />
      ) : null}
    </>
  )
}
