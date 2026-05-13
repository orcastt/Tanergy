import { Buffer } from 'node:buffer'

export const aiInlineImageMaxBytes = 20 * 1024 * 1024

const allowedAiInlineImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function assertAiInlineImageByteLength(byteLength: null | number) {
  if (byteLength !== null && byteLength > aiInlineImageMaxBytes) {
    throw new Error('Reference image must be 20MB or smaller.')
  }
}

export function normalizeAiInlineImageMime(value: null | string | undefined) {
  const mime = value?.split(';')[0]?.trim().toLowerCase() || ''
  if (!allowedAiInlineImageMimes.has(mime)) {
    throw new Error('Reference image must be JPEG, PNG, or WebP.')
  }
  return mime
}

export function parseAiInlineImageDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,([a-zA-Z0-9+/=\s]+)$/s.exec(dataUrl)
  if (!match) throw new Error('Invalid image data URL.')
  const mime = normalizeAiInlineImageMime(match[1])
  const base64 = (match[2] ?? '').replace(/\s+/g, '')
  assertAiInlineImageByteLength(estimateBase64ByteLength(base64))
  const buffer = Buffer.from(base64, 'base64')
  assertAiInlineImageByteLength(buffer.byteLength)
  return { base64: buffer.toString('base64'), buffer, mime }
}

export function normalizeAiInlineImageDataUrl(dataUrl: string) {
  const parsed = parseAiInlineImageDataUrl(dataUrl)
  return `data:${parsed.mime};base64,${parsed.base64}`
}

export function normalizeAiInlineBase64DataUrl(value: string, mime: string) {
  const normalized = value.replace(/\s+/g, '')
  normalizeAiInlineImageMime(mime)
  assertAiInlineImageByteLength(estimateBase64ByteLength(normalized))
  return `data:${mime};base64,${normalized}`
}

export function toAiInlineImageDataUrl(mime: string, bytes: ArrayBuffer) {
  const normalizedMime = normalizeAiInlineImageMime(mime)
  assertAiInlineImageByteLength(bytes.byteLength)
  const buffer = Buffer.from(bytes)
  assertAiInlineImageByteLength(buffer.byteLength)
  return `data:${normalizedMime};base64,${buffer.toString('base64')}`
}

export function arrayBufferFromBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

export function getResponseContentLength(headers: Headers) {
  const raw = headers.get('content-length')
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

export async function readAiInlineResponseBufferWithLimit(response: Response) {
  return readResponseBufferWithLimit(response, aiInlineImageMaxBytes)
}

export async function readJsonResponseWithLimit<T>(response: Response, maxBytes = 8 * 1024 * 1024): Promise<T> {
  const buffer = await readResponseBufferWithLimit(response, maxBytes)
  return JSON.parse(buffer.toString('utf8')) as T
}

export async function readTextResponseWithLimit(response: Response, maxBytes = 256 * 1024) {
  const buffer = await readResponseBufferWithLimit(response, maxBytes)
  return buffer.toString('utf8')
}

function estimateBase64ByteLength(base64: string) {
  if (!base64 || base64.length % 4 !== 0) throw new Error('Invalid image data URL.')
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

async function readResponseBufferWithLimit(response: Response, maxBytes: number) {
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
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
        throw new Error('Response exceeded the maximum allowed size.')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, totalBytes)
}
