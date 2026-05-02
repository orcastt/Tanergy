'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BoardThumbnail } from '@/components/boards/BoardThumbnail'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

export type WorkspaceBoardViewMode = 'gallery' | 'list'

type WorkspaceBoardItemProps = {
  board: BoardPersistenceSummary
  editingTitle: string
  isEditing: boolean
  isPending: boolean
  onCancelRename: () => void
  onCopy: () => void
  onDelete: () => void
  onOpen: () => void
  onRename: () => void
  onSubmitRename: (event: FormEvent<HTMLFormElement>) => void
  onTitleChange: (title: string) => void
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
  onOpen,
  onRename,
  onSubmitRename,
  onTitleChange,
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
    <article className={`workspace-board-card ${viewMode === 'list' ? 'is-list' : ''}`}>
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
          <button aria-label="Open panel settings" onClick={onOpen} title="Panel settings" type="button">Panel</button>
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
                <button disabled={isPending} onClick={() => runMenuAction(onRename)} type="button">Rename</button>
                <button disabled={isPending} onClick={() => runMenuAction(onCopy)} type="button">Copy board</button>
                <button disabled={isPending} onClick={() => runMenuAction(onDelete)} type="button">Delete</button>
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
