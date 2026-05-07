import { getImageDimensionsFromBytes, getImageExtensionFromMime } from './imageByteMetadata'

const allowedRemoteImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxRemoteImageBytes = 100 * 1024 * 1024
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
    if (bytes.byteLength > maxRemoteImageBytes) throw new Error('Image must be 100MB or smaller.')
    const dimensions = getImageDimensionsFromBytes(bytes, mime)
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
  return `remote-image.${getImageExtensionFromMime(mime)}`
}
