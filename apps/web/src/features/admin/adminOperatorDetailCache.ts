'use client'

import { applyAdminOperatorDetailMutation } from './adminOperatorDetailMutations'
import type { AdminOperatorAction } from './adminOperatorActions'
import type { AdminOperatorMutationResult } from './adminOperatorActionMutations'
import { loadAdminOperatorUserDetail } from './adminOperatorClient'
import type { AdminOperatorUserDetailResource } from './adminTypes'
import { loadClientResource, primeClientResource, readClientResource } from '@/features/shared/clientResourceCache'

const detailStore = new Map<string, {
  data?: AdminOperatorUserDetailResource
  error?: string | null
  promise?: Promise<AdminOperatorUserDetailResource>
  updatedAt: number
}>()
const detailMaxEntries = 48

export function primeAdminOperatorUserDetail(userId: string, resource: AdminOperatorUserDetailResource) {
  primeClientResource(detailStore, userId, resource, cacheOptions(userId))
}

export function clearAdminOperatorUserDetail(userId: string) {
  detailStore.delete(userId)
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(cacheOptions(userId).storageKey)
  }
}

export function readAdminOperatorUserDetail(userId: string) {
  return readClientResource(detailStore, userId, cacheOptions(userId))
}

export function patchAdminOperatorUserDetailStatus(userId: string, status: string) {
  const current = readAdminOperatorUserDetail(userId).data
  if (!current?.detail) return
  primeAdminOperatorUserDetail(userId, {
    ...current,
    detail: {
      ...current.detail,
      user: {
        ...current.detail.user,
        status,
      },
    },
  })
}

export function patchAdminOperatorUserDetailMutation(
  userId: string,
  action: AdminOperatorAction,
  result: AdminOperatorMutationResult,
) {
  const current = readAdminOperatorUserDetail(userId).data
  if (!current?.detail) return null
  const nextDetail = applyAdminOperatorDetailMutation(current.detail, action, result)
  if (!nextDetail) return null
  primeAdminOperatorUserDetail(userId, {
    ...current,
    detail: nextDetail,
  })
  return nextDetail
}

export function loadAdminOperatorUserDetailResource(userId: string, options: { force?: boolean } = {}) {
  return loadClientResource(
    detailStore,
    userId,
    () => loadAdminOperatorUserDetail(userId),
    {
      ...cacheOptions(userId),
      canReuse: (resource) => resource.ok && Boolean(resource.detail),
      force: options.force,
    },
  )
}

function cacheOptions(userId: string) {
  return {
    storage: 'session' as const,
    storageKey: `tanergy.admin-operator.user-detail.${userId}`,
    storagePrefix: 'tanergy.admin-operator.user-detail.',
    maxEntries: detailMaxEntries,
    ttlMs: 300_000,
  }
}
