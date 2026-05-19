'use client'

import { WorkspaceBoardHeader } from './WorkspaceBoardHeader'
import { WorkspaceBoardLimitDialog } from './WorkspaceBoardLimitDialog'
import { WorkspaceBoardPanelHost } from './WorkspaceBoardPanelHost'
import { WorkspaceBoardSection } from './WorkspaceBoardSection'
import { WorkspaceLoadingState } from './WorkspaceBoardStates'
import { WorkspaceBoardToolbar } from './WorkspaceBoardToolbar'
import { canCreateWorkspaceBoards } from './boardCapabilities'
import { useWorkspaceBoardGalleryRuntime } from './useWorkspaceBoardGalleryRuntime'

export function WorkspaceBoardGallery() {
  const gallery = useWorkspaceBoardGalleryRuntime()

  return (
    <div className="workspace-page">
      <WorkspaceBoardHeader />

      <WorkspaceBoardToolbar
        onSearchChange={gallery.setSearchQuery}
        onSortModeChange={gallery.setSortMode}
        onViewModeChange={gallery.setViewMode}
        searchQuery={gallery.searchQuery}
        sortMode={gallery.sortMode}
        viewMode={gallery.viewMode}
      />

      {gallery.error ? <div className="workspace-error" role="alert">{gallery.error}</div> : null}
      {gallery.notice ? <div className="workspace-toast" role="status">{gallery.notice}</div> : null}
      {gallery.isRefreshing && gallery.boards.length > 0 ? (
        <div className="workspace-empty-inline" role="status">Refreshing boards…</div>
      ) : null}
      {gallery.limitDialog ? (
        <WorkspaceBoardLimitDialog
          notice={gallery.limitDialog}
          onClose={() => gallery.setLimitDialog(null)}
          onOpenBilling={gallery.openBilling}
        />
      ) : null}

      {gallery.sessionStatus === 'error' ? (
        <div className="workspace-error" role="alert">
          {gallery.sessionError ?? 'Workspace session failed to load.'}
        </div>
      ) : gallery.sessionStatus === 'loading' || (gallery.isLoading && gallery.boards.length === 0) ? (
        <WorkspaceLoadingState />
      ) : gallery.filteredBoards.length === 0 && gallery.searchQuery.trim() ? (
        <div className="workspace-empty-inline">No boards match your search.</div>
      ) : (
        <div className="boards-scope-stack">
          {gallery.boardScopes.map((scope) => (
            <section className="boards-scope-section" key={scope.id}>
              <header className="boards-scope-header">
                <h2>{scope.title}</h2>
              </header>
              <div className="boards-collections">
                {scope.sections.map(({ boards, hideHeader, workspace }) => (
                  <WorkspaceBoardSection
                    boards={boards}
                    editingBoardId={gallery.editingBoardId}
                    editingTitle={gallery.editingTitle}
                    hideHeader={hideHeader}
                    key={workspace.id}
                    onCancelRename={gallery.cancelRename}
                    onCopy={(board) => void gallery.copyBoard(board)}
                    onCreate={() => void gallery.createBoard(workspace)}
                    onDelete={(board) => void gallery.deleteBoard(board)}
                    onOpen={gallery.openBoard}
                    onOpenPanel={gallery.setPanelBoardId}
                    onRename={gallery.startRename}
                    onShare={(board) => void gallery.shareBoard(board)}
                    onSubmitRename={(event, boardId) => void gallery.renameBoard(event, boardId)}
                    onTitleChange={gallery.setEditingTitle}
                    onTogglePin={(board) => void gallery.updateBoard({ boardId: board.id, isPinned: !board.isPinned })}
                    pendingBoardId={gallery.pendingBoardId}
                    session={gallery.session}
                    showNewBoardTile={!gallery.searchQuery.trim() && canCreateWorkspaceBoards(workspace)}
                    viewMode={gallery.viewMode}
                    workspace={workspace}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <WorkspaceBoardPanelHost
        board={gallery.panelBoard}
        isPending={gallery.panelBoard ? gallery.pendingBoardId === gallery.panelBoard.id : false}
        onBoardUpdated={gallery.updateBoardInState}
        onClose={() => gallery.setPanelBoardId(null)}
        onCopy={(board, workspace) => void gallery.copyBoard(board, { source: 'panel', workspace })}
        onDelete={(board) => void gallery.deleteBoard(board)}
        onOpen={gallery.openBoard}
        onShare={(board) => void gallery.shareBoard(board)}
        session={gallery.session}
        setError={gallery.setError}
        setPendingBoardId={gallery.setPendingBoardId}
        workspace={gallery.panelBoardWorkspace}
      />
    </div>
  )
}
