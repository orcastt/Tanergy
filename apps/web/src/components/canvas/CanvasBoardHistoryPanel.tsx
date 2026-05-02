'use client'

import type { SyntheticEvent } from 'react'
import type { BoardSnapshotSummary } from '@/features/boards/boardTypes'

type CanvasBoardHistoryPanelProps = {
  error: string | null
  isRunning: boolean
  onClose: () => void
  onRefresh: () => void
  onRestore: (snapshotId: string) => void
  snapshots: BoardSnapshotSummary[]
}

export function CanvasBoardHistoryPanel({
  error,
  isRunning,
  onClose,
  onRefresh,
  onRestore,
  snapshots,
}: CanvasBoardHistoryPanelProps) {
  return (
    <aside className="canvas-board-history" aria-label="Board history" {...canvasEventProps}>
      <header>
        <div>
          <strong>Board history</strong>
          <span>{snapshots.length} entr{snapshots.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <button aria-label="Close board history" onClick={onClose} type="button">Close</button>
      </header>
      {error ? <div className="canvas-board-history__error" role="alert">{error}</div> : null}
      <div className="canvas-board-history__list">
        {snapshots.length === 0 ? (
          <p>No history yet. Autosave and Snapshot entries will appear here.</p>
        ) : snapshots.map((snapshot) => (
          <article key={snapshot.id} className="canvas-board-history__item">
            <div>
              <strong>{snapshot.title}</strong>
              <span>{formatDate(snapshot.createdAt)} · {formatReason(snapshot.reason)}</span>
              <small>{snapshot.shapeCount} shapes / {snapshot.assetCount} assets · {formatBytes(snapshot.byteSize)}</small>
            </div>
            <button
              disabled={isRunning}
              onClick={() => {
                if (window.confirm('Restore this history entry? Current unsaved canvas changes will be replaced.')) {
                  onRestore(snapshot.id)
                }
              }}
              type="button"
            >
              Restore
            </button>
          </article>
        ))}
      </div>
      <footer>
        <span>Free retention: latest 100 history entries per board.</span>
        <button disabled={isRunning} onClick={onRefresh} type="button">Refresh</button>
      </footer>
    </aside>
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

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatReason(value: string) {
  if (value === 'autosave') return 'Autosave'
  if (value === 'keyboard') return 'Cmd/Ctrl+S'
  if (value === 'manual_save') return 'Manual save'
  if (value === 'auto_interval') return 'Timed snapshot'
  if (value === 'pre_restore') return 'Pre-restore'
  return 'Snapshot'
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
