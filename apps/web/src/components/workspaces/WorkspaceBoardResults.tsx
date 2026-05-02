'use client'

import type { FormEvent } from 'react'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { WorkspaceBoardItem, type WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import { NewBoardTile, WorkspaceEmptyState, WorkspaceLoadingState } from './WorkspaceBoardStates'

type WorkspaceBoardResultsProps = {
  boards: BoardPersistenceSummary[]
  editingBoardId: string | null
  editingTitle: string
  filteredBoards: BoardPersistenceSummary[]
  hasMoreBoards: boolean
  isLoading: boolean
  pendingBoardId: string | null
  viewMode: WorkspaceBoardViewMode
  visibleBoards: BoardPersistenceSummary[]
  onCancelRename: () => void
  onCopy: (board: BoardPersistenceSummary) => void
  onCreate: () => void
  onDelete: (board: BoardPersistenceSummary) => void
  onLoadMore: () => void
  onMakePrivate: (board: BoardPersistenceSummary) => void
  onMakePublic: (board: BoardPersistenceSummary) => void
  onOpen: (boardId: string) => void
  onOpenPanel: (boardId: string) => void
  onRename: (board: BoardPersistenceSummary) => void
  onShare: (board: BoardPersistenceSummary) => void
  onSubmitRename: (event: FormEvent<HTMLFormElement>, boardId: string) => void
  onTitleChange: (title: string) => void
  onTogglePin: (board: BoardPersistenceSummary) => void
  onToggleStar: (board: BoardPersistenceSummary) => void
}

export function WorkspaceBoardResults({
  boards,
  editingBoardId,
  editingTitle,
  filteredBoards,
  hasMoreBoards,
  isLoading,
  pendingBoardId,
  viewMode,
  visibleBoards,
  onCancelRename,
  onCopy,
  onCreate,
  onDelete,
  onLoadMore,
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
}: WorkspaceBoardResultsProps) {
  if (isLoading) return <WorkspaceLoadingState />
  if (boards.length === 0) return <WorkspaceEmptyState onCreate={onCreate} />
  if (filteredBoards.length === 0) return <div className="workspace-empty-inline">No boards match your search.</div>

  return (
    <>
      <section className={viewMode === 'gallery' ? 'workspace-board-grid' : 'workspace-board-list'} aria-label="Workspace boards">
        <NewBoardTile onCreate={onCreate} viewMode={viewMode} />
        {visibleBoards.map((board) => (
          <WorkspaceBoardItem
            board={board}
            editingTitle={editingTitle}
            isEditing={editingBoardId === board.id}
            isPending={pendingBoardId === board.id}
            key={board.id}
            onCancelRename={onCancelRename}
            onCopy={() => onCopy(board)}
            onDelete={() => onDelete(board)}
            onMakePrivate={() => onMakePrivate(board)}
            onMakePublic={() => onMakePublic(board)}
            onOpen={() => onOpen(board.id)}
            onOpenPanel={() => onOpenPanel(board.id)}
            onRename={() => onRename(board)}
            onShare={() => onShare(board)}
            onSubmitRename={(event) => onSubmitRename(event, board.id)}
            onTitleChange={onTitleChange}
            onTogglePin={() => onTogglePin(board)}
            onToggleStar={() => onToggleStar(board)}
            viewMode={viewMode}
          />
        ))}
      </section>
      <div className="workspace-pagination" aria-label="Board pagination">
        <span>Showing {visibleBoards.length} of {filteredBoards.length} boards</span>
        {hasMoreBoards ? (
          <button className="product-button product-button-secondary" onClick={onLoadMore} type="button">
            Load more
          </button>
        ) : null}
      </div>
    </>
  )
}
