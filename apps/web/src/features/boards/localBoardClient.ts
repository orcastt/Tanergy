'use client'

export type {
  BoardRequestOptions,
  LocalBoardCopyResponse,
  LocalBoardDeleteResponse,
  LocalBoardListResponse,
  LocalBoardLoadResponse,
  LocalBoardMemberCandidatesResponse,
  LocalBoardMemberDeleteResponse,
  LocalBoardMemberResponse,
  LocalBoardMembersResponse,
  LocalBoardRenameResponse,
  LocalBoardSaveResponse,
  LocalBoardShareLinkDeleteResponse,
  LocalBoardShareLinkResolveResponse,
  LocalBoardShareLinkResponse,
  LocalBoardSnapshotClearResponse,
  LocalBoardSnapshotCreateResponse,
  LocalBoardSnapshotListResponse,
  LocalBoardSnapshotLoadResponse,
} from './localBoardClientShared'

export {
  copyLocalBoardDocument,
  deleteLocalBoardDocument,
  listLocalBoardDocuments,
  loadLocalBoardDocument,
  renameLocalBoardDocument,
  saveLocalBoardDocument,
  updateLocalBoardMetadata,
} from './localBoardPersistenceClient'

export {
  createLocalBoardMember,
  deleteLocalBoardMember,
  listLocalBoardMembers,
  searchLocalBoardMemberCandidates,
  updateLocalBoardMember,
} from './localBoardMembersClient'

export {
  ensureLocalBoardShareLink,
  loadSharedBoardDocument,
  resolveLocalBoardShareLink,
  revokeLocalBoardShareLink,
} from './localBoardShareClient'

export {
  clearBoardSnapshots,
  createBoardSnapshot,
  listBoardSnapshots,
  loadBoardSnapshot,
} from './localBoardSnapshotsClient'
