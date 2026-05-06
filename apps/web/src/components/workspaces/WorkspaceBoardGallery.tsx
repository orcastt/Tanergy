'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'
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
import { WorkspaceBoardHeader } from './WorkspaceBoardHeader'
import { WorkspaceBoardPanelHost } from './WorkspaceBoardPanelHost'
import { WorkspaceBoardResults } from './WorkspaceBoardResults'
import type { WorkspaceBoardViewMode } from './WorkspaceBoardItem'
import { WorkspaceBoardToolbar, type WorkspaceBoardSortMode } from './WorkspaceBoardToolbar'
import {
  boardPageSize,
  createBoardId,
  getBoardDisplayCardColor,
  filterAndSortBoards,
} from './workspaceBoardUtils'
import { getShareUrl } from './boardMemberUtils'

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
  const [notice, setNotice] = useState<string | null>(null)
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

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const createBoard = () => {
    router.push(`/boards/${encodeURIComponent(createBoardId())}?new=1`)
  }

  const openBoard = (boardId: string) => {
    router.push(`/boards/${encodeURIComponent(boardId)}`)
  }

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
    if (!getCapabilities(board).canDeleteBoard) {
      setError('Only the Board owner can delete this board.')
      return
    }
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
    if (!getCapabilities(board).canCopyBoard) {
      setError('Only the Board owner can copy this board.')
      return
    }
    setPendingBoardId(board.id)
    setError(null)
    try {
      const response = await copyLocalBoardDocument(board.id)
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
      setError('Only the Board owner can copy this board.')
      return
    }
    setPendingBoardId(board.id)
    setError(null)
    try {
      const source = await loadLocalBoardDocument(board.id)
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
      })
      if (!response.board) throw new Error('Konva copy failed.')
      const metadata = await updateLocalBoardMetadata({
        boardId: nextBoardId,
        cardColor: getBoardDisplayCardColor(board),
        description: board.description,
        visibility: board.visibility ?? 'private',
      })
      const copiedBoard = metadata.board ?? response.board
      setBoards((current) => [copiedBoard, ...current])
      setNotice(`Created Konva v2 copy with ${migrated.migratedShapeCount} migrated shapes.`)
      router.push(`/boards/${encodeURIComponent(nextBoardId)}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Konva copy failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  const updateBoardMetadata = async (input: BoardMetadataUpdateInput) => {
    const sourceBoard = boards.find((board) => board.id === input.boardId)
    if (sourceBoard && !getCapabilities(sourceBoard).canManageBoard) {
      setError('Only a Board owner or manager can update this board.')
      return null
    }
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
    if (!getCapabilities(board).canShareBoard) {
      setError('Only a Board owner or manager can share this board.')
      return
    }
    try {
      const response = await ensureLocalBoardShareLink(board.id)
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

  const getCapabilities = (board: BoardPersistenceSummary) => getBoardCapabilities(board, getCurrentSessionSnapshot())

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
      {notice ? <div className="workspace-toast" role="status">{notice}</div> : null}
      <WorkspaceBoardResults
        boards={boards}
        editingBoardId={editingBoardId}
        editingTitle={editingTitle}
        filteredBoards={filteredBoards}
        hasMoreBoards={hasMoreBoards}
        isLoading={isLoading}
        onCancelRename={cancelRename}
        onCopy={(board) => void copyBoard(board)}
        onCopyToKonva={(board) => void copyBoardToKonva(board)}
        onCreate={createBoard}
        onDelete={(board) => void deleteBoard(board)}
        onLoadMore={() => setVisibleLimit((value) => value + boardPageSize)}
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
