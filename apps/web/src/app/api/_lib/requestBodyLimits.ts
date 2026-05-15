import { Buffer } from 'node:buffer'
import { LocalRuntimeBridgeDisabledError } from '@/features/api/runtimeBridgePolicy'

export class RequestBodyTooLargeError extends Error {
  readonly status = 413

  constructor(message = 'Request body is too large.') {
    super(message)
    this.name = 'RequestBodyTooLargeError'
  }
}

export async function readJsonRequestWithLimit<T>(request: Request, maxBytes: number): Promise<T> {
  assertRequestContentLength(request, maxBytes)
  const body = await readRequestBufferWithLimit(request, maxBytes)
  if (body.byteLength === 0) throw new Error('Missing request body.')
  return JSON.parse(body.toString('utf8')) as T
}

export function assertRequestContentLength(
  request: Request,
  maxBytes: number,
  message = 'Request body is too large.',
) {
  const raw = request.headers.get('content-length')
  if (!raw) return
  const byteLength = Number(raw)
  if (Number.isFinite(byteLength) && byteLength > maxBytes) {
    throw new RequestBodyTooLargeError(message)
  }
}

export async function readFileArrayBufferWithLimit(
  file: File,
  maxBytes: number,
  message = 'Request body is too large.',
) {
  if (Number.isFinite(file.size) && file.size > maxBytes) {
    throw new RequestBodyTooLargeError(message)
  }
  const reader = file.stream().getReader()
  const buffer = new Uint8Array(file.size)
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new RequestBodyTooLargeError(message)
      }
      buffer.set(value, totalBytes - value.byteLength)
    }
  } finally {
    reader.releaseLock()
  }
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + totalBytes) as ArrayBuffer
}

export function requestBodyErrorStatus(error: unknown, fallback = 400) {
  if (error instanceof LocalRuntimeBridgeDisabledError) return error.status
  if (typeof error === 'object' && error && 'status' in error && typeof error.status === 'number') {
    return error.status
  }
  return error instanceof RequestBodyTooLargeError ? error.status : fallback
}

async function readRequestBufferWithLimit(request: Request, maxBytes: number) {
  if (!request.body) return Buffer.alloc(0)
  const declaredLength = getDeclaredContentLength(request)
  const reader = request.body.getReader()
  const chunks: Buffer[] = declaredLength === null ? [] : []
  const buffer = declaredLength !== null ? Buffer.allocUnsafe(declaredLength) : null
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new RequestBodyTooLargeError()
      }
      if (buffer) {
        buffer.set(value, totalBytes - value.byteLength)
      } else {
        chunks.push(Buffer.from(value))
      }
    }
  } finally {
    reader.releaseLock()
  }
  if (buffer) return totalBytes === buffer.byteLength ? buffer : buffer.subarray(0, totalBytes)
  return Buffer.concat(chunks, totalBytes)
}

function getDeclaredContentLength(request: Request) {
  const raw = request.headers.get('content-length')
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}
