'use client'

import { loadAdminDirectoryUser, loadAdminDirectoryWorkspaces, type AdminDirectoryUserRecord, type AdminDirectoryWorkspaceRecord } from './adminDirectoryClient'
import { loadClientResource, primeClientResource, readClientResource } from '@/features/shared/clientResourceCache'

type AdminUserDetailBundle = {
  complete: boolean
  groups: AdminDirectoryWorkspaceRecord[]
  teams: AdminDirectoryWorkspaceRecord[]
  user: AdminDirectoryUserRecord | null
}

const adminUserDetailStore = new Map<string, { data?: AdminUserDetailBundle; error?: string | null; promise?: Promise<AdminUserDetailBundle>; updatedAt: number }>()
const adminUserDetailMaxEntries = 48

export function primeAdminUserDetailBundle(
  userId: string,
  bundle: Partial<AdminUserDetailBundle> & Pick<AdminUserDetailBundle, 'user'>,
) {
  const current = readAdminUserDetailBundle(userId).data
  const nextBundle: AdminUserDetailBundle = {
    complete: current?.complete === true ? true : bundle.complete === true,
    groups: bundle.groups ?? current?.groups ?? [],
    teams: bundle.teams ?? current?.teams ?? [],
    user: bundle.user ?? current?.user ?? null,
  }

  primeClientResource(adminUserDetailStore, userId, nextBundle, {
    maxEntries: adminUserDetailMaxEntries,
    storage: 'session',
    storageKey: storageKey(userId),
    storagePrefix: 'tanergy.admin.user-detail.',
    ttlMs: 120_000,
  })
}

export function readAdminUserDetailBundle(userId: string) {
  return readClientResource(adminUserDetailStore, userId, {
    maxEntries: adminUserDetailMaxEntries,
    storage: 'session',
    storageKey: storageKey(userId),
    storagePrefix: 'tanergy.admin.user-detail.',
    ttlMs: 120_000,
  })
}

export function loadAdminUserDetailBundle(userId: string, options: { force?: boolean } = {}) {
  return loadClientResource(
    adminUserDetailStore,
    userId,
    async () => {
      const [userResource, teamsResource, groupsResource] = await Promise.all([
        loadAdminDirectoryUser(userId),
        loadAdminDirectoryWorkspaces({ kind: 'team_workspace', limit: 100, ownerId: userId }),
        loadAdminDirectoryWorkspaces({ kind: 'group_workspace', limit: 100, ownerId: userId }),
      ])
      return {
        complete: true,
        groups: groupsResource.workspaces,
        teams: teamsResource.workspaces,
        user: userResource.user ?? null,
      }
    },
    {
      canReuse: (bundle) => bundle.complete,
      force: options.force,
      maxEntries: adminUserDetailMaxEntries,
      storage: 'session',
      storageKey: storageKey(userId),
      storagePrefix: 'tanergy.admin.user-detail.',
      ttlMs: 120_000,
    },
  )
}

export function warmAdminUserDetailBundle(userId: string, user: AdminDirectoryUserRecord | null) {
  if (user) {
    primeAdminUserDetailBundle(userId, {
      complete: false,
      user,
    })
  }
  return loadAdminUserDetailBundle(userId).catch(() => undefined)
}

function storageKey(userId: string) {
  return `tanergy.admin.user-detail.${userId}`
}
