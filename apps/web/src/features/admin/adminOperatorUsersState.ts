'use client'

import { limitOptions } from './adminAiShared'
import { readAdminOperatorUsersResource } from './adminOperatorUsersCache'
import type { AdminOperatorUsersResource } from './adminTypes'
import { readAdminUsersViewState } from './adminUsersViewState'

const emptyUsers: AdminOperatorUsersResource = { limit: 0, offset: 0, ok: false, totalCount: 0, users: [] }

export function getInitialAdminOperatorUsersState(seedResource: AdminOperatorUsersResource) {
  const initialViewState = readAdminUsersViewState()
  const limit = limitOptions.includes((initialViewState?.limit ?? seedResource.limit) as (typeof limitOptions)[number])
    ? (initialViewState?.limit ?? seedResource.limit) as (typeof limitOptions)[number]
    : 100
  const offset = initialViewState?.offset ?? seedResource.offset ?? 0
  const searchDraft = initialViewState?.searchDraft ?? ''
  const searchQuery = initialViewState?.searchQuery ?? ''
  const query = { limit, offset, search: searchQuery || undefined }
  const snapshot = readAdminOperatorUsersResource(query)
  const signature = adminOperatorUsersQuerySignature(query)
  const seedSignature = adminOperatorUsersQuerySignature({
    limit: seedResource.limit || 100,
    offset: seedResource.offset || 0,
  })
  const seedMatchesInitialQuery = seedResource.ok && signature === seedSignature

  return {
    error: seedMatchesInitialQuery ? (seedResource.error ?? null) : (snapshot.error ?? null),
    limit,
    offset,
    resource: seedMatchesInitialQuery ? seedResource : (snapshot.data ?? emptyUsers),
    searchDraft,
    searchQuery,
    seedMatchesInitialQuery,
    signature,
    snapshot,
    viewState: initialViewState,
  }
}

export function adminOperatorUsersQuerySignature(query: { limit: number; offset: number; search?: string }) {
  return `${query.limit}:${query.offset}:${query.search ?? ''}`
}
