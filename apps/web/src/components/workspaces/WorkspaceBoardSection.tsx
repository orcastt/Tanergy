'use client'

import type { FormEvent } from 'react'
import type { TangentSession, TangentWorkspace } from '@/features/auth/sessionTypes'
import { WorkspaceBoardItem, type WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import { NewBoardTile } from './WorkspaceBoardStates'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { getBoardCapabilities } from './boardCapabilities'
import { getInitials } from './boardMemberUtils'

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
  onCopyToKonva: (board: WorkspaceBoardDisplayItem) => void
  onCreate: () => void
  onDelete: (board: WorkspaceBoardDisplayItem) => void
  onMakePrivate: (board: WorkspaceBoardDisplayItem) => void
  onMakePublic: (board: WorkspaceBoardDisplayItem) => void
  onOpen: (boardId: string) => void
  onOpenPanel: (boardId: string) => void
  onRename: (board: WorkspaceBoardDisplayItem) => void
  onShare: (board: WorkspaceBoardDisplayItem) => void
  onSubmitRename: (event: FormEvent<HTMLFormElement>, boardId: string) => void
  onTitleChange: (title: string) => void
  onTogglePin: (board: WorkspaceBoardDisplayItem) => void
  onToggleStar: (board: WorkspaceBoardDisplayItem) => void
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
  onCopyToKonva,
  onCreate,
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
}: WorkspaceBoardSectionProps) {
  const sectionClasses = viewMode === 'gallery' ? 'workspace-board-grid' : 'workspace-board-list'

  return (
    <section className="boards-collection-section">
      {hideHeader ? null : (
        <header className="boards-collection-header">
          <div className="boards-collection-copy">
            <h2>{workspace.name}</h2>
          </div>
        </header>
      )}

      {boards.length === 0 && !showNewBoardTile ? (
        <div className="boards-collection-empty">No boards</div>
      ) : (
        <div className={sectionClasses}>
          {showNewBoardTile ? <NewBoardTile onCreate={onCreate} viewMode={viewMode} /> : null}
          {boards.map((board) => {
            const capabilities = getBoardCapabilities(board, session)
            const collaborators = buildBoardCollaborators(board, workspace, session)
            return (
              <WorkspaceBoardItem
                board={board}
                canCopyBoard={capabilities.canCopyBoard}
                canDeleteBoard={capabilities.canDeleteBoard}
                canManageBoard={capabilities.canManageBoard}
                collaborators={collaborators}
                editingTitle={editingTitle}
                isEditing={editingBoardId === board.id}
                isInteractive={board.isSynthetic !== true}
                isPending={pendingBoardId === board.id}
                key={board.id}
                onCancelRename={onCancelRename}
                onCopy={() => onCopy(board)}
                onCopyToKonva={() => onCopyToKonva(board)}
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
                workspace={workspace}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function buildBoardCollaborators(
  board: WorkspaceBoardDisplayItem,
  workspace: TangentWorkspace,
  session: TangentSession
) {
  const ownerInitials = getInitials(board.ownerId || 'Owner') || 'OW'
  const workspaceInitials = getInitials(workspace.name || workspace.kind) || 'WS'
  const currentUserInitials = session.user.avatarInitials || getInitials(session.user.displayName || session.user.id) || 'YU'

  return [
    { id: `self-${session.user.id}`, initials: currentUserInitials, label: `${session.user.displayName} (You)` },
    { id: `owner-${board.ownerId}`, initials: ownerInitials, label: `Owner ${board.ownerId}` },
    { id: `workspace-${workspace.id}`, initials: workspaceInitials, label: workspace.name },
  ]
}
