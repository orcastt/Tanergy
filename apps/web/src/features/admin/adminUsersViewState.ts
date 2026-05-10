'use client'

type AdminUsersViewState = {
  limit: number
  offset: number
  scrollY: number
  searchDraft: string
  searchQuery: string
}

const storageKey = 'tanergy.admin-users.view-state'

export function readAdminUsersViewState(): AdminUsersViewState | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(storageKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AdminUsersViewState>
    return {
      limit: sanitizeNumber(parsed.limit, 100),
      offset: sanitizeNumber(parsed.offset, 0),
      scrollY: sanitizeNumber(parsed.scrollY, 0),
      searchDraft: typeof parsed.searchDraft === 'string' ? parsed.searchDraft : '',
      searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
    }
  } catch {
    window.sessionStorage.removeItem(storageKey)
    return null
  }
}

export function writeAdminUsersViewState(state: AdminUsersViewState) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(storageKey, JSON.stringify(state))
}

function sanitizeNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : fallback
}
