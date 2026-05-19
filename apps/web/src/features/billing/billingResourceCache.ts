'use client'

import { loadClientResource } from '@/features/shared/clientResourceCache'

type CacheEntry<T> = {
  data?: T
  error?: string | null
  promise?: Promise<T>
  updatedAt: number
}

type CachedBillingResourceOptions = {
  force?: boolean
  ttlMs?: number
}

const billingResourceMaxEntries = 32
const billingResourceStore = new Map<string, CacheEntry<unknown>>()
export const BILLING_CACHE_INVALIDATION_EVENT = 'tanergy:billing-cache-invalidated'
const billingInvalidationStorageKey = 'tanergy.billing.invalidateAt'
let lastSeenBillingInvalidationAt = 0

export async function loadCachedBillingResource<T>(
  key: string,
  loader: () => Promise<T>,
  options: CachedBillingResourceOptions = {},
): Promise<T> {
  if (typeof window === 'undefined') return loader()
  clearBillingResourcesAfterInvalidation()
  return loadClientResource(
    billingResourceStore as Map<string, CacheEntry<T>>,
    key,
    loader,
    {
      force: options.force,
      maxEntries: billingResourceMaxEntries,
      storage: 'session',
      storageKey: `tanergy.billing.${key}`,
      storagePrefix: 'tanergy.billing.',
      ttlMs: options.ttlMs ?? 60_000,
    },
  )
}

export function clearCachedBillingResources(prefix?: string) {
  clearBillingResourceEntries(prefix)
  writeBillingInvalidationMarker()
  dispatchBillingInvalidationEvent()
}

function clearBillingResourceEntries(prefix?: string) {
  for (const key of [...billingResourceStore.keys()]) {
    if (!prefix || key.startsWith(prefix)) billingResourceStore.delete(key)
  }
  if (typeof window === 'undefined') return
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index)
    if (!key?.startsWith('tanergy.billing.')) continue
    if (!prefix || key.startsWith(`tanergy.billing.${prefix}`)) {
      window.sessionStorage.removeItem(key)
    }
  }
}

function clearBillingResourcesAfterInvalidation() {
  const nextInvalidationAt = readBillingInvalidationMarker()
  if (!nextInvalidationAt || nextInvalidationAt <= lastSeenBillingInvalidationAt) return
  lastSeenBillingInvalidationAt = nextInvalidationAt
  clearBillingResourceEntries()
}

function readBillingInvalidationMarker() {
  if (typeof window === 'undefined') return 0
  try {
    const value = Number(window.localStorage.getItem(billingInvalidationStorageKey) ?? 0)
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function writeBillingInvalidationMarker() {
  if (typeof window === 'undefined') return
  const nextInvalidationAt = Date.now()
  lastSeenBillingInvalidationAt = Math.max(lastSeenBillingInvalidationAt, nextInvalidationAt)
  try {
    window.localStorage.setItem(billingInvalidationStorageKey, String(nextInvalidationAt))
  } catch {
    // Best-effort cross-tab invalidation only; in-memory/session caches were already cleared.
  }
}

function dispatchBillingInvalidationEvent() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(BILLING_CACHE_INVALIDATION_EVENT))
}

export function subscribeToBillingInvalidation(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined
  const handleStorage = (event: StorageEvent) => {
    if (event.key === billingInvalidationStorageKey) callback()
  }
  window.addEventListener(BILLING_CACHE_INVALIDATION_EVENT, callback)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(BILLING_CACHE_INVALIDATION_EVENT, callback)
    window.removeEventListener('storage', handleStorage)
  }
}
