import { Buffer } from 'node:buffer'

const allowedRemoteImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxRemoteImageBytes = 30 * 1024 * 1024
const remoteFetchTimeoutMs = 8000

export type RemoteImageImportResult = {
  bytes: ArrayBuffer
  fileName: string
  height?: number
  mime: string
  width?: number
}

export async function fetchRemoteImageForAsset(url: string): Promise<RemoteImageImportResult> {
  const parsed = assertSafeRemoteImageUrl(url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), remoteFetchTimeoutMs)
  try {
    const response = await fetch(parsed.toString(), {
      headers: { Accept: 'image/png,image/jpeg,image/webp' },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('Remote image fetch failed.')
    const mime = getResponseImageMime(response.headers.get('content-type'))
    if (!mime) throw new Error('Remote URL did not return a supported image.')
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > maxRemoteImageBytes) throw new Error('Image must be 30MB or smaller.')
    const dimensions = getImageDimensions(bytes, mime)
    return {
      bytes,
      fileName: getRemoteImageFileName(parsed, mime),
      height: dimensions?.height,
      mime,
      width: dimensions?.width,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function assertSafeRemoteImageUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('Invalid remote image URL.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Remote image URL must use HTTP or HTTPS.')
  if (isBlockedHostname(parsed.hostname)) throw new Error('Remote image URL host is not allowed.')
  parsed.hash = ''
  return parsed
}

function isBlockedHostname(hostname: string) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (value === 'localhost' || value.endsWith('.localhost')) return true
  if (value === '0.0.0.0' || value === '::1') return true
  if (/^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value)) return true
  const match = /^172\.(\d+)\./.exec(value)
  if (match) {
    const octet = Number(match[1])
    if (octet >= 16 && octet <= 31) return true
  }
  return false
}

function getResponseImageMime(contentType: string | null) {
  const mime = contentType?.split(';')[0]?.trim().toLowerCase() ?? ''
  return allowedRemoteImageMimeTypes.has(mime) ? mime : null
}

function getRemoteImageFileName(url: URL, mime: string) {
  const name = url.pathname.split('/').filter(Boolean).at(-1)
  const cleanName = name?.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  if (cleanName && /\.(png|jpe?g|webp)$/i.test(cleanName)) return cleanName
  return `remote-image.${getExtension(mime)}`
}

function getImageDimensions(bytes: ArrayBuffer, mime: string) {
  const buffer = Buffer.from(bytes)
  if (mime === 'image/png') return getPngDimensions(buffer)
  if (mime === 'image/jpeg') return getJpegDimensions(buffer)
  if (mime === 'image/webp') return getWebpDimensions(buffer)
  return null
}

function getPngDimensions(buffer: Buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null
  return { height: buffer.readUInt32BE(20), width: buffer.readUInt32BE(16) }
}

function getJpegDimensions(buffer: Buffer) {
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  return null
}

function getWebpDimensions(buffer: Buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null
  const chunk = buffer.toString('ascii', 12, 16)
  if (chunk === 'VP8X') {
    return {
      height: 1 + buffer.readUIntLE(27, 3),
      width: 1 + buffer.readUIntLE(24, 3),
    }
  }
  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return { height: buffer.readUInt16LE(28) & 0x3fff, width: buffer.readUInt16LE(26) & 0x3fff }
  }
  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21)
    return { height: 1 + ((bits >> 14) & 0x3fff), width: 1 + (bits & 0x3fff) }
  }
  return null
}

function getExtension(mime: string) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}
