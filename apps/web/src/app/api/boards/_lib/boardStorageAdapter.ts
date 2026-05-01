import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { listLocalBoards, loadLocalBoard, saveLocalBoard } from './localBoardStore'

export type BoardStorageAdapter = {
  listLocalBoards: (context: ApiRequestContext) => ReturnType<typeof listLocalBoards>
  loadLocalBoard: (boardId: string, context: ApiRequestContext) => ReturnType<typeof loadLocalBoard>
  saveLocalBoard: (input: Parameters<typeof saveLocalBoard>[0], context: ApiRequestContext) => ReturnType<typeof saveLocalBoard>
}

const localBoardAdapter: BoardStorageAdapter = {
  listLocalBoards,
  loadLocalBoard,
  saveLocalBoard,
}

export function getBoardStorageAdapter(): BoardStorageAdapter {
  const driver = process.env.TANGENT_BOARD_STORAGE_DRIVER ?? 'local-dev'
  if (driver === 'local-dev') return localBoardAdapter
  throw new Error(`Unsupported board storage driver "${driver}". Supported driver: local-dev.`)
}
