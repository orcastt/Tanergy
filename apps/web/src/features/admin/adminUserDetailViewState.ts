'use client'

export type AdminUserDetailTab = 'billing' | 'group-plan' | 'joined-group' | 'joined-team' | 'team-plan'

export type AdminUserDetailViewState = {
  activeTab: AdminUserDetailTab
  selectedGroupId: string
  selectedTeamId: string
}

export function readAdminUserDetailViewState(userId: string): AdminUserDetailViewState | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(storageKey(userId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AdminUserDetailViewState>
    return {
      activeTab: isDetailTab(parsed.activeTab) ? parsed.activeTab : 'billing',
      selectedGroupId: typeof parsed.selectedGroupId === 'string' ? parsed.selectedGroupId : '',
      selectedTeamId: typeof parsed.selectedTeamId === 'string' ? parsed.selectedTeamId : '',
    }
  } catch {
    window.sessionStorage.removeItem(storageKey(userId))
    return null
  }
}

export function writeAdminUserDetailViewState(userId: string, state: AdminUserDetailViewState) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(storageKey(userId), JSON.stringify(state))
}

function storageKey(userId: string) {
  return `tanergy.admin-user-detail.${userId}`
}

function isDetailTab(value: unknown): value is AdminUserDetailTab {
  return value === 'billing'
    || value === 'team-plan'
    || value === 'joined-team'
    || value === 'group-plan'
    || value === 'joined-group'
}
