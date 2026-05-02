'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { BoardMetadataUpdateInput, BoardPersistenceSummary, SerializedBoardSaveInput } from '@/features/boards/boardTypes'
import {
  deleteLocalBoardDocument,
  listLocalBoardDocuments,
  loadLocalBoardDocument,
  renameLocalBoardDocument,
  saveLocalBoardDocument,
  updateLocalBoardMetadata,
} from '@/features/boards/localBoardClient'
import { WorkspaceBoardHeader } from './WorkspaceBoardHeader'
import { WorkspaceBoardPanelHost } from './WorkspaceBoardPanelHost'
import { WorkspaceBoardResults } from './WorkspaceBoardResults'
import type { WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import { WorkspaceBoardToolbar, type WorkspaceBoardSortMode } from './WorkspaceBoardToolbar'
import {
  boardPageSize,
  createBoardId,
  createBoardShareId,
  getBoardShareUrl,
  filterAndSortBoards,
} from './workspaceBoardUtils'

type ViewMode = WorkspaceBoardViewMode
type SortMode = WorkspaceBoardSortMode

export function WorkspaceBoardGallery() {
  const router = useRouter()
  const [boards, setBoards] = useState<BoardPersistenceSummary[]>([])
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null)
  const [panelBoardId, setPanelBoardId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('opened')
  const [visibleLimit, setVisibleLimit] = useState(boardPageSize)
  const [viewMode, setViewMode] = useState<ViewMode>('gallery')

  const filteredBoards = useMemo(() => filterAndSortBoards(boards, searchQuery, sortMode), [boards, searchQuery, sortMode])

  const visibleBoards = useMemo(() => filteredBoards.slice(0, visibleLimit), [filteredBoards, visibleLimit])
  const hasMoreBoards = filteredBoards.length > visibleBoards.length
  const panelBoard = useMemo(
    () => boards.find((board) => board.id === panelBoardId) ?? null,
    [boards, panelBoardId]
  )

  const refreshBoards = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listLocalBoardDocuments()
      setBoards(response.boards)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board list failed.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshBoards()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [refreshBoards])

  const createBoard = () => {
    router.push(`/boards/${encodeURIComponent(createBoardId())}?new=1`)
  }

  const openBoard = (boardId: string) => {
    router.push(`/boards/${encodeURIComponent(boardId)}`)
  }

  const startRename = (board: BoardPersistenceSummary) => {
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
      const response = await renameLocalBoardDocument(boardId, title)
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
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return
    setPendingBoardId(board.id)
    setError(null)
    try {
      await deleteLocalBoardDocument(board.id)
      setBoards((current) => current.filter((item) => item.id !== board.id))
      if (editingBoardId === board.id) cancelRename()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board delete failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const copyBoard = async (board: BoardPersistenceSummary) => {
    setPendingBoardId(board.id)
    setError(null)
    try {
      const source = await loadLocalBoardDocument(board.id)
      const response = await saveLocalBoardDocument({
        boardId: createBoardId(),
        cardColor: board.cardColor,
        description: board.description,
        document: source.board!.document as SerializedBoardSaveInput['document'],
        thumbnailUrl: board.thumbnailUrl,
        title: `${board.title} copy`,
      })
      if (!response.board) throw new Error('Board copy failed.')
      setBoards((current) => [response.board!, ...current])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board copy failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const updateBoardMetadata = async (input: BoardMetadataUpdateInput) => {
    setPendingBoardId(input.boardId)
    setError(null)
    try {
      const response = await updateLocalBoardMetadata(input)
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
    const updated = board.shareId ? board : await updateBoardMetadata({ boardId: board.id, shareId: createBoardShareId() })
    const shareBoardRecord = updated ?? board
    try {
      await navigator.clipboard?.writeText(getBoardShareUrl(shareBoardRecord))
    } catch {
      setError('Share link is ready, but the browser blocked clipboard access.')
    }
  }

  const updateSearchQuery = (query: string) => {
    setSearchQuery(query)
    setVisibleLimit(boardPageSize)
  }

  const updateSortMode = (mode: SortMode) => {
    setSortMode(mode)
    setVisibleLimit(boardPageSize)
  }

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    setVisibleLimit(boardPageSize)
  }

  return (
    <div className="workspace-page">
      <WorkspaceBoardHeader isLoading={isLoading} onCreate={createBoard} onRefresh={() => void refreshBoards()} />

      <WorkspaceBoardToolbar
        onSearchChange={updateSearchQuery}
        onSortModeChange={updateSortMode}
        onViewModeChange={updateViewMode}
        searchQuery={searchQuery}
        sortMode={sortMode}
        viewMode={viewMode}
      />

      {error ? <div className="workspace-error" role="alert">{error}</div> : null}
      <WorkspaceBoardResults
        boards={boards}
        editingBoardId={editingBoardId}
        editingTitle={editingTitle}
        filteredBoards={filteredBoards}
        hasMoreBoards={hasMoreBoards}
        isLoading={isLoading}
        onCancelRename={cancelRename}
        onCopy={(board) => void copyBoard(board)}
        onCreate={createBoard}
        onDelete={(board) => void deleteBoard(board)}
        onLoadMore={() => setVisibleLimit((value) => value + boardPageSize)}
        onMakePrivate={(board) => void updateBoardMetadata({ boardId: board.id, visibility: 'private' })}
        onMakePublic={(board) => void updateBoardMetadata({ boardId: board.id, visibility: 'public' })}
        onOpen={openBoard}
        onOpenPanel={setPanelBoardId}
        onRename={startRename}
        onShare={(board) => void shareBoard(board)}
        onSubmitRename={(event, boardId) => void renameBoard(event, boardId)}
        onTitleChange={setEditingTitle}
        onTogglePin={(board) => void updateBoardMetadata({ boardId: board.id, isPinned: !board.isPinned })}
        onToggleStar={(board) => void updateBoardMetadata({ boardId: board.id, isStarred: !board.isStarred })}
        pendingBoardId={pendingBoardId}
        viewMode={viewMode}
        visibleBoards={visibleBoards}
      />
      <WorkspaceBoardPanelHost
        board={panelBoard}
        isPending={panelBoard ? pendingBoardId === panelBoard.id : false}
        onBoardUpdated={(board) => setBoards((current) => current.map((item) => item.id === board.id ? board : item))}
        onClose={() => setPanelBoardId(null)}
        onCopy={(board) => void copyBoard(board)}
        onDelete={(board) => void deleteBoard(board)}
        onOpen={openBoard}
        onShare={(board) => void shareBoard(board)}
        setError={setError}
        setPendingBoardId={setPendingBoardId}
      />
    </div>
  )
}
