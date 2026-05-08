'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import type { BoardCardColor } from '@/features/boards/boardTypes'
import type { BoardMetadataUpdateInput, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import {
  copyLocalBoardDocument,
  deleteLocalBoardDocument,
  ensureLocalBoardShareLink,
  listLocalBoardDocuments,
  loadLocalBoardDocument,
  renameLocalBoardDocument,
  saveLocalBoardDocument,
  updateLocalBoardMetadata,
} from '@/features/boards/localBoardClient'
import { migrateTldrawV1BoardToKonvaV2 } from '@/features/boards/tldrawToKonvaMigration'
import { getBoardCapabilities } from './boardCapabilities'
import { getShareUrl } from './boardMemberUtils'
import { WorkspaceBoardHeader } from './WorkspaceBoardHeader'
import { WorkspaceBoardPanelHost } from './WorkspaceBoardPanelHost'
import { WorkspaceBoardSection } from './WorkspaceBoardSection'
import { WorkspaceLoadingState } from './WorkspaceBoardStates'
import type { WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import { WorkspaceBoardToolbar, type WorkspaceBoardSortMode } from './WorkspaceBoardToolbar'
import {
  createBoardId,
  filterAndSortBoards,
  getBoardDisplayCardColor,
} from './workspaceBoardUtils'

type ViewMode = WorkspaceBoardViewMode
type SortMode = WorkspaceBoardSortMode

export function WorkspaceBoardGallery() {
  const router = useRouter()
  const { session } = useTangentSession()
  const [boards, setBoards] = useState<BoardPersistenceSummary[]>([])
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [panelBoardId, setPanelBoardId] = useState<string | null>(null)
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('opened')
  const [viewMode, setViewMode] = useState<ViewMode>('gallery')

  const workspaceSignature = useMemo(
    () => session.workspaces.map((workspace) => `${workspace.id}:${workspace.kind}:${workspace.planKey ?? ''}`).join('|'),
    [session.workspaces]
  )
  const workspaceById = useMemo(
    () => new Map(session.workspaces.map((workspace) => [workspace.id, workspace])),
    [session.workspaces]
  )

  const filteredBoards = useMemo(() => filterAndSortBoards(boards, searchQuery, sortMode), [boards, searchQuery, sortMode])
  const panelBoard = useMemo(
    () => boards.find((board) => board.id === panelBoardId) ?? null,
    [boards, panelBoardId]
  )

  const boardScopes = useMemo(
    () => createBoardScopes(session.workspaces, filteredBoards, searchQuery.trim().length > 0),
    [filteredBoards, searchQuery, session.workspaces]
  )

  const refreshBoards = useCallback(async () => {
    setIsLoading(true)
    try {
      const results = await Promise.allSettled(
        session.workspaces.map(async (workspace) => {
          const response = await listLocalBoardDocuments(workspace)
          return response.boards
        })
      )
      const nextBoards: BoardPersistenceSummary[] = []
      const failedWorkspaces: string[] = []

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          nextBoards.push(...result.value)
          return
        }
        failedWorkspaces.push(session.workspaces[index]?.name ?? 'Unknown')
      })

      setBoards(nextBoards)
      setError(failedWorkspaces.length > 0 ? `Some board spaces failed to load: ${failedWorkspaces.join(', ')}` : null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board list failed.')
    } finally {
      setIsLoading(false)
    }
  }, [session.workspaces])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshBoards()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [refreshBoards, workspaceSignature])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const getWorkspaceForBoard = useCallback((board: Pick<BoardPersistenceSummary, 'workspaceId'>) => (
    workspaceById.get(board.workspaceId) ?? null
  ), [workspaceById])

  const getWorkspaceForBoardId = useCallback((boardId: string) => {
    const board = boards.find((item) => item.id === boardId)
    return board ? getWorkspaceForBoard(board) : null
  }, [boards, getWorkspaceForBoard])

  const createBoard = (workspace?: TangentWorkspace) => {
    const query = new URLSearchParams({ new: '1' })
    if (workspace) query.set('workspace', workspace.id)
    router.push(`/boards/${encodeURIComponent(createBoardId())}?${query.toString()}`)
  }

  const openBoard = (boardId: string) => {
    const query = new URLSearchParams()
    const workspace = getWorkspaceForBoardId(boardId)
    if (workspace) query.set('workspace', workspace.id)
    router.push(`/boards/${encodeURIComponent(boardId)}${query.toString() ? `?${query.toString()}` : ''}`)
  }

  const getCapabilities = (board: BoardPersistenceSummary) => getBoardCapabilities(board, session)

  const startRename = (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canManageBoard) {
      setError('Only a Board owner or manager can rename this board.')
      return
    }
    setEditingBoardId(board.id)
    setEditingTitle(board.title)
    setError(null)
  }

  const cancelRename = () => {
    setEditingBoardId(null)
    setEditingTitle('')
  }

  const renameBoard = async (event: FormEvent<HTMLFormElement>, boardId: string) => {
    event.preventDefault()
    const title = editingTitle.trim()
    if (!title) {
      setError('Board title is required.')
      return
    }
    setPendingBoardId(boardId)
    setError(null)
    try {
      const response = await renameLocalBoardDocument(boardId, title, getWorkspaceForBoardId(boardId) ?? undefined)
      if (!response.board) throw new Error('Board rename failed.')
      setBoards((current) => current.map((board) => board.id === boardId ? response.board! : board))
      cancelRename()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board rename failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const deleteBoard = async (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canDeleteBoard) {
      setError('Only a Board owner or workspace manager can delete this board.')
      return
    }
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return
    setPendingBoardId(board.id)
    setError(null)
    try {
      await deleteLocalBoardDocument(board.id, getWorkspaceForBoard(board) ?? undefined)
      setBoards((current) => current.filter((item) => item.id !== board.id))
      if (editingBoardId === board.id) cancelRename()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board delete failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const copyBoard = async (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canCopyBoard) {
      setError('Only a Board owner or workspace manager can copy this board.')
      return
    }
    setPendingBoardId(board.id)
    setError(null)
    try {
      const response = await copyLocalBoardDocument(board.id, getWorkspaceForBoard(board) ?? undefined)
      if (!response.board) throw new Error('Board copy failed.')
      setBoards((current) => [response.board!, ...current])
      setNotice(`Copied "${board.title}".`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board copy failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const copyBoardToKonva = async (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canCopyBoard) {
      setError('Only a Board owner or workspace manager can copy this board.')
      return
    }
    setPendingBoardId(board.id)
    setError(null)
    try {
      const workspace = getWorkspaceForBoard(board)
      const source = await loadLocalBoardDocument(board.id, workspace ?? undefined)
      if (!source.board) throw new Error('Source Board was not found.')
      const nextBoardId = createBoardId()
      const nextTitle = `${board.title} Konva copy`
      const migrated = migrateTldrawV1BoardToKonvaV2(source.board.document, {
        boardId: nextBoardId,
        title: nextTitle,
      })
      const response = await saveLocalBoardDocument({
        boardId: nextBoardId,
        cardColor: getBoardDisplayCardColor(board),
        description: board.description,
        document: migrated.document,
        title: nextTitle,
      }, workspace ?? undefined)
      if (!response.board) throw new Error('Konva copy failed.')
      const metadata = await updateLocalBoardMetadata({
        boardId: nextBoardId,
        cardColor: getBoardDisplayCardColor(board),
        description: board.description,
        visibility: board.visibility ?? 'private',
      }, workspace ?? undefined)
      const copiedBoard = metadata.board ?? response.board
      setBoards((current) => [copiedBoard, ...current])
      setNotice(`Created Konva v2 copy with ${migrated.migratedShapeCount} migrated shapes.`)
      const query = new URLSearchParams()
      if (workspace) query.set('workspace', workspace.id)
      router.push(`/boards/${encodeURIComponent(nextBoardId)}${query.toString() ? `?${query.toString()}` : ''}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Konva copy failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const updateBoardMetadata = async (input: BoardMetadataUpdateInput) => {
    const sourceBoard = boards.find((board) => board.id === input.boardId)
    const workspace = sourceBoard ? getWorkspaceForBoard(sourceBoard) : null
    if (sourceBoard && !getCapabilities(sourceBoard).canManageBoard) {
      setError('Only a Board owner or manager can update this board.')
      return null
    }
    setPendingBoardId(input.boardId)
    setError(null)
    try {
      const response = await updateLocalBoardMetadata(input, workspace ?? undefined)
      if (!response.board) throw new Error('Board update failed.')
      setBoards((current) => current.map((board) => board.id === input.boardId ? response.board! : board))
      return response.board
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board update failed.')
      return null
    } finally {
      setPendingBoardId(null)
    }
  }

  const shareBoard = async (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canShareBoard) {
      setError('Only a Board owner or manager can share this board.')
      return
    }
    try {
      const response = await ensureLocalBoardShareLink(board.id, 'viewer', undefined, getWorkspaceForBoard(board) ?? undefined)
      const shareLink = response.shareLink
      if (!shareLink) throw new Error('Board share link failed.')
      setBoards((current) => current.map((item) => item.id === board.id ? { ...item, shareId: shareLink.shareId } : item))
      await navigator.clipboard?.writeText(getShareUrl(shareLink))
      setNotice('Link has been copied.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Share link is ready, but the browser blocked clipboard access.')
    }
  }

  const makeBoardPrivate = (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canManageBoard) {
      setError('Only a Board owner or manager can change this board visibility.')
      return
    }
    if (!window.confirm('Are you sure to make this board private? Only you will be able to use it until team permissions are enabled.')) return
    void updateBoardMetadata({ boardId: board.id, visibility: 'private' })
  }

  const makeBoardPublic = (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canManageBoard) {
      setError('Only a Board owner or manager can change this board visibility.')
      return
    }
    if (!window.confirm('Are you sure to make this board public? Team members will be able to access it once real permissions are enabled.')) return
    void updateBoardMetadata({ boardId: board.id, visibility: 'public' })
  }

  return (
    <div className="workspace-page">
      <WorkspaceBoardHeader />

      <WorkspaceBoardToolbar
        onSearchChange={setSearchQuery}
        onSortModeChange={setSortMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        sortMode={sortMode}
        viewMode={viewMode}
      />

      {error ? <div className="workspace-error" role="alert">{error}</div> : null}
      {notice ? <div className="workspace-toast" role="status">{notice}</div> : null}

      {isLoading ? (
        <WorkspaceLoadingState />
      ) : filteredBoards.length === 0 && searchQuery.trim() ? (
        <div className="workspace-empty-inline">No boards match your search.</div>
      ) : (
        <div className="boards-scope-stack">
          {boardScopes.map((scope) => (
            <section className="boards-scope-section" key={scope.id}>
              <header className="boards-scope-header">
                <h2>{scope.title}</h2>
              </header>
              <div className="boards-collections">
                {scope.sections.map(({ boards: sectionBoards, hideHeader, workspace }) => (
                  <WorkspaceBoardSection
                    boards={sectionBoards}
                    editingBoardId={editingBoardId}
                    editingTitle={editingTitle}
                    hideHeader={hideHeader}
                    key={workspace.id}
                    onCancelRename={cancelRename}
                    onCopy={(board) => void copyBoard(board)}
                    onCopyToKonva={(board) => void copyBoardToKonva(board)}
                    onCreate={() => createBoard(workspace)}
                    onDelete={(board) => void deleteBoard(board)}
                    onMakePrivate={makeBoardPrivate}
                    onMakePublic={makeBoardPublic}
                    onOpen={openBoard}
                    onOpenPanel={setPanelBoardId}
                    onRename={startRename}
                    onShare={(board) => void shareBoard(board)}
                    onSubmitRename={(event, boardId) => void renameBoard(event, boardId)}
                    onTitleChange={setEditingTitle}
                    onTogglePin={(board) => void updateBoardMetadata({ boardId: board.id, isPinned: !board.isPinned })}
                    onToggleStar={(board) => void updateBoardMetadata({ boardId: board.id, isStarred: !board.isStarred })}
                    pendingBoardId={pendingBoardId}
                    session={session}
                    showNewBoardTile={!searchQuery.trim()}
                    viewMode={viewMode}
                    workspace={workspace}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <WorkspaceBoardPanelHost
        board={panelBoard}
        isPending={panelBoard ? pendingBoardId === panelBoard.id : false}
        onBoardUpdated={(board) => setBoards((current) => current.map((item) => item.id === board.id ? board : item))}
        onClose={() => setPanelBoardId(null)}
        onCopy={(board) => void copyBoard(board)}
        onDelete={(board) => void deleteBoard(board)}
        onOpen={openBoard}
        onShare={(board) => void shareBoard(board)}
        session={session}
        setError={setError}
        setPendingBoardId={setPendingBoardId}
        workspace={panelBoard ? (workspaceById.get(panelBoard.workspaceId) ?? undefined) : undefined}
      />
    </div>
  )
}

function createBoardScopes(
  workspaces: TangentWorkspace[],
  boards: BoardPersistenceSummary[],
  hasSearch: boolean
) {
  const createScopeSections = (scopedWorkspaces: TangentWorkspace[], hideHeaderForSingle = false) => scopedWorkspaces
    .map((workspace) => {
      const workspaceBoards = boards
        .filter((board) => board.workspaceId === workspace.id)
        .map((board) => ({
          ...board,
          cardColor: board.cardColor ?? getWorkspaceDefaultCardColor(workspace),
        }))
      return {
        boards: workspaceBoards,
        hideHeader: hideHeaderForSingle && scopedWorkspaces.length === 1,
        workspace,
      }
    })
    .filter((section) => hasSearch ? section.boards.length > 0 : true)

  const privateWorkspaces = workspaces.filter((workspace) => workspace.kind === 'solo_workspace')
  const teamWorkspaces = workspaces.filter((workspace) => workspace.kind === 'team_workspace')
  const groupWorkspaces = workspaces.filter((workspace) => workspace.kind === 'group_workspace')

  return [
    {
      id: 'private',
      sections: createScopeSections(privateWorkspaces, true),
      title: 'Private',
    },
    {
      id: 'teams',
      sections: createScopeSections(teamWorkspaces),
      title: 'Team boards',
    },
    {
      id: 'groups',
      sections: createScopeSections(groupWorkspaces),
      title: 'Group boards',
    },
  ].filter((scope) => scope.sections.length > 0)
}

function getWorkspaceDefaultCardColor(workspace: TangentWorkspace): BoardCardColor {
  if (workspace.kind === 'solo_workspace') return 'mint'
  if (workspace.kind === 'team_workspace') return 'yellow'
  return 'peach'
}
