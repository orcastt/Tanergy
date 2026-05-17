'use client'

import type { FormEvent } from 'react'
import type { TangentSession, TangentWorkspace } from '@/features/auth/sessionTypes'
import { getPublicUserInitials, getPublicUserLabel } from '@/features/shared/publicUserDisplay'
import { WorkspaceBoardItem, type WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { getBoardCapabilities } from './boardCapabilities'

export type WorkspaceBoardDisplayItem = BoardPersistenceSummary & {
  isSynthetic?: boolean
}

type WorkspaceBoardSectionProps = {
  boards: WorkspaceBoardDisplayItem[]
  editingBoardId: null | string
  editingTitle: string
  hideHeader?: boolean
  pendingBoardId: null | string
  session: TangentSession
  showNewBoardTile: boolean
  viewMode: WorkspaceBoardViewMode
  workspace: TangentWorkspace
  onCancelRename: () => void
  onCopy: (board: WorkspaceBoardDisplayItem) => void
  onCreate: () => void
  onDelete: (board: WorkspaceBoardDisplayItem) => void
  onOpen: (boardId: string) => void
  onOpenPanel: (boardId: string) => void
  onRename: (board: WorkspaceBoardDisplayItem) => void
  onShare: (board: WorkspaceBoardDisplayItem) => void
  onSubmitRename: (event: FormEvent<HTMLFormElement>, boardId: string) => void
  onTitleChange: (title: string) => void
  onTogglePin: (board: WorkspaceBoardDisplayItem) => void
}

export function WorkspaceBoardSection({
  boards,
  editingBoardId,
  editingTitle,
  hideHeader = false,
  pendingBoardId,
  session,
  showNewBoardTile,
  viewMode,
  workspace,
  onCancelRename,
  onCopy,
  onCreate,
  onDelete,
  onOpen,
  onOpenPanel,
  onRename,
  onShare,
  onSubmitRename,
  onTitleChange,
  onTogglePin,
}: WorkspaceBoardSectionProps) {
  const sectionClasses = viewMode === 'gallery' ? 'workspace-board-grid' : 'workspace-board-list'

  return (
    <section className="boards-collection-section">
      {hideHeader ? null : (
        <header className="boards-collection-header">
          <div className="boards-collection-copy">
            <h2>{workspace.name}</h2>
          </div>
          {showNewBoardTile ? (
            <div className="boards-collection-actions">
              <button
                className="product-button product-button-secondary boards-collection-create-button"
                onClick={onCreate}
                type="button"
              >
                <span aria-hidden="true">+</span>
                <span>New board</span>
              </button>
            </div>
          ) : null}
        </header>
      )}
      {boards.length === 0 && !showNewBoardTile ? (
        <div className="boards-collection-empty">No boards</div>
      ) : (
        <div className={sectionClasses}>
          {boards.map((board) => {
            const capabilities = getBoardCapabilities(board, session)
            const collaborators = buildBoardCollaborators(board, workspace, session)
            return (
              <WorkspaceBoardItem
                board={board}
                canCopyBoard={capabilities.canCopyBoard}
                canDeleteBoard={capabilities.canDeleteBoard}
                canManageBoard={capabilities.canManageBoard}
                canShareBoard={capabilities.canShareBoard}
                collaborators={collaborators}
                editingTitle={editingTitle}
                isEditing={editingBoardId === board.id}
                isInteractive={board.isSynthetic !== true}
                isPending={pendingBoardId === board.id}
                key={board.id}
                onCancelRename={onCancelRename}
                onCopy={() => onCopy(board)}
                onDelete={() => onDelete(board)}
                onOpen={() => onOpen(board.id)}
                onOpenPanel={() => onOpenPanel(board.id)}
                onRename={() => onRename(board)}
                onShare={() => onShare(board)}
                onSubmitRename={(event) => onSubmitRename(event, board.id)}
                onTitleChange={onTitleChange}
                onTogglePin={() => onTogglePin(board)}
                viewMode={viewMode}
                workspace={workspace}
              />
            )
          })}
        </div>
      )}
      {hideHeader && showNewBoardTile ? (
        <div className="boards-collection-create-row">
          <button
            className="product-button product-button-secondary boards-collection-create-button"
            onClick={onCreate}
            type="button"
          >
            <span aria-hidden="true">+</span>
            <span>New board</span>
          </button>
        </div>
      ) : null}
    </section>
  )
}

export function buildBoardCollaborators(
  board: WorkspaceBoardDisplayItem,
  workspace: TangentWorkspace,
  session: TangentSession
) {
  const selfLabel = getPublicUserLabel({
    displayName: session.user.displayName,
    email: session.user.email,
    fallback: 'You',
    userId: session.user.id,
  })
  const ownerInitials = getPublicUserInitials({ fallback: 'Owner', userId: board.ownerId }) || 'OW'
  const workspaceInitials = getPublicUserInitials({ fallback: workspace.name || workspace.kind }) || 'WS'
  const currentUserInitials = getPublicUserInitials({
    displayName: session.user.displayName,
    email: session.user.email,
    fallback: 'You',
    userId: session.user.id,
  }) || 'YU'
  const ownerId = board.ownerId?.trim()

  return dedupeCollaborators([
    {
      id: `self-${session.user.id}`,
      initials: currentUserInitials,
      label: selfLabel === 'You' ? 'You' : `${selfLabel} (You)`,
    },
    ownerId && ownerId !== session.user.id
      ? { id: `owner-${board.id}-${ownerId}`, initials: ownerInitials, label: 'Owner' }
      : null,
    { id: `workspace-${workspace.id}`, initials: workspaceInitials, label: workspace.name },
  ])
}

function dedupeCollaborators(
  collaborators: Array<null | { id: string; initials: string; label: string }>
) {
  const seen = new Set<string>()
  return collaborators.filter((collaborator): collaborator is { id: string; initials: string; label: string } => {
    if (!collaborator?.id || seen.has(collaborator.id)) return false
    seen.add(collaborator.id)
    return true
  })
}
