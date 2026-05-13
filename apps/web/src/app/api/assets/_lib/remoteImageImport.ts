import { Buffer } from 'node:buffer'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { getImageDimensionsFromBytes, getImageExtensionFromMime } from './imageByteMetadata'

const allowedRemoteImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxRemoteImageBytes = 100 * 1024 * 1024
const remoteFetchTimeoutMs = 8000
const maxRemoteImageRedirects = 3

export type RemoteImageImportResult = {
  bytes: ArrayBuffer
  fileName: string
  height?: number
  mime: string
  width?: number
}

export async function fetchRemoteImageForAsset(url: string): Promise<RemoteImageImportResult> {
  const parsed = await assertSafeRemoteImageUrl(url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), remoteFetchTimeoutMs)
  try {
    const { response, url: finalUrl } = await fetchRemoteImageResponse(parsed, controller.signal)
    if (!response.ok) throw new Error('Remote image fetch failed.')
    const mime = getResponseImageMime(response.headers.get('content-type'))
    if (!mime) throw new Error('Remote URL did not return a supported image.')
    assertRemoteImageByteLength(getContentLength(response.headers))
    const bytes = await readResponseBytesWithLimit(response, maxRemoteImageBytes)
    const dimensions = getImageDimensionsFromBytes(bytes, mime)
    return {
      bytes,
      fileName: getRemoteImageFileName(finalUrl, mime),
      height: dimensions?.height,
      mime,
      width: dimensions?.width,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchRemoteImageResponse(initialUrl: URL, signal: AbortSignal) {
  let currentUrl = initialUrl
  for (let redirectCount = 0; redirectCount <= maxRemoteImageRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl.toString(), {
      headers: { Accept: 'image/png,image/jpeg,image/webp' },
      redirect: 'manual',
      signal,
    })
    if (!isRedirectResponse(response.status)) return { response, url: currentUrl }
    const location = response.headers.get('location')
    if (!location) throw new Error('Remote image redirect was missing a target.')
    currentUrl = await assertSafeRemoteImageUrl(new URL(location, currentUrl).toString())
  }
  throw new Error('Remote image redirected too many times.')
}

async function assertSafeRemoteImageUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('Invalid remote image URL.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Remote image URL must use HTTP or HTTPS.')
  await assertRemoteHostnameAllowed(parsed.hostname)
  parsed.hash = ''
  return parsed
}

async function assertRemoteHostnameAllowed(hostname: string) {
  if (isBlockedHostname(hostname)) throw new Error('Remote image URL host is not allowed.')
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(normalized)) return
  let addresses: Array<{ address: string }> = []
  try {
    addresses = await lookup(normalized, { all: true, verbatim: true })
  } catch {
    throw new Error('Remote image host could not be resolved.')
  }
  if (addresses.length === 0 || addresses.some((item) => isBlockedHostname(item.address))) {
    throw new Error('Remote image URL host is not allowed.')
  }
}

function isBlockedHostname(hostname: string) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (value === 'localhost' || value.endsWith('.localhost')) return true
  if (value === '0.0.0.0' || value === '::' || value === '::1') return true
  if (value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true
  if (/^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value)) return true
  if (/^169\.254\./.test(value)) return true
  const carrierNatMatch = /^100\.(\d+)\./.exec(value)
  if (carrierNatMatch) {
    const octet = Number(carrierNatMatch[1])
    if (octet >= 64 && octet <= 127) return true
  }
  const match = /^172\.(\d+)\./.exec(value)
  if (match) {
    const octet = Number(match[1])
    if (octet >= 16 && octet <= 31) return true
  }
  return false
}

function isRedirectResponse(status: number) {
  return status >= 300 && status < 400
}

function getResponseImageMime(contentType: string | null) {
  const mime = contentType?.split(';')[0]?.trim().toLowerCase() ?? ''
  return allowedRemoteImageMimeTypes.has(mime) ? mime : null
}

function getContentLength(headers: Headers) {
  const raw = headers.get('content-length')
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function assertRemoteImageByteLength(byteLength: null | number) {
  if (byteLength !== null && byteLength > maxRemoteImageBytes) {
    throw new Error('Image must be 100MB or smaller.')
  }
}

async function readResponseBytesWithLimit(response: Response, maxBytes: number) {
  if (!response.body) return new ArrayBuffer(0)
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new Error('Image must be 100MB or smaller.')
    }
    chunks.push(Buffer.from(value))
  }
  const buffer = Buffer.concat(chunks, totalBytes)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function getRemoteImageFileName(url: URL, mime: string) {
  const name = url.pathname.split('/').filter(Boolean).at(-1)
  const cleanName = name?.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  if (cleanName && /\.(png|jpe?g|webp)$/i.test(cleanName)) return cleanName
  return `remote-image.${getImageExtensionFromMime(mime)}`
}
