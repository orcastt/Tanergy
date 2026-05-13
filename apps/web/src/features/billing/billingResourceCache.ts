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

export async function loadCachedBillingResource<T>(
  key: string,
  loader: () => Promise<T>,
  options: CachedBillingResourceOptions = {},
): Promise<T> {
  if (typeof window === 'undefined') return loader()
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
