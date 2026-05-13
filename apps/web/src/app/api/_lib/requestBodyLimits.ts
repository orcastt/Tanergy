import { Buffer } from 'node:buffer'

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

export function requestBodyErrorStatus(error: unknown, fallback = 400) {
  return error instanceof RequestBodyTooLargeError ? error.status : fallback
}

function assertRequestContentLength(request: Request, maxBytes: number) {
  const raw = request.headers.get('content-length')
  if (!raw) return
  const byteLength = Number(raw)
  if (Number.isFinite(byteLength) && byteLength > maxBytes) {
    throw new RequestBodyTooLargeError()
  }
}

async function readRequestBufferWithLimit(request: Request, maxBytes: number) {
  if (!request.body) return Buffer.alloc(0)
  const reader = request.body.getReader()
  const chunks: Buffer[] = []
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
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, totalBytes)
}
