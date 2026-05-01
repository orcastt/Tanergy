import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { loadLocalBoard, saveLocalBoard } from './localBoardStore'

export type BoardStorageAdapter = {
  loadLocalBoard: (boardId: string, context: ApiRequestContext) => ReturnType<typeof loadLocalBoard>
  saveLocalBoard: (input: Parameters<typeof saveLocalBoard>[0], context: ApiRequestContext) => ReturnType<typeof saveLocalBoard>
}

const localBoardAdapter: BoardStorageAdapter = {
  loadLocalBoard,
  saveLocalBoard,
}

export function getBoardStorageAdapter(): BoardStorageAdapter {
  const driver = process.env.TANGENT_BOARD_STORAGE_DRIVER ?? 'local-dev'
  if (driver === 'local-dev') return localBoardAdapter
  throw new Error(`Unsupported board storage driver "${driver}". Supported driver: local-dev.`)
}
