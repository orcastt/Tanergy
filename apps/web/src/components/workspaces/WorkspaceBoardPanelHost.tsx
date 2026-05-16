'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { TangentSession, TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { updateLocalBoardMetadata } from '@/features/boards/localBoardClient'
import { getBoardCapabilities } from './boardCapabilities'
import { BoardManagementPanel } from './BoardManagementPanel'

type WorkspaceBoardPanelHostProps = {
  board: BoardPersistenceSummary | null
  isPending: boolean
  onBoardUpdated: (board: BoardPersistenceSummary) => void
  onClose: () => void
  onCopy: (board: BoardPersistenceSummary, workspace?: TangentWorkspace) => void
  onDelete: (board: BoardPersistenceSummary) => void
  onOpen: (boardId: string) => void
  onShare: (board: BoardPersistenceSummary) => void
  session: TangentSession
  setError: Dispatch<SetStateAction<string | null>>
  setPendingBoardId: Dispatch<SetStateAction<string | null>>
  workspace?: TangentWorkspace
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
  session,
  setError,
  setPendingBoardId,
  workspace,
}: WorkspaceBoardPanelHostProps) {
  if (!board) return null
  const capabilities = getBoardCapabilities(board, session)

  const saveMetadata = async (input: {
    cardColor: BoardPersistenceSummary['cardColor']
    description: string
    isPinned: boolean
    thumbnailUrl: string
    title: string
  }) => {
    setPendingBoardId(board.id)
    setError(null)
    try {
      const response = await updateLocalBoardMetadata({
        boardId: board.id,
        cardColor: input.cardColor,
        description: input.description,
        isPinned: input.isPinned,
        thumbnailUrl: input.thumbnailUrl,
        title: input.title,
      }, workspace)
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
      canCopyBoard={capabilities.canCopyBoard}
      canDeleteBoard={capabilities.canDeleteBoard}
      canManageBoard={capabilities.canManageBoard}
      isPending={isPending}
      key={board.id}
      workspace={workspace}
      onClose={onClose}
      onCopy={() => onCopy(board, workspace)}
      onDelete={() => onDelete(board)}
      onOpen={() => onOpen(board.id)}
      onSave={(input) => void saveMetadata(input)}
      onShare={() => onShare(board)}
    />
  )
}
