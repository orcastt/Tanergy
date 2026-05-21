import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  type BoardMemberCandidateRecord,
  normalizeBoardMemberRole,
  type BoardMemberRecord,
  type BoardMemberRole,
  type BoardPersistenceRecord,
} from '@/features/boards/boardTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import { readRequiredLocalBoardRecord } from './localBoardRecordAccess'
import {
  readLocalBoardWorkspacePeople,
} from './localBoardWorkspacePeopleStore'
import {
  getLocalBoardMemberPath,
  isNodeError,
  localBoardRecordsRoot,
  normalizeLocalBoardDisplayName,
  normalizeStoredLocalWorkspaceRole,
  requireLocalBoardEmail,
  requireLocalBoardUserId,
  type LocalWorkspacePerson,
} from './localBoardMembersSupport'
export {
  ensureLocalBoardShareLink,
  loadLocalSharedBoard,
  resolveLocalBoardShareLink,
  revokeLocalBoardShareLink,
} from './localBoardShareStore'

export async function listLocalBoardMembers(boardId: string, context: ApiRequestContext) {
  const board = await readRequiredLocalBoardRecord(boardId, context)
  return readMemberRecords(board)
}

export async function upsertLocalBoardMember(
  boardId: string,
  userId: string,
  role: BoardMemberRole,
  displayName: string | null | undefined,
  context: ApiRequestContext,
) {
  const board = await readRequiredLocalBoardRecord(boardId, context)
  const normalizedUserId = requireLocalBoardUserId(userId)
  const normalizedRole = normalizeBoardMemberRole(role)
  if (normalizedUserId === board.ownerId && normalizedRole !== 'owner') {
    throw new Error('Board owner role cannot change.')
  }

  const members = await readMemberRecords(board)
  const existing = members.find((member) => member.userId === normalizedUserId)
  const nextMember: BoardMemberRecord = {
    displayName: normalizeLocalBoardDisplayName(displayName) ?? existing?.displayName ?? null,
    invitedBy: existing?.invitedBy ?? (normalizedUserId === board.ownerId ? board.ownerId : context.userId),
    joinedAt: existing?.joinedAt ?? new Date().toISOString(),
    role: normalizedUserId === board.ownerId ? 'owner' : normalizedRole,
    userId: normalizedUserId,
  }

  const nextMembers = members
    .filter((member) => member.userId !== normalizedUserId)
    .concat(nextMember)
  await writeMemberRecords(board.id, nextMembers)
  return nextMember
}

export async function removeLocalBoardMember(boardId: string, userId: string, context: ApiRequestContext) {
  const board = await readRequiredLocalBoardRecord(boardId, context)
  const normalizedUserId = requireLocalBoardUserId(userId)
  if (normalizedUserId === board.ownerId) {
    throw new Error('Board owner cannot be removed.')
  }

  const members = await readMemberRecords(board)
  const nextMembers = members.filter((member) => member.userId !== normalizedUserId)
  if (nextMembers.length === members.length) {
    throw new Error('Board member not found.')
  }
  await writeMemberRecords(board.id, nextMembers)
  return normalizedUserId
}

export async function searchLocalBoardMemberCandidates(boardId: string, query: string, context: ApiRequestContext) {
  const board = await readRequiredLocalBoardRecord(boardId, context)
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []
  const people = await readLocalBoardWorkspacePeople(board, context)
  const members = await readMemberRecords(board)
  const memberRoles = new Map(members.map((member) => [member.userId, member.role]))
  return people
    .filter((person) => {
      const haystacks = [person.email.toLowerCase(), person.userId.toLowerCase(), (person.displayName ?? '').toLowerCase()]
      return haystacks.some((value) => value.includes(normalizedQuery))
    })
    .map((person) => ({
      alreadyMember: memberRoles.has(person.userId),
      boardRole: memberRoles.get(person.userId) ?? null,
      displayName: person.displayName ?? null,
      email: person.email,
      userId: person.userId,
      workspaceRole: person.workspaceRole,
    } satisfies BoardMemberCandidateRecord))
    .sort((left, right) => Number(left.alreadyMember) - Number(right.alreadyMember) || left.email.localeCompare(right.email))
    .slice(0, 12)
}

async function readMemberRecords(board: BoardPersistenceRecord) {
  const ownerMember = getOwnerMember(board)
  const people = await readLocalBoardWorkspacePeople(board)
  const peopleByUserId = new Map(people.map((person) => [person.userId, person]))
  try {
    const raw = await readFile(getLocalBoardMemberPath(board.id), 'utf8')
    const parsed = JSON.parse(raw) as Partial<BoardMemberRecord>[]
    const members = Array.isArray(parsed)
      ? parsed
        .map((member) => normalizeMemberRecord(member))
        .filter((member): member is BoardMemberRecord => member !== null)
      : []
    const hydrated = members.map((member) => hydrateMember(member, peopleByUserId.get(member.userId)))
    return withOwnerMember(hydrated, hydrateMember(ownerMember, peopleByUserId.get(ownerMember.userId)))
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [hydrateMember(ownerMember, peopleByUserId.get(ownerMember.userId))]
    throw error
  }
}

function withOwnerMember(members: BoardMemberRecord[], ownerMember: BoardMemberRecord) {
  const filtered = members.filter((member) => member.userId !== ownerMember.userId)
  return [ownerMember, ...filtered]
}

function normalizeMemberRecord(member: Partial<BoardMemberRecord>): BoardMemberRecord | null {
  const userId = typeof member.userId === 'string' ? requireLocalBoardUserId(member.userId) : null
  if (!userId) return null
  return {
    displayName: normalizeLocalBoardDisplayName(member.displayName),
    email: typeof member.email === 'string' ? requireLocalBoardEmail(member.email) : null,
    invitedBy: typeof member.invitedBy === 'string' ? member.invitedBy : null,
    joinedAt: typeof member.joinedAt === 'string' && member.joinedAt.trim() ? member.joinedAt : new Date(0).toISOString(),
    role: normalizeBoardMemberRole(member.role),
    userId,
    workspaceRole: normalizeStoredLocalWorkspaceRole(member.workspaceRole),
  } satisfies BoardMemberRecord
}

function getOwnerMember(board: BoardPersistenceRecord): BoardMemberRecord {
  return {
    displayName: board.ownerId === 'dev-user' ? 'Dev User' : board.ownerId,
    invitedBy: board.ownerId,
    joinedAt: board.createdAt ?? board.savedAt,
    role: 'owner',
    userId: board.ownerId,
  }
}

async function writeMemberRecords(boardId: string, members: BoardMemberRecord[]) {
  await mkdir(localBoardRecordsRoot, { recursive: true })
  const payload = JSON.stringify(members, null, 2)
  await writeFile(getLocalBoardMemberPath(boardId), `${payload}\n`)
}

function hydrateMember(
  member: BoardMemberRecord,
  person?: LocalWorkspacePerson,
) {
  return {
    ...member,
    displayName: member.displayName ?? person?.displayName ?? null,
    email: member.email ?? person?.email ?? null,
    workspaceRole: member.workspaceRole ?? person?.workspaceRole ?? null,
  } satisfies BoardMemberRecord
}
