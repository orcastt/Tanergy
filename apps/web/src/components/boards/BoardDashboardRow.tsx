'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { BoardThumbnail } from './BoardThumbnail'

type BoardDashboardRowProps = {
  board: BoardPersistenceSummary
  editingTitle: string
  isEditing: boolean
  isPending: boolean
  onCancelRename: () => void
  onDelete: (board: BoardPersistenceSummary) => void
  onOpenTitle: (board: BoardPersistenceSummary) => void
  onRenameTitle: (board: BoardPersistenceSummary) => void
  onStartRename: (board: BoardPersistenceSummary) => void
  onSubmitRename: (event: FormEvent<HTMLFormElement>, boardId: string) => void
  onTitleChange: (title: string) => void
}

export function BoardDashboardRow({
  board,
  editingTitle,
  isEditing,
  isPending,
  onCancelRename,
  onDelete,
  onOpenTitle,
  onRenameTitle,
  onStartRename,
  onSubmitRename,
  onTitleChange,
}: BoardDashboardRowProps) {
  return (
    <div className="boards-row">
      <div className="boards-title-cell">
        <BoardThumbnail board={board} />
        {isEditing ? (
          <form className="boards-rename-form" onSubmit={(event) => onSubmitRename(event, board.id)}>
            <input
              aria-label="Board title"
              autoFocus
              maxLength={80}
              onChange={(event) => onTitleChange(event.target.value)}
              value={editingTitle}
            />
            <button disabled={isPending} type="submit">Save</button>
            <button disabled={isPending} onClick={onCancelRename} type="button">Cancel</button>
          </form>
        ) : (
          <button
            className="boards-title-button"
            onClick={() => onOpenTitle(board)}
            onDoubleClick={() => onRenameTitle(board)}
            title="Click to open. Double-click to rename."
            type="button"
          >
            <strong>{board.title}</strong>
            <small>{board.id}</small>
          </button>
        )}
      </div>
      <span className="boards-object-count">{formatObjectCount(board)}</span>
      <time dateTime={board.savedAt}>{formatSavedAt(board.savedAt)}</time>
      <span>{formatBytes(board.byteSize)}</span>
      <span className="boards-row-actions">
        <Link href={`/boards/${encodeURIComponent(board.id)}`}>Open</Link>
        <button disabled={isPending} onClick={() => onStartRename(board)} type="button">
          Rename
        </button>
        <button disabled={isPending} onClick={() => onDelete(board)} type="button">
          Delete
        </button>
      </span>
    </div>
  )
}

function formatSavedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatObjectCount(board: BoardPersistenceSummary) {
  return `${board.shapeCount} shape${board.shapeCount === 1 ? '' : 's'} / ${board.assetCount} asset${board.assetCount === 1 ? '' : 's'}`
}
