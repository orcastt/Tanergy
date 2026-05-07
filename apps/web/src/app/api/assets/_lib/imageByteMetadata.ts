import { Buffer } from 'node:buffer'

export function getImageDimensionsFromBytes(bytes: ArrayBuffer, mime: string) {
  const buffer = Buffer.from(bytes)
  if (mime === 'image/png') return getPngDimensions(buffer)
  if (mime === 'image/jpeg') return getJpegDimensions(buffer)
  if (mime === 'image/webp') return getWebpDimensions(buffer)
  return null
}

export function getImageExtensionFromMime(mime: string) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
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
