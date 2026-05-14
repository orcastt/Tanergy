'use client'

import { acceptedImageMimeTypes, imageMaxBytes } from './imageAssetInputs'

type ParsedImageDataUrl = {
  base64: string
  byteLength: number
  mime: string
}

export function createImageFileFromDataUrlValue(dataUrl: string, fileName?: string) {
  const parsed = parseImageDataUrl(dataUrl)
  const bytes = decodeBase64Bytes(parsed.base64)
  if (bytes.byteLength > imageMaxBytes) {
    throw new Error('Image must be 100MB or smaller.')
  }
  return new File([bytes], ensureImageFileName(fileName, parsed.mime), { type: parsed.mime })
}

export function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl {
  const match = /^data:([^;,]+);base64,([a-zA-Z0-9+/=\s]+)$/s.exec(dataUrl)
  if (!match?.[1]) throw new Error('Invalid image data URL.')
  const mime = match[1].toLowerCase()
  if (!acceptedImageMimeTypes.includes(mime)) {
    throw new Error('Use PNG, JPEG, or WebP.')
  }
  const base64 = (match[2] ?? '').replace(/\s+/g, '')
  const byteLength = getBase64ByteLength(base64)
  if (byteLength > imageMaxBytes) {
    throw new Error('Image must be 100MB or smaller.')
  }
  return { base64, byteLength, mime }
}

export function getDataUrlMime(dataUrl: string) {
  return parseImageDataUrl(dataUrl).mime
}

export function getBase64ByteLength(base64: string) {
  if (!base64 || base64.length % 4 !== 0) throw new Error('Invalid image data URL.')
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

function decodeBase64Bytes(base64: string) {
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function ensureImageFileName(fileName: string | undefined, mime: string) {
  const trimmed = fileName?.trim()
  if (trimmed) return trimmed
  return `image.${mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'}`
}
