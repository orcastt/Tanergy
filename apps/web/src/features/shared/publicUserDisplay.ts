type PublicUserDisplayInput = {
  displayName?: null | string
  email?: null | string
  fallback?: string
  userId?: null | string
}

const syntheticEmailSuffixes = ['@clerk.local', '@local.tangent'] as const

export function getPublicUserLabel({
  displayName,
  email,
  fallback = 'Member',
  userId,
}: PublicUserDisplayInput) {
  return getVisibleText(displayName)
    ?? getVisibleEmail(email)
    ?? getSpecialUserLabel(userId)
    ?? fallback
}

export function getPublicUserSecondaryLabel({
  displayName,
  email,
}: PublicUserDisplayInput) {
  const visibleDisplayName = getVisibleText(displayName)
  const visibleEmail = getVisibleEmail(email)
  if (!visibleEmail) return null
  if (visibleDisplayName && visibleDisplayName !== visibleEmail) return visibleEmail
  return null
}

export function getPublicUserEmail(email?: null | string) {
  return getVisibleEmail(email)
}

export function getPublicUserInitials({
  displayName,
  email,
  fallback = 'Member',
  userId,
}: PublicUserDisplayInput) {
  const source = getVisibleText(displayName)
    ?? getVisibleEmail(email)
    ?? getSpecialUserLabel(userId)
    ?? fallback

  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .join('') || 'M'
}

export function getPublicOwnerLabel(ownerId?: null | string, currentUserId?: null | string) {
  const normalizedOwnerId = ownerId?.trim()
  if (!normalizedOwnerId) return 'Workspace owner'
  if (currentUserId?.trim() && normalizedOwnerId === currentUserId.trim()) return 'You'
  return getSpecialUserLabel(normalizedOwnerId) ?? 'Workspace owner'
}

export function isSyntheticUserEmail(email?: null | string) {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) return false
  return syntheticEmailSuffixes.some((suffix) => normalized.endsWith(suffix))
}

export function isInternalUserId(value?: null | string) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return false
  if (normalized === 'dev-user') return true
  if (/^user_[a-z0-9][a-z0-9_-]*$/i.test(normalized)) return true
  return false
}

function getVisibleText(value?: null | string) {
  const normalized = value?.trim()
  if (!normalized) return null
  if (isInternalUserId(normalized)) return null
  if (isSyntheticUserEmail(normalized)) return null
  return normalized
}

function getVisibleEmail(value?: null | string) {
  const normalized = value?.trim()
  if (!normalized) return null
  if (isSyntheticUserEmail(normalized)) return null
  return normalized
}

function getSpecialUserLabel(userId?: null | string) {
  if (userId?.trim().toLowerCase() === 'dev-user') return 'Tangent Dev'
  return null
}
