import * as Y from 'yjs'

export function ensureArray<T = unknown>(target: Y.Map<unknown>, key: string) {
  const current = target.get(key)
  if (current instanceof Y.Array) return current as Y.Array<T>
  const next = new Y.Array<T>()
  target.set(key, next)
  return next
}

export function ensureMap(target: Y.Map<unknown>, key: string) {
  const current = target.get(key)
  if (current instanceof Y.Map) return current
  const next = new Y.Map<unknown>()
  target.set(key, next)
  return next
}

export function readIdArray(value: unknown, defaultIds: string[]) {
  if (!(value instanceof Y.Array) || !isAttachedYType(value)) return [...defaultIds]
  const ids = value.toArray().filter((entry): entry is string => typeof entry === 'string')
  return ids.length > 0 ? ids : [...defaultIds]
}

export function readPlainValue(value: unknown): unknown {
  if (value instanceof Y.Map) {
    if (!isAttachedYType(value)) return {}
    return Object.fromEntries(Array.from(value.entries()).map(([key, entry]) => [key, readPlainValue(entry)]))
  }
  if (value instanceof Y.Array) {
    if (!isAttachedYType(value)) return []
    return value.toArray().map((entry) => readPlainValue(entry))
  }
  return value
}

export function setPrimitive(target: Y.Map<unknown>, key: string, value: unknown) {
  if (Object.is(target.get(key), value)) return
  target.set(key, value)
}

export function setOptionalPrimitive(target: Y.Map<unknown>, key: string, value: null | unknown) {
  if (value === null) {
    if (target.has(key)) target.delete(key)
    return
  }
  setPrimitive(target, key, value)
}

export function syncIdArray(target: Y.Array<string>, ids: readonly string[]) {
  const current = target.toArray().filter((value): value is string => typeof value === 'string')
  for (let index = current.length - 1; index >= 0; index -= 1) {
    if (!ids.includes(current[index]!)) {
      target.delete(index, 1)
      current.splice(index, 1)
    }
  }
  for (let index = 0; index < ids.length; index += 1) {
    const nextId = ids[index]!
    if (current[index] === nextId) continue
    const existingIndex = current.indexOf(nextId)
    if (existingIndex >= 0) {
      target.delete(existingIndex, 1)
      current.splice(existingIndex, 1)
    }
    target.insert(index, [nextId])
    current.splice(index, 0, nextId)
  }
  if (current.length > ids.length) {
    target.delete(ids.length, current.length - ids.length)
  }
}

export function syncPlainObject(
  target: Y.Map<unknown>,
  value: Record<string, unknown>,
  preserveKeys: ReadonlySet<string> = new Set(),
) {
  const nextKeys = new Set([...preserveKeys, ...Object.keys(value)])
  for (const key of Array.from(target.keys())) {
    if (!nextKeys.has(key)) target.delete(key)
  }
  for (const [key, nextValue] of Object.entries(value)) {
    syncPlainField(target, key, nextValue)
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

export function syncPlainField(target: Y.Map<unknown>, key: string, value: unknown) {
  if (value === undefined) {
    if (target.has(key)) target.delete(key)
    return
  }
  if (Array.isArray(value)) {
    const array = ensureArray(target, key)
    const current = readPlainValue(array)
    if (isSamePlainValue(current, value)) return
    array.delete(0, array.length)
    array.insert(0, value.map(createYValue))
    return
  }
  if (isPlainObject(value)) {
    syncPlainObject(ensureMap(target, key), value)
    return
  }
  setPrimitive(target, key, value)
}

function createYValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const next = new Y.Array()
    next.insert(0, value.map(createYValue))
    return next
  }
  if (isPlainObject(value)) {
    const next = new Y.Map()
    syncPlainObject(next, value)
    return next
  }
  return value
}

function isSamePlainValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isAttachedYType(value: Y.Array<unknown> | Y.Map<unknown>) {
  return value.doc !== null
}
