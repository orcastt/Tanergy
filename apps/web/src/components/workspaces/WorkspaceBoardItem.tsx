'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BoardThumbnail } from '@/components/boards/BoardThumbnail'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { WorkspaceBoardMenuAction } from './WorkspaceBoardMenuAction'
import { getBoardDisplayCardColor } from './workspaceBoardUtils'

export type WorkspaceBoardViewMode = 'gallery' | 'list'
export type WorkspaceBoardCollaborator = {
  id: string
  initials: string
  label: string
}

type WorkspaceBoardItemProps = {
  board: BoardPersistenceSummary
  canCopyBoard: boolean
  canDeleteBoard: boolean
  canManageBoard: boolean
  canShareBoard: boolean
  collaborators: WorkspaceBoardCollaborator[]
  editingTitle: string
  isEditing: boolean
  isInteractive?: boolean
  isPending: boolean
  onCancelRename: () => void
  onCopy: () => void
  onDelete: () => void
  onOpen: () => void
  onOpenPanel: () => void
  onRename: () => void
  onShare: () => void
  onSubmitRename: (event: FormEvent<HTMLFormElement>) => void
  onTitleChange: (title: string) => void
  onTogglePin: () => void
  viewMode: WorkspaceBoardViewMode
  workspace?: TangentWorkspace
}

export function WorkspaceBoardItem({
  board,
  canCopyBoard,
  canDeleteBoard,
  canManageBoard,
  canShareBoard,
  collaborators,
  editingTitle,
  isEditing,
  isInteractive = true,
  isPending,
  onCancelRename,
  onCopy,
  onDelete,
  onOpen,
  onOpenPanel,
  onRename,
  onShare,
  onSubmitRename,
  onTitleChange,
  onTogglePin,
  viewMode,
  workspace,
}: WorkspaceBoardItemProps) {
  const openTimerRef = useRef<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    return () => {
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (target instanceof Node && menuRef.current?.contains(target)) return
      setIsMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  const runMenuAction = (action: () => void) => {
    setIsMenuOpen(false)
    action()
  }

  const openInNewTab = () => {
    const query = new URLSearchParams()
    if (workspace?.id) query.set('workspace', workspace.id)
    const url = `/boards/${encodeURIComponent(board.id)}${query.toString() ? `?${query.toString()}` : ''}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openAfterSingleClick = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
      onRename()
      return
    }
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null
      onOpen()
    }, 180)
  }

  const renameFromDoubleClick = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    onRename()
  }

  return (
    <article
      className={`workspace-board-card ${viewMode === 'list' ? 'is-list' : ''}`}
      data-card-color={getBoardDisplayCardColor(board)}
      data-interactive={isInteractive ? 'true' : 'false'}
      data-menu-open={isMenuOpen ? 'true' : undefined}
      data-pinned={board.isPinned ? 'true' : undefined}
    >
      <div className="workspace-board-status-badges" aria-label="Board status">
        {board.isPinned ? <span className="workspace-board-pin-icon" aria-label="Pinned" title="Pinned" /> : null}
      </div>
      <button className="workspace-board-open" disabled={!isInteractive} onClick={onOpen} type="button">
        <BoardThumbnail board={board} />
      </button>
      <div className="workspace-board-body">
        {isEditing ? (
          <form className="workspace-board-rename" onSubmit={onSubmitRename}>
            <input autoFocus maxLength={80} onChange={(event) => onTitleChange(event.target.value)} value={editingTitle} />
            <button disabled={isPending} type="submit">Save</button>
            <button disabled={isPending} onClick={onCancelRename} type="button">Cancel</button>
          </form>
        ) : (
          <button
            className="workspace-board-title"
            disabled={!isInteractive}
            onClick={openAfterSingleClick}
            onDoubleClick={renameFromDoubleClick}
            type="button"
          >
            <strong>{board.title}</strong>
          </button>
        )}
        <div className="workspace-board-meta">
          <span>{formatObjectCount(board)}</span>
          <span>Saved {formatDateTime(board.savedAt)}</span>
        </div>
      </div>
      <div className="workspace-board-footer">
        <div className="workspace-board-members" aria-label="Collaborators">
          {collaborators.map((member) => (
            <span
              aria-label={member.label}
              className="workspace-board-member-avatar"
              key={member.id}
              title={member.label}
            >
              {member.initials}
            </span>
          ))}
        </div>
        <div className="workspace-board-actions">
          <button
            className="workspace-board-manage"
            disabled={!isInteractive}
            onClick={onOpenPanel}
            type="button"
          >
            Manage
          </button>
          <div className="workspace-board-menu" ref={menuRef}>
            <button
              aria-expanded={isMenuOpen}
              aria-label="Board actions"
              className="workspace-board-menu-trigger"
              disabled={!isInteractive}
              onClick={() => setIsMenuOpen((value) => !value)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
            {isMenuOpen ? (
              <div className="workspace-board-menu-popover">
                <WorkspaceBoardMenuAction disabled={isPending || !canShareBoard} icon="share" onClick={() => runMenuAction(onShare)}>Share link</WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending} icon="external" onClick={() => runMenuAction(openInNewTab)}>Open in new tab</WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending} icon="pin" onClick={() => runMenuAction(onTogglePin)}>
                  {board.isPinned ? 'Unpin board' : 'Pin board'}
                </WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending || !canManageBoard} icon="rename" onClick={() => runMenuAction(onRename)}>Rename</WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending || !canCopyBoard} icon="copy" onClick={() => runMenuAction(onCopy)}>Copy board</WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending || !canDeleteBoard} icon="delete" onClick={() => runMenuAction(onDelete)} tone="danger">Delete</WorkspaceBoardMenuAction>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

function formatObjectCount(board: BoardPersistenceSummary) {
  return `${board.shapeCount} shape${board.shapeCount === 1 ? '' : 's'} / ${board.assetCount} asset${board.assetCount === 1 ? '' : 's'}`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
