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
  let orientation = 1
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null
    const marker = buffer[offset + 1]
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = buffer.readUInt16BE(offset + 2)
    if (marker === 0xe1) {
      const parsedOrientation = getJpegExifOrientation(buffer.subarray(offset + 4, offset + 2 + length))
      if (parsedOrientation) orientation = parsedOrientation
    }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      const height = buffer.readUInt16BE(offset + 5)
      const width = buffer.readUInt16BE(offset + 7)
      return orientation >= 5 && orientation <= 8
        ? { height: width, width: height }
        : { height, width }
    }
    offset += 2 + length
  }
  return null
}

function getJpegExifOrientation(buffer: Buffer) {
  if (buffer.length < 14 || buffer.toString('ascii', 0, 6) !== 'Exif\u0000\u0000') return null
  const tiffOffset = 6
  const byteOrder = buffer.toString('ascii', tiffOffset, tiffOffset + 2)
  const littleEndian = byteOrder === 'II'
  if (!littleEndian && byteOrder !== 'MM') return null
  const readUInt16 = (offset: number) => littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset)
  const readUInt32 = (offset: number) => littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset)
  if (readUInt16(tiffOffset + 2) !== 42) return null
  const ifdOffset = tiffOffset + readUInt32(tiffOffset + 4)
  if (ifdOffset + 2 > buffer.length) return null
  const entryCount = readUInt16(ifdOffset)
  let cursor = ifdOffset + 2
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 12 > buffer.length) return null
    const tag = readUInt16(cursor)
    const fieldType = readUInt16(cursor + 2)
    const count = readUInt32(cursor + 4)
    if (tag === 0x0112 && fieldType === 3 && count >= 1) {
      return readUInt16(cursor + 8)
    }
    cursor += 12
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
