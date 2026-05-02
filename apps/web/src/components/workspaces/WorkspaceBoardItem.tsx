'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BoardThumbnail } from '@/components/boards/BoardThumbnail'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { WorkspaceBoardMenuAction } from './WorkspaceBoardMenuAction'
import { getBoardDisplayCardColor } from './workspaceBoardUtils'

export type WorkspaceBoardViewMode = 'gallery' | 'list'

type WorkspaceBoardItemProps = {
  board: BoardPersistenceSummary
  editingTitle: string
  isEditing: boolean
  isPending: boolean
  onCancelRename: () => void
  onCopy: () => void
  onDelete: () => void
  onMakePrivate: () => void
  onMakePublic: () => void
  onOpen: () => void
  onOpenPanel: () => void
  onRename: () => void
  onShare: () => void
  onSubmitRename: (event: FormEvent<HTMLFormElement>) => void
  onTitleChange: (title: string) => void
  onTogglePin: () => void
  onToggleStar: () => void
  viewMode: WorkspaceBoardViewMode
}

export function WorkspaceBoardItem({
  board,
  editingTitle,
  isEditing,
  isPending,
  onCancelRename,
  onCopy,
  onDelete,
  onMakePrivate,
  onMakePublic,
  onOpen,
  onOpenPanel,
  onRename,
  onShare,
  onSubmitRename,
  onTitleChange,
  onTogglePin,
  onToggleStar,
  viewMode,
}: WorkspaceBoardItemProps) {
  const collaborators = getCollaborators(board.id)
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
    window.open(`/boards/${encodeURIComponent(board.id)}`, '_blank', 'noopener,noreferrer')
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
      data-pinned={board.isPinned ? 'true' : undefined}
    >
      <div className="workspace-board-status-badges" aria-label="Board status">
        {board.isPinned ? <span className="workspace-board-pin-icon" aria-label="Pinned" title="Pinned" /> : null}
        <span
          className="workspace-board-visibility-icon"
          data-visibility={board.visibility === 'public' ? 'public' : 'private'}
          aria-label={board.visibility === 'public' ? 'Public board' : 'Private board'}
          title={board.visibility === 'public' ? 'Public' : 'Private'}
        >
          {board.visibility === 'public' ? <PublicBoardIcon /> : <PrivateBoardIcon />}
        </span>
      </div>
      <button className="workspace-board-open" onClick={onOpen} type="button">
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
          <button className="workspace-board-title" onClick={openAfterSingleClick} onDoubleClick={renameFromDoubleClick} type="button">
            <strong>{board.title}</strong>
            <small>{board.id}</small>
          </button>
        )}
        <div className="workspace-board-meta">
          {board.description ? <span>{board.description}</span> : null}
          <span>{formatObjectCount(board)}</span>
          <span>{formatActivityTime(board)}</span>
          <span>Saved {formatDateTime(board.savedAt)}</span>
        </div>
      </div>
      <div className="workspace-board-footer">
        <div className="workspace-board-members" aria-label="Collaborators">
          {collaborators.map((member) => <span key={member}>{member}</span>)}
          <span>+2</span>
        </div>
        <div className="workspace-board-actions">
          <button aria-label="Open board management" onClick={onOpenPanel} title="Board management" type="button">Manage</button>
          <div className="workspace-board-menu" ref={menuRef}>
            <button
              aria-expanded={isMenuOpen}
              aria-label="Board actions"
              className="workspace-board-menu-trigger"
              onClick={() => setIsMenuOpen((value) => !value)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
            {isMenuOpen ? (
              <div className="workspace-board-menu-popover">
                <WorkspaceBoardMenuAction disabled={isPending} icon="share" onClick={() => runMenuAction(onShare)}>Share link</WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending} icon="external" onClick={() => runMenuAction(openInNewTab)}>Open in new tab</WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending} icon="star" onClick={() => runMenuAction(onToggleStar)}>
                  {board.isStarred ? 'Unstar board' : 'Star this board'}
                </WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending} icon="pin" onClick={() => runMenuAction(onTogglePin)}>
                  {board.isPinned ? 'Unpin board' : 'Pin board'}
                </WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending} icon="rename" onClick={() => runMenuAction(onRename)}>Rename</WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending} icon="copy" onClick={() => runMenuAction(onCopy)}>Copy board</WorkspaceBoardMenuAction>
                <WorkspaceBoardMenuAction disabled={isPending} icon="manage" onClick={() => runMenuAction(onOpenPanel)}>Manage board</WorkspaceBoardMenuAction>
                {board.visibility === 'public' ? (
                  <WorkspaceBoardMenuAction disabled={isPending} icon="private" onClick={() => runMenuAction(onMakePrivate)}>Make board private</WorkspaceBoardMenuAction>
                ) : (
                  <WorkspaceBoardMenuAction disabled={isPending} icon="public" onClick={() => runMenuAction(onMakePublic)}>Make board public</WorkspaceBoardMenuAction>
                )}
                <WorkspaceBoardMenuAction disabled={isPending} icon="delete" onClick={() => runMenuAction(onDelete)} tone="danger">Delete</WorkspaceBoardMenuAction>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

function PrivateBoardIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20">
      <circle cx="10" cy="7.1" r="2.35" />
      <path d="M5.9 15.1c.7-2.45 2.1-3.65 4.1-3.65s3.4 1.2 4.1 3.65" />
    </svg>
  )
}

function PublicBoardIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20">
      <circle cx="7.8" cy="7.4" r="2.05" />
      <path d="M4.1 15.15c.62-2.25 1.86-3.35 3.7-3.35 1.82 0 3.08 1.1 3.7 3.35" />
      <circle cx="13.2" cy="7.9" r="1.75" />
      <path d="M11.9 12.15c1.92.18 3.12 1.18 3.62 3" />
    </svg>
  )
}

function formatObjectCount(board: BoardPersistenceSummary) {
  return `${board.shapeCount} shape${board.shapeCount === 1 ? '' : 's'} / ${board.assetCount} asset${board.assetCount === 1 ? '' : 's'}`
}

function formatActivityTime(board: BoardPersistenceSummary) {
  if (!board.lastOpenedAt) return 'Not opened yet'
  return `Opened ${formatDateTime(board.lastOpenedAt)}`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getCollaborators(seed: string) {
  const names = ['A', 'J', 'M', 'R', 'S', 'T']
  const start = getStableIndex(seed, names.length)
  return [names[start], names[(start + 2) % names.length]]
}

function getStableIndex(value: string, modulo: number) {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % modulo
}
