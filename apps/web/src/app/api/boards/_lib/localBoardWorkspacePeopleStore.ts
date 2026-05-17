import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import {
  type CanonicalWorkspaceRole,
  normalizeCanonicalWorkspaceRole,
} from '@/features/auth/sessionTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import {
  createLocalBoardPersonId,
  getLocalWorkspacePeoplePath,
  getLocalBoardOwnerPerson,
  isNodeError,
  localWorkspaceRecordsRoot,
  type LocalWorkspacePerson,
  normalizeLocalBoardDisplayName,
  normalizeLocalBoardUserId,
  requireLocalBoardEmail,
} from './localBoardMembersSupport'

export async function readLocalBoardWorkspacePeople(
  board: BoardPersistenceRecord,
  context?: ApiRequestContext,
) {
  const ownerPerson = getLocalBoardOwnerPerson(board, context?.userId)
  try {
    const raw = await readFile(getLocalWorkspacePeoplePath(board.workspaceId), 'utf8')
    const parsed = JSON.parse(raw) as Array<Partial<LocalWorkspacePerson>>
    const people = Array.isArray(parsed)
      ? parsed
        .map(normalizeWorkspacePerson)
        .filter((person): person is LocalWorkspacePerson => person !== null)
      : []
    const deduped = new Map(people.map((person) => [person.userId, person]))
    deduped.set(ownerPerson.userId, deduped.get(ownerPerson.userId) ?? ownerPerson)
    return [...deduped.values()]
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [ownerPerson]
    throw error
  }
}

export async function writeLocalBoardWorkspacePeople(
  workspaceId: string,
  people: LocalWorkspacePerson[],
) {
  await mkdir(localWorkspaceRecordsRoot, { recursive: true })
  const deduped = [...new Map(people.map((person) => [person.userId, person])).values()]
  await writeFile(getLocalWorkspacePeoplePath(workspaceId), `${JSON.stringify(deduped, null, 2)}\n`)
}

export function buildInvitedLocalWorkspacePerson(
  email: string,
  displayName: string | null | undefined,
): LocalWorkspacePerson {
  const normalizedEmail = requireLocalBoardEmail(email)
  return {
    displayName: normalizeLocalBoardDisplayName(displayName) ?? normalizedEmail.split('@')[0],
    email: normalizedEmail,
    userId: createLocalBoardPersonId(normalizedEmail),
    workspaceRole: 'viewer',
  }
}

function normalizeWorkspacePerson(person: Partial<LocalWorkspacePerson>) {
  const userId = typeof person.userId === 'string' ? normalizeLocalBoardUserId(person.userId) : null
  if (!userId || typeof person.email !== 'string') return null
  const email = requireLocalBoardEmail(person.email)
  const workspaceRole = normalizeCanonicalWorkspaceRole(person.workspaceRole as CanonicalWorkspaceRole)
  return {
    displayName: normalizeLocalBoardDisplayName(person.displayName) ?? email.split('@')[0],
    email,
    userId,
    workspaceRole,
  } satisfies LocalWorkspacePerson
}
