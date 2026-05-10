'use client'

export type ClientResourceStatus = 'empty' | 'error' | 'loading' | 'ready'
type StorageTarget = 'local' | 'session'

type CacheEntry<T> = {
  data?: T
  error?: string | null
  promise?: Promise<T>
  updatedAt: number
}

type LoadOptions<T> = {
  canReuse?: (data: T) => boolean
  force?: boolean
  storage?: StorageTarget
  storageKey?: string
  ttlMs?: number
}

type PersistedEntry<T> = {
  data?: T
  error?: string | null
  updatedAt: number
}

export function readClientResource<T>(store: Map<string, CacheEntry<T>>, key: string, options: LoadOptions<T> = {}): {
  data?: T
  error?: string | null
  status: ClientResourceStatus
} {
  const entry = hydrateClientResource(store, key, options)
  if (!entry) return { status: 'empty' }
  if (entry.data !== undefined) return { data: entry.data, error: entry.error ?? null, status: 'ready' }
  if (entry.promise) return { error: entry.error ?? null, status: 'loading' }
  if (entry.error) return { error: entry.error, status: 'error' }
  return { status: 'empty' }
}

export function primeClientResource<T>(store: Map<string, CacheEntry<T>>, key: string, data: T, options: LoadOptions<T> = {}) {
  const entry = { data, error: null, updatedAt: Date.now() }
  store.set(key, entry)
  persistEntry(options, entry)
}

export async function loadClientResource<T>(
  store: Map<string, CacheEntry<T>>,
  key: string,
  loader: () => Promise<T>,
  options: LoadOptions<T> = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? 60_000
  const now = Date.now()
  const current = hydrateClientResource(store, key, options)

  if (
    !options.force &&
    current?.data !== undefined &&
    now - current.updatedAt < ttlMs &&
    (options.canReuse ? options.canReuse(current.data) : true)
  ) {
    return current.data
  }

  if (!options.force && current?.promise) {
    return current.promise
  }

  const promise = loader()
    .then((data) => {
      const entry = { data, error: null, updatedAt: Date.now() }
      store.set(key, entry)
      persistEntry(options, entry)
      return data
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Resource lookup failed.'
      const entry = { error: message, updatedAt: Date.now() }
      store.set(key, entry)
      persistEntry(options, entry)
      throw error
    })

  store.set(key, {
    data: current?.data,
    error: current?.error ?? null,
    promise,
    updatedAt: current?.updatedAt ?? now,
  })
  return promise
}

function hydrateClientResource<T>(store: Map<string, CacheEntry<T>>, key: string, options: LoadOptions<T>) {
  const current = store.get(key)
  const ttlMs = options.ttlMs ?? 60_000
  if (current) {
    if (Date.now() - current.updatedAt <= ttlMs || current.promise) return current
    store.delete(key)
  }
  const persisted = readPersistedEntry<T>(options)
  if (!persisted) return undefined
  store.set(key, persisted)
  return persisted
}

function persistEntry<T>(options: LoadOptions<T>, entry: PersistedEntry<T>) {
  if (!options.storageKey) return
  const storage = getStorage(options.storage)
  if (!storage) return
  storage.setItem(options.storageKey, JSON.stringify(entry))
}

function readPersistedEntry<T>(options: LoadOptions<T>): CacheEntry<T> | undefined {
  if (!options.storageKey) return undefined
  const storage = getStorage(options.storage)
  if (!storage) return undefined
  const raw = storage.getItem(options.storageKey)
  if (!raw) return undefined

  try {
    const entry = JSON.parse(raw) as PersistedEntry<T>
    const ttlMs = options.ttlMs ?? 60_000
    if (!entry.updatedAt || Date.now() - entry.updatedAt > ttlMs) {
      storage.removeItem(options.storageKey)
      return undefined
    }
    return { data: entry.data, error: entry.error ?? null, updatedAt: entry.updatedAt }
  } catch {
    storage.removeItem(options.storageKey)
    return undefined
  }
}

function getStorage(target: StorageTarget | undefined) {
  if (typeof window === 'undefined') return null
  if (target === 'session') return window.sessionStorage
  return window.localStorage
}
