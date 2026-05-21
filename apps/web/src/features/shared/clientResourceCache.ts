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
  maxEntries?: number
  maxPersistBytes?: number
  storage?: StorageTarget
  storageKey?: string
  storagePrefix?: string
  ttlMs?: number
}

type PersistedEntry<T> = {
  data?: T
  error?: string | null
  updatedAt: number
}

const defaultMaxPersistBytes = 512 * 1024

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
  enforceClientResourceLimit(store, options)
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
      enforceClientResourceLimit(store, options)
      return data
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Resource lookup failed.'
      const entry = { error: message, updatedAt: Date.now() }
      store.set(key, entry)
      persistEntry(options, entry)
      enforceClientResourceLimit(store, options)
      throw error
    })

  store.set(key, {
    data: current?.data,
    error: current?.error ?? null,
    promise,
    updatedAt: current?.updatedAt ?? now,
  })
  enforceClientResourceLimit(store, options)
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
  enforceClientResourceLimit(store, options)
  return store.get(key)
}

function persistEntry<T>(options: LoadOptions<T>, entry: PersistedEntry<T>) {
  if (!options.storageKey) return
  const storage = getStorage(options.storage)
  if (!storage) return
  try {
    const serialized = JSON.stringify(entry)
    if (serialized.length > getMaxPersistBytes(options)) {
      storage.removeItem(options.storageKey)
      return
    }
    storage.setItem(options.storageKey, serialized)
  } catch {
    storage.removeItem(options.storageKey)
  }
}

function readPersistedEntry<T>(options: LoadOptions<T>): CacheEntry<T> | undefined {
  if (!options.storageKey) return undefined
  const storage = getStorage(options.storage)
  if (!storage) return undefined
  const raw = storage.getItem(options.storageKey)
  if (!raw) return undefined
  if (raw.length > getMaxPersistBytes(options)) {
    storage.removeItem(options.storageKey)
    return undefined
  }

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

function enforceClientResourceLimit<T>(store: Map<string, CacheEntry<T>>, options: LoadOptions<T>) {
  const maxEntries = options.maxEntries
  if (!maxEntries || maxEntries < 1) return
  if (store.size > maxEntries) {
    const entries = [...store.entries()].sort((left, right) => left[1].updatedAt - right[1].updatedAt)
    for (const [key, entry] of entries.slice(0, store.size - maxEntries)) {
      if (entry.promise) continue
      store.delete(key)
      removePersistedEntry(options, key)
    }
  }
  prunePersistedEntries(options, maxEntries)
}

function removePersistedEntry<T>(options: LoadOptions<T>, key: string) {
  const storage = getStorage(options.storage)
  if (!storage) return
  if (options.storagePrefix) {
    storage.removeItem(`${options.storagePrefix}${key}`)
    return
  }
  if (options.storageKey?.endsWith(key)) storage.removeItem(options.storageKey)
}

function prunePersistedEntries<T>(options: LoadOptions<T>, maxEntries: number) {
  if (!options.storagePrefix) return
  const storage = getStorage(options.storage)
  if (!storage) return
  const entries: Array<{ key: string; updatedAt: number }> = []
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index)
    if (!key?.startsWith(options.storagePrefix)) continue
    const raw = storage.getItem(key)
    if (!raw) continue
    if (raw.length > getMaxPersistBytes(options)) {
      storage.removeItem(key)
      continue
    }
    try {
      const entry = JSON.parse(raw) as PersistedEntry<unknown>
      entries.push({ key, updatedAt: Number(entry.updatedAt) || 0 })
    } catch {
      entries.push({ key, updatedAt: 0 })
    }
  }
  if (entries.length <= maxEntries) return
  entries
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .slice(0, entries.length - maxEntries)
    .forEach((entry) => storage.removeItem(entry.key))
}

function getMaxPersistBytes<T>(options: LoadOptions<T>) {
  return options.maxPersistBytes && options.maxPersistBytes > 0
    ? options.maxPersistBytes
    : defaultMaxPersistBytes
}
