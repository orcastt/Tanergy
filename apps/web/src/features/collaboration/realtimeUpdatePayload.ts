'use client'

export type RealtimeUpdatePayload = number[] | {
  byteLength: number
  data: string
  encoding: 'base64'
}

const base64UpdateThresholdBytes = 64 * 1024

export function encodeRealtimeUpdatePayload(
  update: Uint8Array,
  options: {
    label: string
    maxBytes: number
    onError: (message: string) => void
  },
): RealtimeUpdatePayload | null {
  if (update.byteLength > options.maxBytes) {
    options.onError(`${options.label} exceeded the websocket update limit.`)
    return null
  }
  if (update.byteLength < base64UpdateThresholdBytes) return Array.from(update)
  return {
    byteLength: update.byteLength,
    data: bytesToBase64(update),
    encoding: 'base64',
  }
}

export function decodeRealtimeUpdatePayload(value: unknown, maxBytes: number): Uint8Array | null {
  if (Array.isArray(value)) {
    if (value.length > maxBytes) return null
    if (!value.every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 255)) return null
    return Uint8Array.from(value)
  }
  if (!value || typeof value !== 'object') return null
  const payload = value as Partial<Extract<RealtimeUpdatePayload, { encoding: 'base64' }>>
  if (payload.encoding !== 'base64' || typeof payload.data !== 'string') return null
  if (typeof payload.byteLength !== 'number' || !Number.isInteger(payload.byteLength) || payload.byteLength < 0 || payload.byteLength > maxBytes) return null
  try {
    const bytes = base64ToBytes(payload.data)
    return bytes.byteLength === payload.byteLength ? bytes : null
  } catch {
    return null
  }
}

function bytesToBase64(bytes: Uint8Array) {
  const chunks: string[] = []
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    let binary = ''
    for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
      binary += String.fromCharCode(chunk[chunkIndex] ?? 0)
    }
    chunks.push(binary)
  }
  return btoa(chunks.join(''))
}

function base64ToBytes(data: string) {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
