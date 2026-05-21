import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { assertLocalBoardBridgeAvailable } from '@/features/api/runtimeBridgePolicy'
import {
  clearLocalBoardSnapshots,
  createLocalBoardSnapshot,
  listLocalBoardSnapshots,
  loadLocalBoardSnapshot,
} from './localBoardSnapshotStore'
import {
  copyLocalBoard,
  deleteLocalBoard,
  listLocalBoards,
  loadLocalBoard,
  renameLocalBoard,
  saveLocalBoard,
  updateLocalBoardMetadata,
} from './localBoardStore'
import {
  ensureLocalBoardShareLink,
  loadLocalSharedBoard,
  listLocalBoardMembers,
  resolveLocalBoardShareLink,
  removeLocalBoardMember,
  revokeLocalBoardShareLink,
  searchLocalBoardMemberCandidates,
  upsertLocalBoardMember,
} from './localBoardMembersStore'

export type BoardStorageAdapter = {
  clearLocalBoardSnapshots: (boardId: string, context: ApiRequestContext) => ReturnType<typeof clearLocalBoardSnapshots>
  copyLocalBoard: (boardId: string, context: ApiRequestContext) => ReturnType<typeof copyLocalBoard>
  createLocalBoardSnapshot: (input: Parameters<typeof createLocalBoardSnapshot>[0], context: ApiRequestContext) => ReturnType<typeof createLocalBoardSnapshot>
  deleteLocalBoard: (boardId: string, context: ApiRequestContext) => ReturnType<typeof deleteLocalBoard>
  ensureLocalBoardShareLink: (
    boardId: string,
    accessRole: Parameters<typeof ensureLocalBoardShareLink>[1],
    context: ApiRequestContext,
    expiresAt?: string | null,
    password?: string | null,
    clearPassword?: boolean,
    regenerate?: boolean,
  ) => ReturnType<typeof ensureLocalBoardShareLink>
  listLocalBoardMembers: (boardId: string, context: ApiRequestContext) => ReturnType<typeof listLocalBoardMembers>
  listLocalBoardSnapshots: (boardId: string, context: ApiRequestContext) => ReturnType<typeof listLocalBoardSnapshots>
  listLocalBoards: (context: ApiRequestContext) => ReturnType<typeof listLocalBoards>
  loadLocalBoardSnapshot: (boardId: string, snapshotId: string, context: ApiRequestContext) => ReturnType<typeof loadLocalBoardSnapshot>
  loadLocalBoard: (boardId: string, context: ApiRequestContext) => ReturnType<typeof loadLocalBoard>
  loadLocalSharedBoard: (shareId: string, password?: string | null) => ReturnType<typeof loadLocalSharedBoard>
  renameLocalBoard: (boardId: string, title: string, context: ApiRequestContext) => ReturnType<typeof renameLocalBoard>
  resolveLocalBoardShareLink: (shareId: string, password?: string | null) => ReturnType<typeof resolveLocalBoardShareLink>
  removeLocalBoardMember: (boardId: string, userId: string, context: ApiRequestContext) => ReturnType<typeof removeLocalBoardMember>
  revokeLocalBoardShareLink: (
    boardId: string,
    shareId: string,
    context: ApiRequestContext,
  ) => ReturnType<typeof revokeLocalBoardShareLink>
  saveLocalBoard: (input: Parameters<typeof saveLocalBoard>[0], context: ApiRequestContext) => ReturnType<typeof saveLocalBoard>
  searchLocalBoardMemberCandidates: (
    boardId: string,
    query: string,
    context: ApiRequestContext,
  ) => ReturnType<typeof searchLocalBoardMemberCandidates>
  upsertLocalBoardMember: (
    boardId: string,
    userId: string,
    role: Parameters<typeof upsertLocalBoardMember>[2],
    displayName: string | null | undefined,
    context: ApiRequestContext,
  ) => ReturnType<typeof upsertLocalBoardMember>
  updateLocalBoardMetadata: (input: Parameters<typeof updateLocalBoardMetadata>[0], context: ApiRequestContext) => ReturnType<typeof updateLocalBoardMetadata>
}

const localBoardAdapter: BoardStorageAdapter = {
  clearLocalBoardSnapshots,
  copyLocalBoard,
  createLocalBoardSnapshot,
  deleteLocalBoard,
  ensureLocalBoardShareLink,
  listLocalBoardMembers,
  listLocalBoardSnapshots,
  listLocalBoards,
  loadLocalBoardSnapshot,
  loadLocalBoard,
  loadLocalSharedBoard,
  renameLocalBoard,
  resolveLocalBoardShareLink,
  removeLocalBoardMember,
  revokeLocalBoardShareLink,
  saveLocalBoard,
  searchLocalBoardMemberCandidates,
  upsertLocalBoardMember,
  updateLocalBoardMetadata,
}

export function getBoardStorageAdapter(): BoardStorageAdapter {
  assertLocalBoardBridgeAvailable()
  const driver = process.env.TANGENT_BOARD_STORAGE_DRIVER ?? 'local-dev'
  if (driver === 'local-dev') return localBoardAdapter
  throw new Error(`Unsupported board storage driver "${driver}". Supported driver: local-dev.`)
}
