'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardMetadataUpdateInput, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import {
  copyLocalBoardDocument,
  deleteLocalBoardDocument,
  ensureLocalBoardShareLink,
  renameLocalBoardDocument,
  updateLocalBoardMetadata,
} from '@/features/boards/localBoardClient'
import { getBoardCapabilities } from './boardCapabilities'
import { getShareUrl } from './boardMemberUtils'
import type { WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import type { WorkspaceBoardSortMode } from './WorkspaceBoardToolbar'
import {
  describeWorkspaceBoardLimitError,
  resolveWorkspaceBoardLimitDialog,
  type WorkspaceBoardLimitDialogState,
} from './workspaceBoardPlanLimits'
import { createBoardId } from './workspaceBoardUtils'
import { useWorkspaceBoardGalleryData } from './useWorkspaceBoardGalleryData'

type ViewMode = WorkspaceBoardViewMode
type SortMode = WorkspaceBoardSortMode

export function useWorkspaceBoardGalleryRuntime() {
  const router = useRouter()
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [limitDialog, setLimitDialog] = useState<WorkspaceBoardLimitDialogState | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [panelBoardId, setPanelBoardId] = useState<string | null>(null)
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('opened')
  const [viewMode, setViewMode] = useState<ViewMode>('gallery')
  const data = useWorkspaceBoardGalleryData({ panelBoardId, searchQuery, sortMode })

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const getWorkspaceForBoard = useCallback((board: Pick<BoardPersistenceSummary, 'workspaceId'>) => (
    data.workspaceById.get(board.workspaceId) ?? null
  ), [data.workspaceById])

  const getWorkspaceForBoardId = useCallback((boardId: string) => {
    const board = data.boards.find((item) => item.id === boardId)
    return board ? getWorkspaceForBoard(board) : null
  }, [data.boards, getWorkspaceForBoard])

  const openBoardLimitDialog = useCallback(async (
    workspace: TangentWorkspace,
    action: 'copy' | 'create',
    fallbackMessage?: string,
  ) => {
    const nextDialog = await resolveWorkspaceBoardLimitDialog(workspace, data.boards, data.loadedWorkspaceIdSet, action)
      ?? (fallbackMessage ? describeWorkspaceBoardLimitError(workspace, fallbackMessage, action) : null)
    if (!nextDialog) return false
    data.setError(null)
    setLimitDialog(nextDialog)
    return true
  }, [data])

  const createBoard = async (workspace?: TangentWorkspace) => {
    const targetWorkspace = workspace ?? data.session.activeWorkspace
    if (targetWorkspace && await openBoardLimitDialog(targetWorkspace, 'create')) return
    data.setError(null)
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

  const getCapabilities = (board: BoardPersistenceSummary) => getBoardCapabilities(board, data.session)

  const startRename = (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canManageBoard) {
      data.setError('Only a Board owner or manager can rename this board.')
      return
    }
    setEditingBoardId(board.id)
    setEditingTitle(board.title)
    data.setError(null)
  }

  const cancelRename = () => {
    setEditingBoardId(null)
    setEditingTitle('')
  }

  const renameBoard = async (event: FormEvent<HTMLFormElement>, boardId: string) => {
    event.preventDefault()
    const title = editingTitle.trim()
    if (!title) {
      data.setError('Board title is required.')
      return
    }
    setPendingBoardId(boardId)
    data.setError(null)
    try {
      const response = await renameLocalBoardDocument(boardId, title, getWorkspaceForBoardId(boardId) ?? undefined)
      if (!response.board) throw new Error('Board rename failed.')
      data.setBoards((current) => current.map((board) => board.id === boardId ? response.board! : board))
      cancelRename()
    } catch (nextError) {
      data.setError(nextError instanceof Error ? nextError.message : 'Board rename failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const deleteBoard = async (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canDeleteBoard) {
      data.setError('Only the board owner can delete this board.')
      return
    }
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return
    setPendingBoardId(board.id)
    data.setError(null)
    try {
      await deleteLocalBoardDocument(board.id, getWorkspaceForBoard(board) ?? undefined)
      data.setBoards((current) => current.filter((item) => item.id !== board.id))
      requestCurrentSessionRefresh()
      if (editingBoardId === board.id) cancelRename()
      if (panelBoardId === board.id) setPanelBoardId(null)
    } catch (nextError) {
      data.setError(nextError instanceof Error ? nextError.message : 'Board delete failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const copyBoard = async (
    board: BoardPersistenceSummary,
    options: { source?: 'panel' | 'section'; workspace?: TangentWorkspace | null } = {},
  ) => {
    if (!getCapabilities(board).canCopyBoard) {
      data.setError('Only the board owner can copy this board.')
      return
    }
    const workspace = options.workspace ?? getWorkspaceForBoard(board)
    const closePanelIfNeeded = () => {
      if (options.source === 'panel') setPanelBoardId(null)
    }
    if (workspace && await openBoardLimitDialog(workspace, 'copy')) {
      closePanelIfNeeded()
      return
    }
    setPendingBoardId(board.id)
    data.setError(null)
    try {
      const response = await copyLocalBoardDocument(board.id, workspace ?? undefined)
      if (!response.board) throw new Error('Board copy failed.')
      data.setBoards((current) => [response.board!, ...current])
      requestCurrentSessionRefresh()
      setNotice(`Copied "${board.title}".`)
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Board copy failed.'
      if (workspace && await openBoardLimitDialog(workspace, 'copy', message)) {
        closePanelIfNeeded()
        return
      }
      data.setError(message)
    } finally {
      setPendingBoardId(null)
    }
  }

  const updateBoard = async (input: BoardMetadataUpdateInput) => {
    const sourceBoard = data.boards.find((board) => board.id === input.boardId)
    const workspace = sourceBoard ? getWorkspaceForBoard(sourceBoard) : null
    if (sourceBoard && !getCapabilities(sourceBoard).canManageBoard) {
      data.setError('Only a Board owner or manager can update this board.')
      return null
    }
    setPendingBoardId(input.boardId)
    data.setError(null)
    try {
      const response = await updateLocalBoardMetadata(input, workspace ?? undefined)
      if (!response.board) throw new Error('Board update failed.')
      data.setBoards((current) => current.map((board) => board.id === input.boardId ? response.board! : board))
      return response.board
    } catch (nextError) {
      data.setError(nextError instanceof Error ? nextError.message : 'Board update failed.')
      return null
    } finally {
      setPendingBoardId(null)
    }
  }

  const shareBoard = async (board: BoardPersistenceSummary) => {
    if (!getCapabilities(board).canShareBoard) {
      data.setError('Board share links are only available in Team or Group workspaces.')
      return
    }
    try {
      const response = await ensureLocalBoardShareLink(board.id, 'viewer', undefined, getWorkspaceForBoard(board) ?? undefined)
      const shareLink = response.shareLink
      if (!shareLink) throw new Error('Board share link failed.')
      data.setBoards((current) => current.map((item) => item.id === board.id ? { ...item, shareId: shareLink.shareId } : item))
      await navigator.clipboard?.writeText(getShareUrl(shareLink))
      setNotice('Link has been copied.')
    } catch (nextError) {
      data.setError(nextError instanceof Error ? nextError.message : 'Share link is ready, but the browser blocked clipboard access.')
    }
  }

  const panelBoardWorkspace = useMemo(
    () => (data.panelBoard ? (data.workspaceById.get(data.panelBoard.workspaceId) ?? undefined) : undefined),
    [data.panelBoard, data.workspaceById],
  )

  return {
    ...data,
    cancelRename,
    copyBoard,
    createBoard,
    deleteBoard,
    editingBoardId,
    editingTitle,
    limitDialog,
    notice,
    openBilling: () => {
      setLimitDialog(null)
      router.push('/billing')
    },
    openBoard,
    panelBoardWorkspace,
    pendingBoardId,
    renameBoard,
    searchQuery,
    setEditingTitle,
    setLimitDialog,
    setPanelBoardId,
    setPendingBoardId,
    setSearchQuery,
    setSortMode,
    setViewMode,
    shareBoard,
    sortMode,
    startRename,
    updateBoard,
    updateBoardInState: (board: BoardPersistenceSummary) => {
      data.setBoards((current) => current.map((item) => item.id === board.id ? board : item))
    },
    viewMode,
  }
}
