'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { updateLocalBoardMetadata } from '@/features/boards/localBoardClient'
import { BoardManagementPanel } from './BoardManagementPanel'

type WorkspaceBoardPanelHostProps = {
  board: BoardPersistenceSummary | null
  isPending: boolean
  onBoardUpdated: (board: BoardPersistenceSummary) => void
  onClose: () => void
  onCopy: (board: BoardPersistenceSummary) => void
  onDelete: (board: BoardPersistenceSummary) => void
  onOpen: (boardId: string) => void
  onShare: (board: BoardPersistenceSummary) => void
  setError: Dispatch<SetStateAction<string | null>>
  setPendingBoardId: Dispatch<SetStateAction<string | null>>
}

export function WorkspaceBoardPanelHost({
  board,
  isPending,
  onBoardUpdated,
  onClose,
  onCopy,
  onDelete,
  onOpen,
  onShare,
  setError,
  setPendingBoardId,
}: WorkspaceBoardPanelHostProps) {
  if (!board) return null

  const saveMetadata = async (input: {
    cardColor: BoardPersistenceSummary['cardColor']
    description: string
    isPinned: boolean
    isStarred: boolean
    thumbnailUrl: string
    title: string
    visibility: BoardPersistenceSummary['visibility']
  }) => {
    setPendingBoardId(board.id)
    setError(null)
    try {
      const response = await updateLocalBoardMetadata({
        boardId: board.id,
        cardColor: input.cardColor,
        description: input.description,
        isPinned: input.isPinned,
        isStarred: input.isStarred,
        thumbnailUrl: input.thumbnailUrl,
        title: input.title,
        visibility: input.visibility,
      })
      if (!response.board) throw new Error('Board update failed.')
      onBoardUpdated(response.board)
      onClose()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board update failed.')
    } finally {
      setPendingBoardId(null)
    }
  }

  return (
    <BoardManagementPanel
      board={board}
      isPending={isPending}
      key={board.id}
      onClose={onClose}
      onCopy={() => onCopy(board)}
      onDelete={() => onDelete(board)}
      onOpen={() => onOpen(board.id)}
      onSave={(input) => void saveMetadata(input)}
      onShare={() => onShare(board)}
    />
  )
}
