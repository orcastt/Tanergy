'use client'

/* eslint-disable @next/next/no-img-element -- History preview URLs can come from local API, FastAPI, or R2. */
import { useMemo, useState, type SyntheticEvent } from 'react'
import type { BoardSnapshotSummary } from '@/features/boards/boardTypes'

type CanvasBoardHistoryPanelProps = {
  activePageId?: string
  activePageTitle?: string
  error: string | null
  isRunning: boolean
  onClear: () => void
  onClose: () => void
  onRefresh: () => void
  onRefreshPreview: () => void
  onRestore: (snapshotId: string) => void
  snapshots: BoardSnapshotSummary[]
}

export function CanvasBoardHistoryPanel({
  activePageId,
  activePageTitle,
  error,
  isRunning,
  onClear,
  onClose,
  onRefresh,
  onRefreshPreview,
  onRestore,
  snapshots,
}: CanvasBoardHistoryPanelProps) {
  const [scope, setScope] = useState<'all' | 'current'>('current')
  const [filter, setFilter] = useState<'all' | 'autosave' | 'user'>('all')
  const visibleSnapshots = useMemo(() => snapshots.filter((snapshot) => {
    if (scope === 'current' && !isCurrentPageSnapshot(snapshot, activePageId, activePageTitle)) return false
    if (filter === 'all') return true
    return getSnapshotKind(snapshot.reason) === filter
  }), [activePageId, activePageTitle, filter, scope, snapshots])

  return (
    <aside className="canvas-board-history" aria-label="Board history" {...canvasEventProps}>
      <header>
        <div>
          <strong>Board history</strong>
          <span>{visibleSnapshots.length} of {snapshots.length} entr{snapshots.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <button aria-label="Close board history" onClick={onClose} type="button">Close</button>
      </header>
      <div className="canvas-board-history__filters" aria-label="History filters">
        {(['current', 'all'] as const).map((value) => (
          <button
            className={scope === value ? 'is-active' : undefined}
            key={value}
            onClick={() => setScope(value)}
            type="button"
          >
            {value === 'current' ? 'Current page' : 'All pages'}
          </button>
        ))}
      </div>
      <div className="canvas-board-history__filters" aria-label="History types">
        {(['all', 'autosave', 'user'] as const).map((value) => (
          <button
            className={filter === value ? 'is-active' : undefined}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {getFilterLabel(value)}
          </button>
        ))}
      </div>
      {error ? <div className="canvas-board-history__error" role="alert">{error}</div> : null}
      <div className="canvas-board-history__list">
        {visibleSnapshots.length === 0 ? (
          <p>No history yet. Autosave and Snapshot entries will appear here.</p>
        ) : visibleSnapshots.map((snapshot) => (
          <article key={snapshot.id} className="canvas-board-history__item" data-kind={getSnapshotKind(snapshot.reason)}>
            <div className="canvas-board-history__preview" aria-hidden="true">
              {snapshot.thumbnailUrl ? <img alt="" src={snapshot.thumbnailUrl} /> : <span>{getInitials(snapshot.title)}</span>}
            </div>
            <div>
              <strong>{snapshot.title}</strong>
              <span>{formatDate(snapshot.createdAt)} · {formatReason(snapshot.reason)}</span>
              <small>{snapshot.shapeCount} shapes / {snapshot.assetCount} assets · {formatBytes(snapshot.byteSize)}</small>
              <span className="canvas-board-history__author">
                <span>{getInitials(snapshot.createdBy)}</span>
                Saved by {formatUser(snapshot.createdBy)}
              </span>
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
        <span>Free retention target: latest 100 autosaves + 100 user saves per board.</span>
        <div className="canvas-board-history__footer-actions">
          <button disabled={isRunning} onClick={onRefresh} type="button">Refresh</button>
          <button disabled={isRunning} onClick={onRefreshPreview} type="button">Refresh preview</button>
          <button
            disabled={isRunning || snapshots.length === 0}
            onClick={() => {
              if (window.confirm('Clear all board history for this board? This cannot be undone.')) onClear()
            }}
            type="button"
          >
            Clean
          </button>
        </div>
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

function getSnapshotKind(value: string) {
  return value === 'autosave' || value === 'auto_interval' ? 'autosave' : 'user'
}

function isCurrentPageSnapshot(snapshot: BoardSnapshotSummary, activePageId?: string, activePageTitle?: string) {
  if (!activePageId && !activePageTitle) return true
  if (snapshot.pageId) return snapshot.pageId === activePageId
  const pageTitle = normalizeTitle(snapshot.pageTitle)
  const activeTitle = normalizeTitle(activePageTitle)
  if (pageTitle && activeTitle) return pageTitle === activeTitle
  const snapshotTitle = normalizeTitle(snapshot.title)
  return Boolean(snapshotTitle && activeTitle && snapshotTitle === activeTitle)
}

function getFilterLabel(value: 'all' | 'autosave' | 'user') {
  if (value === 'autosave') return 'Autosave'
  if (value === 'user') return 'User saves'
  return 'All'
}

function formatUser(value: string) {
  return value === 'dev-user' ? 'Dev User' : value
}

function getInitials(value: string) {
  const label = formatUser(value)
  return label.split(/[\s._-]+/).map((part) => part[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join('') || 'U'
}

function normalizeTitle(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || null
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
