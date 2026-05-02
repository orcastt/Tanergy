'use client'

import { BoardModeSaveStatus, type BoardModeSaveStatusProps } from './CanvasBoardSaveControls'
import { CanvasBoardHistoryPanel } from './CanvasBoardHistoryPanel'
import type { useBoardSnapshots } from './useBoardSnapshots'

type CanvasBoardModeControlsProps = BoardModeSaveStatusProps & {
  snapshots: ReturnType<typeof useBoardSnapshots>
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
          onRefresh={() => void snapshots.refreshSnapshots()}
          onRestore={(snapshotId) => void snapshots.restoreSnapshot(snapshotId)}
          snapshots={snapshots.snapshots}
        />
      ) : null}
    </>
  )
}
