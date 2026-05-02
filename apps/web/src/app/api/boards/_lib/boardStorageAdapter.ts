import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import {
  createLocalBoardSnapshot,
  listLocalBoardSnapshots,
  loadLocalBoardSnapshot,
} from './localBoardSnapshotStore'
import {
  deleteLocalBoard,
  listLocalBoards,
  loadLocalBoard,
  renameLocalBoard,
  saveLocalBoard,
  updateLocalBoardMetadata,
} from './localBoardStore'

export type BoardStorageAdapter = {
  createLocalBoardSnapshot: (input: Parameters<typeof createLocalBoardSnapshot>[0], context: ApiRequestContext) => ReturnType<typeof createLocalBoardSnapshot>
  deleteLocalBoard: (boardId: string, context: ApiRequestContext) => ReturnType<typeof deleteLocalBoard>
  listLocalBoardSnapshots: (boardId: string, context: ApiRequestContext) => ReturnType<typeof listLocalBoardSnapshots>
  listLocalBoards: (context: ApiRequestContext) => ReturnType<typeof listLocalBoards>
  loadLocalBoardSnapshot: (boardId: string, snapshotId: string, context: ApiRequestContext) => ReturnType<typeof loadLocalBoardSnapshot>
  loadLocalBoard: (boardId: string, context: ApiRequestContext) => ReturnType<typeof loadLocalBoard>
  renameLocalBoard: (boardId: string, title: string, context: ApiRequestContext) => ReturnType<typeof renameLocalBoard>
  saveLocalBoard: (input: Parameters<typeof saveLocalBoard>[0], context: ApiRequestContext) => ReturnType<typeof saveLocalBoard>
  updateLocalBoardMetadata: (input: Parameters<typeof updateLocalBoardMetadata>[0], context: ApiRequestContext) => ReturnType<typeof updateLocalBoardMetadata>
}

const localBoardAdapter: BoardStorageAdapter = {
  createLocalBoardSnapshot,
  deleteLocalBoard,
  listLocalBoardSnapshots,
  listLocalBoards,
  loadLocalBoardSnapshot,
  loadLocalBoard,
  renameLocalBoard,
  saveLocalBoard,
  updateLocalBoardMetadata,
}

export function getBoardStorageAdapter(): BoardStorageAdapter {
  const driver = process.env.TANGENT_BOARD_STORAGE_DRIVER ?? 'local-dev'
  if (driver === 'local-dev') return localBoardAdapter
  throw new Error(`Unsupported board storage driver "${driver}". Supported driver: local-dev.`)
}
