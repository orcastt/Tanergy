'use client'

import { getAdminOperatorActionKey, type AdminOperatorAction } from './adminOperatorActions'
import { loadAdminOperatorUsers } from './adminOperatorClient'
import type { AdminOperatorUserMutationResource, AdminOperatorUsersResource } from './adminTypes'
import { loadClientResource, primeClientResource, readClientResource } from '@/features/shared/clientResourceCache'

const usersOperatorStore = new Map<string, {
  data?: AdminOperatorUsersResource
  error?: string | null
  promise?: Promise<AdminOperatorUsersResource>
  updatedAt: number
}>()
const usersOperatorMaxEntries = 24

export function readAdminOperatorUsersResource(query: { limit: number; offset: number; search?: string }) {
  const signature = queryKey(query)
  return readClientResource(usersOperatorStore, signature, cacheOptions(signature))
}

export function primeAdminOperatorUsersResource(
  query: { limit: number; offset: number; search?: string },
  resource: AdminOperatorUsersResource,
) {
  const signature = queryKey(query)
  primeClientResource(usersOperatorStore, signature, resource, cacheOptions(signature))
}

export function loadAdminOperatorUsersResource(query: { limit: number; offset: number; search?: string }) {
  const signature = queryKey(query)
  return loadClientResource(
    usersOperatorStore,
    signature,
    () => loadAdminOperatorUsers(query),
    cacheOptions(signature),
  )
}

export function invalidateAdminOperatorUsersCache() {
  usersOperatorStore.clear()
  if (typeof window === 'undefined') return
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index)
    if (key?.startsWith('tanergy.admin-operator-users.')) {
      window.sessionStorage.removeItem(key)
    }
  }
}

export function applyAdminOperatorUserMutation(resource: AdminOperatorUsersResource, result: AdminOperatorUserMutationResource): AdminOperatorUsersResource {
  if (!resource.users.length) return resource
  if (result.status === 'deleted') {
    const nextUsers = resource.users.filter((user) => user.id !== result.userId)
    return {
      ...resource,
      totalCount: Math.max(0, resource.totalCount - (nextUsers.length === resource.users.length ? 0 : 1)),
      users: nextUsers,
    }
  }
  return {
    ...resource,
    users: resource.users.map((user) => user.id === result.userId ? { ...user, status: result.status } : user),
  }
}

export function adminOperatorUserActionKey(action: AdminOperatorAction) {
  return getAdminOperatorActionKey(action)
}

function usersStorageKey(signature: string) {
  return `tanergy.admin-operator-users.${signature}`
}

function cacheOptions(signature: string) {
  return {
    maxEntries: usersOperatorMaxEntries,
    storage: 'session' as const,
    storageKey: usersStorageKey(signature),
    storagePrefix: 'tanergy.admin-operator-users.',
    ttlMs: 300_000,
  }
}

function queryKey(query: { limit: number; offset: number; search?: string }) {
  return `${query.limit}:${query.offset}:${query.search ?? ''}`
}
