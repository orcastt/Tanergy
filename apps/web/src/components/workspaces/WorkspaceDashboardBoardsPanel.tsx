'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import type { TangentSession, TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardMetadataUpdateInput, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import {
  copyLocalBoardDocument,
  deleteLocalBoardDocument,
  ensureLocalBoardShareLink,
  updateLocalBoardMetadata,
} from '@/features/boards/localBoardClient'
import { getShareUrl } from './boardMemberUtils'
import { WorkspaceBoardPanelHost } from './WorkspaceBoardPanelHost'
import { WorkspaceBoardSection } from './WorkspaceBoardSection'
import type { WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import { getBoardCapabilities } from './boardCapabilities'

type WorkspaceDashboardBoardsPanelProps = {
  boards: BoardPersistenceSummary[]
  onWorkspaceRefresh: () => void
  session: TangentSession
  viewMode: WorkspaceBoardViewMode
  workspace: TangentWorkspace
}

export function WorkspaceDashboardBoardsPanel({
  boards,
  onWorkspaceRefresh,
  session,
  viewMode,
  workspace,
}: WorkspaceDashboardBoardsPanelProps) {
  const router = useRouter()
  const [displayBoards, setDisplayBoards] = useState(boards)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [panelBoardId, setPanelBoardId] = useState<string | null>(null)
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null)

  const panelBoard = useMemo(
    () => displayBoards.find((board) => board.id === panelBoardId) ?? null,
    [displayBoards, panelBoardId],
  )

  return (
    <section className="workspace-detail-panel workspace-detail-board-panel">
      {error ? <p className="workspace-detail-status" role="alert">{error}</p> : null}
      {notice ? <p className="workspace-detail-status" role="status">{notice}</p> : null}

      <WorkspaceBoardSection
        boards={displayBoards}
        editingBoardId={editingBoardId}
        editingTitle={editingTitle}
        hideHeader
        pendingBoardId={pendingBoardId}
        session={session}
        showNewBoardTile={false}
        viewMode={viewMode}
        workspace={workspace}
        onCancelRename={cancelRename}
        onCopy={(board) => void copyBoard(board)}
        onCreate={() => undefined}
        onDelete={(board) => void deleteBoard(board)}
        onOpen={openBoard}
        onOpenPanel={setPanelBoardId}
        onRename={startRename}
        onShare={(board) => void shareBoard(board)}
        onSubmitRename={(event, boardId) => void renameBoard(event, boardId)}
        onTitleChange={setEditingTitle}
        onTogglePin={(board) => void updateBoardMetadata({ boardId: board.id, isPinned: !board.isPinned })}
      />

      <WorkspaceBoardPanelHost
        board={panelBoard}
        isPending={panelBoard ? pendingBoardId === panelBoard.id : false}
        onBoardUpdated={(board) => setDisplayBoards((current) => current.map((item) => item.id === board.id ? board : item))}
        onClose={() => setPanelBoardId(null)}
        onCopy={(board, workspaceArg) => void copyBoard(board, workspaceArg)}
        onDelete={(board) => void deleteBoard(board)}
        onOpen={openBoard}
        onShare={(board) => void shareBoard(board)}
        session={session}
        setError={setError}
        setPendingBoardId={setPendingBoardId}
        workspace={workspace}
      />
    </section>
  )

  function startRename(board: BoardPersistenceSummary) {
    const capabilities = getBoardCapabilities(board, session)
    if (!capabilities.canManageBoard) {
      setError('Only a Board owner or manager can rename this board.')
      return
    }
    setEditingBoardId(board.id)
    setEditingTitle(board.title)
    setError(null)
  }

  function cancelRename() {
    setEditingBoardId(null)
    setEditingTitle('')
  }

  function openBoard(boardId: string) {
    const query = new URLSearchParams({ workspace: workspace.id })
    router.push(`/boards/${encodeURIComponent(boardId)}?${query.toString()}`)
  }

  async function renameBoard(event: FormEvent<HTMLFormElement>, boardId: string) {
    event.preventDefault()
    const title = editingTitle.trim()
    if (!title) {
      setError('Board title is required.')
      return
    }
    setPendingBoardId(boardId)
    setError(null)
    try {
      const response = await updateLocalBoardMetadata({ boardId, title }, workspace)
      if (!response.board) throw new Error('Board rename failed.')
      setDisplayBoards((current) => current.map((board) => board.id === boardId ? response.board! : board))
      cancelRename()
      requestCurrentSessionRefresh()
      onWorkspaceRefresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board rename failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  async function updateBoardMetadata(input: BoardMetadataUpdateInput) {
    const board = displayBoards.find((item) => item.id === input.boardId)
    if (!board) return null
    const capabilities = getBoardCapabilities(board, session)
    if (!capabilities.canManageBoard) {
      setError('Only a Board owner or manager can update this board.')
      return null
    }
    setPendingBoardId(input.boardId)
    setError(null)
    try {
      const response = await updateLocalBoardMetadata(input, workspace)
      if (!response.board) throw new Error('Board update failed.')
      setDisplayBoards((current) => current.map((item) => item.id === input.boardId ? response.board! : item))
      requestCurrentSessionRefresh()
      onWorkspaceRefresh()
      return response.board
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board update failed.')
      return null
    } finally {
      setPendingBoardId(null)
    }
  }

  async function deleteBoard(board: BoardPersistenceSummary) {
    const capabilities = getBoardCapabilities(board, session)
    if (!capabilities.canDeleteBoard) {
      setError('Only the board owner can delete this board.')
      return
    }
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return
    setPendingBoardId(board.id)
    setError(null)
    try {
      await deleteLocalBoardDocument(board.id, workspace)
      setDisplayBoards((current) => current.filter((item) => item.id !== board.id))
      requestCurrentSessionRefresh()
      onWorkspaceRefresh()
      if (editingBoardId === board.id) cancelRename()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board delete failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  async function copyBoard(board: BoardPersistenceSummary, workspaceArg?: TangentWorkspace) {
    const capabilities = getBoardCapabilities(board, session)
    if (!capabilities.canCopyBoard) {
      setError('Only the board owner can copy this board.')
      return
    }
    setPendingBoardId(board.id)
    setError(null)
    try {
      const response = await copyLocalBoardDocument(board.id, workspaceArg ?? workspace)
      if (!response.board) throw new Error('Board copy failed.')
      setDisplayBoards((current) => [response.board!, ...current])
      requestCurrentSessionRefresh()
      onWorkspaceRefresh()
      setNotice(`Copied "${board.title}".`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board copy failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  async function shareBoard(board: BoardPersistenceSummary) {
    const capabilities = getBoardCapabilities(board, session)
    if (!capabilities.canShareBoard) {
      setError('Board share links are only available in Team or Group workspaces.')
      return
    }
    try {
      const response = await ensureLocalBoardShareLink(board.id, 'viewer', undefined, workspace)
      if (!response.shareLink) throw new Error('Board share link failed.')
      setDisplayBoards((current) => current.map((item) => item.id === board.id ? { ...item, shareId: response.shareLink?.shareId } : item))
      await navigator.clipboard?.writeText(getShareUrl(response.shareLink))
      setNotice('Link has been copied.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Share link is ready, but the browser blocked clipboard access.')
    }
  }
}
