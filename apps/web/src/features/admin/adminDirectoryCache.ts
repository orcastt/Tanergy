'use client'

import { loadAdminSummary } from './adminClient'
import {
  loadAdminDirectoryUsers,
  loadAdminDirectoryWorkspaces,
  type AdminDirectoryUsersResource,
  type AdminDirectoryWorkspacesResource,
} from './adminDirectoryClient'
import type { AdminSummaryResource } from './adminTypes'
import { loadClientResource, primeClientResource, readClientResource } from '@/features/shared/clientResourceCache'

const ttlMs = 300_000
const directoryQueryMaxEntries = 24

type CacheEntry<T> = {
  data?: T
  error?: string | null
  promise?: Promise<T>
  updatedAt: number
}

type LoadOptions = {
  force?: boolean
}

export const teamWorkspaceDirectoryKind = 'team_workspace'
export const groupWorkspaceDirectoryKind = 'group_workspace'

const summaryStore = new Map<string, CacheEntry<AdminSummaryResource>>()
const usersStore = new Map<string, CacheEntry<AdminDirectoryUsersResource>>()
const workspacesStore = new Map<string, CacheEntry<AdminDirectoryWorkspacesResource>>()

type UsersQuery = {
  limit: number
  offset?: number
  search?: string
}

type WorkspacesQuery = {
  kind: string
  limit?: number
  offset?: number
  ownerId?: string
  search?: string
}

export function readAdminSummaryResource() {
  return readClientResource(summaryStore, 'summary', {
    maxEntries: 1,
    storage: 'session',
    storageKey: 'tanergy.admin-summary',
    ttlMs,
  })
}

export function primeAdminSummaryResource(resource: AdminSummaryResource) {
  primeClientResource(summaryStore, 'summary', resource, {
    maxEntries: 1,
    storage: 'session',
    storageKey: 'tanergy.admin-summary',
    ttlMs,
  })
}

export function loadAdminSummaryResource(options: LoadOptions = {}) {
  return loadClientResource(summaryStore, 'summary', loadAdminSummary, {
    force: options.force,
    maxEntries: 1,
    storage: 'session',
    storageKey: 'tanergy.admin-summary',
    ttlMs,
  })
}

export function readAdminUsersDirectoryResource(query: UsersQuery) {
  const key = usersQueryKey(query)
  return readClientResource(usersStore, key, {
    maxEntries: directoryQueryMaxEntries,
    storage: 'session',
    storageKey: usersStorageKey(key),
    storagePrefix: 'tanergy.admin-users.',
    ttlMs,
  })
}

export function primeAdminUsersDirectoryResource(query: UsersQuery, resource: AdminDirectoryUsersResource) {
  const key = usersQueryKey(query)
  primeClientResource(usersStore, key, resource, {
    maxEntries: directoryQueryMaxEntries,
    storage: 'session',
    storageKey: usersStorageKey(key),
    storagePrefix: 'tanergy.admin-users.',
    ttlMs,
  })
}

export function loadAdminUsersDirectoryResource(query: UsersQuery, options: LoadOptions = {}) {
  const key = usersQueryKey(query)
  return loadClientResource(usersStore, key, () => loadAdminDirectoryUsers(query), {
    force: options.force,
    maxEntries: directoryQueryMaxEntries,
    storage: 'session',
    storageKey: usersStorageKey(key),
    storagePrefix: 'tanergy.admin-users.',
    ttlMs,
  })
}

export function readAdminWorkspaceDirectoryResource(query: WorkspacesQuery) {
  const key = workspacesQueryKey(query)
  return readClientResource(workspacesStore, key, {
    maxEntries: directoryQueryMaxEntries,
    storage: 'session',
    storageKey: workspacesStorageKey(key),
    storagePrefix: 'tanergy.admin-workspaces.',
    ttlMs,
  })
}

export function primeAdminWorkspaceDirectoryResource(query: WorkspacesQuery, resource: AdminDirectoryWorkspacesResource) {
  const key = workspacesQueryKey(query)
  primeClientResource(workspacesStore, key, resource, {
    maxEntries: directoryQueryMaxEntries,
    storage: 'session',
    storageKey: workspacesStorageKey(key),
    storagePrefix: 'tanergy.admin-workspaces.',
    ttlMs,
  })
}

export function loadAdminWorkspaceDirectoryResource(query: WorkspacesQuery, options: LoadOptions = {}) {
  const key = workspacesQueryKey(query)
  return loadClientResource(workspacesStore, key, () => loadAdminDirectoryWorkspaces(query), {
    force: options.force,
    maxEntries: directoryQueryMaxEntries,
    storage: 'session',
    storageKey: workspacesStorageKey(key),
    storagePrefix: 'tanergy.admin-workspaces.',
    ttlMs,
  })
}

function usersQueryKey(query: UsersQuery) {
  return `${query.limit}:${query.offset ?? 0}:${query.search?.trim() ?? ''}`
}

function usersStorageKey(key: string) {
  return `tanergy.admin-users.${key}`
}

function workspacesQueryKey(query: WorkspacesQuery) {
  return JSON.stringify({
    kind: query.kind,
    limit: query.limit ?? 100,
    offset: query.offset ?? 0,
    ownerId: query.ownerId ?? '',
    search: query.search?.trim() ?? '',
  })
}

function workspacesStorageKey(key: string) {
  return `tanergy.admin-workspaces.${key}`
}
