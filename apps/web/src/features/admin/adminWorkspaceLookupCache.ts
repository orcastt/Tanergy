'use client'

import { loadAdminDirectoryWorkspaces, type AdminDirectoryWorkspaceRecord } from './adminDirectoryClient'
import { loadClientResource, readClientResource } from '@/features/shared/clientResourceCache'

const workspaceLookupStore = new Map<string, {
  data?: AdminDirectoryWorkspaceRecord[]
  error?: string | null
  promise?: Promise<AdminDirectoryWorkspaceRecord[]>
  updatedAt: number
}>()

const workspaceById = new Map<string, AdminDirectoryWorkspaceRecord>()

export function loadAdminWorkspaceLookup(query: {
  kind: 'group_workspace' | 'team_workspace'
  limit?: number
  search?: string
}) {
  const signature = workspaceLookupKey(query)
  return loadClientResource(
    workspaceLookupStore,
    signature,
    async () => {
      const resource = await loadAdminDirectoryWorkspaces(query)
      primeWorkspaceRecords(resource.workspaces)
      return resource.workspaces
    },
    {
      storage: 'local',
      storageKey: `tanergy.admin.workspace-lookup.${signature}`,
      ttlMs: 120_000,
    },
  )
}

export function readAdminWorkspaceLookup(query: {
  kind: 'group_workspace' | 'team_workspace'
  limit?: number
  search?: string
}) {
  const signature = workspaceLookupKey(query)
  return readClientResource(workspaceLookupStore, signature, {
    storage: 'local',
    storageKey: `tanergy.admin.workspace-lookup.${signature}`,
    ttlMs: 120_000,
  })
}

export function readAdminWorkspaceLookupRecord(workspaceId: string) {
  return workspaceById.get(workspaceId) ?? null
}

function primeWorkspaceRecords(records: AdminDirectoryWorkspaceRecord[]) {
  for (const record of records) workspaceById.set(record.id, record)
}

function workspaceLookupKey(query: {
  kind: 'group_workspace' | 'team_workspace'
  limit?: number
  search?: string
}) {
  return `${query.kind}:${query.limit ?? 50}:${query.search?.trim() ?? ''}`
}
