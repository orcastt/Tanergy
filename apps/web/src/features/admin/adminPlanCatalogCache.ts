'use client'

import { loadAdminPlanCatalog, type AdminPlanCatalogResource } from './adminFinanceClient'
import { loadClientResource, primeClientResource, readClientResource } from '@/features/shared/clientResourceCache'

const ttlMs = 300_000

type CacheEntry<T> = {
  data?: T
  error?: string | null
  promise?: Promise<T>
  updatedAt: number
}

type LoadOptions = {
  force?: boolean
}

const planCatalogStore = new Map<string, CacheEntry<AdminPlanCatalogResource>>()

export function readAdminPlanCatalogResource() {
  return readClientResource(planCatalogStore, 'plan-catalog', {
    maxEntries: 1,
    storage: 'session',
    storageKey: 'tanergy.admin-plan-catalog',
    ttlMs,
  })
}

export function primeAdminPlanCatalogResource(resource: AdminPlanCatalogResource) {
  primeClientResource(planCatalogStore, 'plan-catalog', resource, {
    maxEntries: 1,
    storage: 'session',
    storageKey: 'tanergy.admin-plan-catalog',
    ttlMs,
  })
}

export function loadAdminPlanCatalogResource(options: LoadOptions = {}) {
  return loadClientResource(planCatalogStore, 'plan-catalog', loadAdminPlanCatalog, {
    force: options.force,
    maxEntries: 1,
    storage: 'session',
    storageKey: 'tanergy.admin-plan-catalog',
    ttlMs,
  })
}
