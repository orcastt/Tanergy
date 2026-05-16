import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  normalizeBoardShareId,
  type BoardMemberCandidateRecord,
  normalizeBoardMemberRole,
  type BoardMemberRecord,
  type BoardMemberRole,
  type BoardPersistenceRecord,
  type BoardShareAccessRole,
  type BoardShareLinkRecord,
  type BoardShareLinkResolveRecord,
} from '@/features/boards/boardTypes'
import {
  type CanonicalWorkspaceRole,
  normalizeCanonicalWorkspaceRole,
  type WorkspaceRole,
} from '@/features/auth/sessionTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'

const storageRoot = process.env.TANGENT_BOARD_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-boards')
const boardsRoot = path.join(storageRoot, 'boards')
const workspacesRoot = path.join(storageRoot, 'workspaces')
const shareableWorkspaceKinds = new Set(['group_workspace', 'team_workspace'])

export async function listLocalBoardMembers(boardId: string, context: ApiRequestContext) {
  const board = await readRequiredBoardRecord(boardId, context)
  return readMemberRecords(board)
}

export async function upsertLocalBoardMember(
  boardId: string,
  userId: string,
  role: BoardMemberRole,
  displayName: string | null | undefined,
  context: ApiRequestContext,
) {
  const board = await readRequiredBoardRecord(boardId, context)
  const normalizedUserId = requireUserId(userId)
  const normalizedRole = normalizeBoardMemberRole(role)
  if (normalizedUserId === board.ownerId && normalizedRole !== 'owner') {
    throw new Error('Board owner role cannot change.')
  }

  const members = await readMemberRecords(board)
  const existing = members.find((member) => member.userId === normalizedUserId)
  const nextMember: BoardMemberRecord = {
    displayName: normalizeDisplayName(displayName) ?? existing?.displayName ?? null,
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
  const board = await readRequiredBoardRecord(boardId, context)
  const normalizedUserId = requireUserId(userId)
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
  const board = await readRequiredBoardRecord(boardId, context)
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []
  const people = await readWorkspacePeople(board, context)
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

export async function inviteLocalBoardMemberByEmail(
  boardId: string,
  email: string,
  role: BoardMemberRole,
  displayName: string | null | undefined,
  context: ApiRequestContext,
) {
  const board = await readRequiredBoardRecord(boardId, context)
  const normalizedEmail = requireEmail(email)
  const people = await readWorkspacePeople(board, context)
  const existing = people.find((person) => person.email.toLowerCase() === normalizedEmail)
  const candidate = existing ?? {
    displayName: normalizeDisplayName(displayName) ?? normalizedEmail.split('@')[0],
    email: normalizedEmail,
    userId: createLocalPersonId(normalizedEmail),
    workspaceRole: 'viewer' as const,
  }
  if (!existing) {
    await writeWorkspacePeople(board.workspaceId, [...people, candidate])
  }
  const member = await upsertLocalBoardMember(boardId, candidate.userId, role, displayName ?? candidate.displayName, context)
  return {
    ...member,
    email: candidate.email,
    workspaceRole: candidate.workspaceRole,
  } satisfies BoardMemberRecord
}

export async function ensureLocalBoardShareLink(
  boardId: string,
  accessRole: BoardShareAccessRole,
  context: ApiRequestContext,
  expiresAt?: string | null,
) {
  const board = await readRequiredBoardRecord(boardId, context)
  assertBoardCanCreateShareLink(board, context)
  const links = await readShareLinks(board.id)
  const normalizedExpiresAt = normalizeShareExpiresAt(expiresAt)
  const existing = links.find((link) => isShareLinkActive(link))
  const nextLink: BoardShareLinkRecord = existing
    ? { ...existing, accessRole, expiresAt: normalizedExpiresAt }
    : {
        accessRole,
        boardId: board.id,
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
        expiresAt: normalizedExpiresAt,
        id: `board_share_${crypto.randomUUID()}`,
        shareId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        workspaceId: board.workspaceId,
      }
  await writeShareLinks(board.id, [nextLink])
  await writeBoardRecord({ ...board, shareId: nextLink.shareId })
  return nextLink
}

export async function revokeLocalBoardShareLink(boardId: string, shareId: string, context: ApiRequestContext) {
  const board = await readRequiredBoardRecord(boardId, context)
  const normalizedShareId = requireShareId(shareId)
  const links = await readShareLinks(board.id)
  const nextLinks = links.filter((link) => link.shareId !== normalizedShareId)
  if (nextLinks.length === links.length) throw new Error('Board share link not found.')
  await writeShareLinks(board.id, nextLinks)
  await writeBoardRecord({ ...board, shareId: null })
  return normalizedShareId
}

export async function resolveLocalBoardShareLink(shareId: string): Promise<BoardShareLinkResolveRecord> {
  const normalizedShareId = requireShareId(shareId)
  try {
    const files = await readFileIndex(boardsRoot)
    for (const file of files.filter((entry) => entry.endsWith('.shares.json'))) {
      const boardId = file.replace(/\.shares\.json$/, '')
      const links = await readShareLinks(boardId)
      const match = links.find((link) => link.shareId === normalizedShareId && isShareLinkActive(link))
      if (!match) continue
      const board = await readBoardRecord(boardId)
      return {
        accessRole: match.accessRole,
        boardId: board.id,
        boardTitle: board.title,
        shareId: match.shareId,
        workspaceId: board.workspaceId,
      }
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error('Board share link not found.')
    }
    throw error
  }
  throw new Error('Board share link not found.')
}

export async function loadLocalSharedBoard(shareId: string): Promise<BoardPersistenceRecord> {
  const normalizedShareId = requireShareId(shareId)
  try {
    const files = await readFileIndex(boardsRoot)
    for (const file of files.filter((entry) => entry.endsWith('.shares.json'))) {
      const boardId = file.replace(/\.shares\.json$/, '')
      const links = await readShareLinks(boardId)
      const match = links.find((link) => link.shareId === normalizedShareId && isShareLinkActive(link))
      if (!match) continue
      const board = await readBoardRecord(boardId)
      const updatedBoard = { ...board, lastOpenedAt: new Date().toISOString() }
      await writeBoardRecord(updatedBoard)
      return updatedBoard
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error('Board share link not found.')
    }
    throw error
  }
  throw new Error('Board share link not found.')
}

async function readRequiredBoardRecord(boardId: string, context: ApiRequestContext) {
  const safeBoardId = sanitizeBoardId(boardId)
  if (!safeBoardId) throw new Error('Invalid board id.')
  const raw = await readFile(getBoardPath(safeBoardId), 'utf8')
  const board = JSON.parse(raw) as Partial<BoardPersistenceRecord>
  if (board.workspaceId !== context.workspaceId) {
    throw new Error('Board not found in workspace.')
  }
  if (!board.id || !board.ownerId) {
    throw new Error('Board record is invalid.')
  }
  return board as BoardPersistenceRecord
}

async function readBoardRecord(boardId: string) {
  const raw = await readFile(getBoardPath(boardId), 'utf8')
  return JSON.parse(raw) as BoardPersistenceRecord
}

async function readMemberRecords(board: BoardPersistenceRecord) {
  const ownerMember = getOwnerMember(board)
  const people = await readWorkspacePeople(board)
  const peopleByUserId = new Map(people.map((person) => [person.userId, person]))
  try {
    const raw = await readFile(getMemberPath(board.id), 'utf8')
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

function assertBoardCanCreateShareLink(board: BoardPersistenceRecord, context: ApiRequestContext) {
  if (!shareableWorkspaceKinds.has(context.workspaceKind)) {
    throw new Error('Board share links are only available in Team or Group workspaces.')
  }
}

function normalizeMemberRecord(member: Partial<BoardMemberRecord>): BoardMemberRecord | null {
  const userId = typeof member.userId === 'string' ? normalizeUserId(member.userId) : null
  if (!userId) return null
  return {
    displayName: normalizeDisplayName(member.displayName),
    email: typeof member.email === 'string' ? requireEmail(member.email) : null,
    invitedBy: typeof member.invitedBy === 'string' ? member.invitedBy : null,
    joinedAt: typeof member.joinedAt === 'string' && member.joinedAt.trim() ? member.joinedAt : new Date(0).toISOString(),
    role: normalizeBoardMemberRole(member.role),
    userId,
    workspaceRole: normalizeStoredWorkspaceRole(member.workspaceRole),
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
  await mkdir(boardsRoot, { recursive: true })
  const payload = JSON.stringify(members, null, 2)
  await writeFile(getMemberPath(boardId), `${payload}\n`)
}

async function readWorkspacePeople(board: BoardPersistenceRecord, context?: ApiRequestContext) {
  const ownerPerson = {
    displayName: board.ownerId === (context?.userId ?? 'dev-user')
      ? 'Dev User'
      : board.ownerId,
    email: board.ownerId === 'dev-user' ? 'dev@tangent.local' : `${board.ownerId}@local.tangent`,
    userId: board.ownerId,
    workspaceRole: 'owner' as const,
  }
  try {
    const raw = await readFile(getWorkspacePeoplePath(board.workspaceId), 'utf8')
    const parsed = JSON.parse(raw) as Array<Partial<{ displayName: string; email: string; userId: string; workspaceRole: string }>>
    const people = Array.isArray(parsed)
      ? parsed
        .map((person) => normalizeWorkspacePerson(person))
        .filter((person): person is NonNullable<ReturnType<typeof normalizeWorkspacePerson>> => person !== null)
      : []
    const deduped = new Map(people.map((person) => [person.userId, person]))
    deduped.set(ownerPerson.userId, deduped.get(ownerPerson.userId) ?? ownerPerson)
    return [...deduped.values()]
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [ownerPerson]
    throw error
  }
}

async function writeWorkspacePeople(
  workspaceId: string,
  people: Array<{ displayName: string; email: string; userId: string; workspaceRole: CanonicalWorkspaceRole }>,
) {
  await mkdir(workspacesRoot, { recursive: true })
  const deduped = [...new Map(people.map((person) => [person.userId, person])).values()]
  await writeFile(getWorkspacePeoplePath(workspaceId), `${JSON.stringify(deduped, null, 2)}\n`)
}

async function readShareLinks(boardId: string) {
  try {
    const raw = await readFile(getShareLinkPath(boardId), 'utf8')
    const parsed = JSON.parse(raw) as Partial<BoardShareLinkRecord>[]
    return Array.isArray(parsed)
      ? parsed
        .map((link) => normalizeShareLinkRecord(link))
        .filter((link): link is BoardShareLinkRecord => link !== null)
      : []
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw error
  }
}

async function writeShareLinks(boardId: string, links: BoardShareLinkRecord[]) {
  await mkdir(boardsRoot, { recursive: true })
  await writeFile(getShareLinkPath(boardId), `${JSON.stringify(links, null, 2)}\n`)
}

async function writeBoardRecord(board: BoardPersistenceRecord) {
  await mkdir(boardsRoot, { recursive: true })
  await writeFile(getBoardPath(board.id), `${JSON.stringify(board, null, 2)}\n`)
}

function getBoardPath(boardId: string) {
  return path.join(boardsRoot, `${boardId}.json`)
}

function getMemberPath(boardId: string) {
  return path.join(boardsRoot, `${boardId}.members.json`)
}

function getShareLinkPath(boardId: string) {
  return path.join(boardsRoot, `${boardId}.shares.json`)
}

function getWorkspacePeoplePath(workspaceId: string) {
  return path.join(workspacesRoot, `${workspaceId}.people.json`)
}

function sanitizeBoardId(value: string | undefined) {
  if (!value) return null
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes('..') ? value : null
}

function normalizeUserId(value: string) {
  const trimmed = value.trim()
  return trimmed && /^[a-zA-Z0-9._@-]+$/.test(trimmed) && !trimmed.includes('..') ? trimmed : null
}

function requireUserId(value: string) {
  const normalized = normalizeUserId(value)
  if (!normalized) throw new Error('Invalid user id.')
  return normalized
}

function normalizeDisplayName(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 80) : null
}

function hydrateMember(
  member: BoardMemberRecord,
  person?: { displayName: string; email: string; userId: string; workspaceRole: CanonicalWorkspaceRole },
) {
  return {
    ...member,
    displayName: member.displayName ?? person?.displayName ?? null,
    email: member.email ?? person?.email ?? null,
    workspaceRole: member.workspaceRole ?? person?.workspaceRole ?? null,
  } satisfies BoardMemberRecord
}

function normalizeWorkspacePerson(person: Partial<{ displayName: string; email: string; userId: string; workspaceRole: string }>) {
  const userId = typeof person.userId === 'string' ? normalizeUserId(person.userId) : null
  if (!userId || typeof person.email !== 'string') return null
  const email = requireEmail(person.email)
  const workspaceRole = normalizeCanonicalWorkspaceRole(person.workspaceRole)
  return {
    displayName: normalizeDisplayName(person.displayName) ?? email.split('@')[0],
    email,
    userId,
    workspaceRole,
  } as const
}

function normalizeStoredWorkspaceRole(value: unknown): WorkspaceRole | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return normalizeCanonicalWorkspaceRole(value)
}

function normalizeShareLinkRecord(link: Partial<BoardShareLinkRecord>): BoardShareLinkRecord | null {
  const shareId = typeof link.shareId === 'string' ? normalizeBoardShareId(link.shareId) : null
  if (!shareId || typeof link.id !== 'string' || typeof link.boardId !== 'string' || typeof link.workspaceId !== 'string' || typeof link.createdAt !== 'string' || typeof link.createdBy !== 'string') {
    return null
  }
  if (link.accessRole !== 'viewer' && link.accessRole !== 'editor') return null
  return {
    accessRole: link.accessRole,
    boardId: link.boardId,
    createdAt: link.createdAt,
    createdBy: link.createdBy,
    expiresAt: link.expiresAt ?? null,
    id: link.id,
    shareId,
    workspaceId: link.workspaceId,
  } satisfies BoardShareLinkRecord
}

function isShareLinkActive(link: BoardShareLinkRecord) {
  if (!link.expiresAt) return true
  const expiresAt = new Date(link.expiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now()
}

function normalizeShareExpiresAt(value?: string | null) {
  if (!value) return null
  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) throw new Error('Invalid board share expiry.')
  if (expiresAt.getTime() <= Date.now()) throw new Error('Board share expiry must be in the future.')
  return expiresAt.toISOString()
}

function createLocalPersonId(email: string) {
  const stem = email.split('@')[0].replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 24) || 'member'
  return requireUserId(`user_${stem}_${Math.random().toString(36).slice(2, 8)}`)
}

function requireEmail(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) throw new Error('Valid email is required.')
  return trimmed
}

function requireShareId(value: string) {
  const normalized = normalizeBoardShareId(value)
  if (!normalized) throw new Error('Invalid board share id.')
  return normalized
}

async function readFileIndex(directory: string) {
  const { readdir } = await import('node:fs/promises')
  return readdir(directory)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
