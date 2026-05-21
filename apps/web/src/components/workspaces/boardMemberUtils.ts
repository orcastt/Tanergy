import type {
  BoardMemberCandidateRecord,
  BoardMemberRecord,
  BoardMemberRole,
  BoardShareLinkRecord,
} from '@/features/boards/boardTypes'

export function buildDraftMap(members: BoardMemberRecord[]) {
  return Object.fromEntries(
    members.map((member) => [member.userId, { displayName: member.displayName ?? '', role: member.role }])
  )
}

export function upsertMember(members: BoardMemberRecord[], member: BoardMemberRecord, ownerId: string) {
  return sortMembers(
    members.filter((entry) => entry.userId !== member.userId).concat(member),
    ownerId
  )
}

export function sortMembers(members: BoardMemberRecord[], ownerId: string) {
  const roleOrder: Record<BoardMemberRole, number> = {
    admin: 1,
    editor: 2,
    owner: 0,
    temporary_viewer: 4,
    viewer: 3,
  }

  return [...members].sort((left, right) => {
    if (left.userId === ownerId) return -1
    if (right.userId === ownerId) return 1
    if (roleOrder[left.role] !== roleOrder[right.role]) return roleOrder[left.role] - roleOrder[right.role]
    return (left.displayName || left.userId).localeCompare(right.displayName || right.userId)
  })
}

export function getRoleLabel(role: BoardMemberRole) {
  if (role === 'temporary_viewer') return 'Temporary viewer'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function getInitials(name: string) {
  return name
    .split(/[\s._-]+/)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('')
}

export function formatJoinedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Joined recently'
  return `Joined ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}`
}

export function formatWorkspaceRole(value: BoardMemberCandidateRecord['workspaceRole'] | BoardMemberRecord['workspaceRole']) {
  if (!value) return 'Member'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function isLikelyEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())
}

export function getShareUrl(shareLink: BoardShareLinkRecord) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/share/${encodeURIComponent(shareLink.shareId)}`
}
