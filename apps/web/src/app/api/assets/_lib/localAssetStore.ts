import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  TangentAssetDataUrlInput,
  TangentAssetRecord,
  TangentAssetThumbnailInput,
} from '@/features/assets/assetTypes'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxAssetBytes = 30 * 1024 * 1024
const storageRoot = process.env.TANGENT_ASSET_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-assets')
const assetsRoot = path.join(storageRoot, 'assets')

type ParsedDataUrl = {
  buffer: Buffer
  mime: string
}

export async function createLocalAssetFromDataUrl(input: TangentAssetDataUrlInput) {
  const original = parseImageDataUrl(input.dataUrl)
  assertImageMime(original.mime)
  assertAssetSize(original.buffer.byteLength)

  const assetId = `asset_${randomUUID()}`
  const assetDir = path.join(assetsRoot, assetId)
  await mkdir(assetDir, { recursive: true })

  const originalFileName = `original.${getExtension(original.mime)}`
  await writeFile(path.join(assetDir, originalFileName), original.buffer)

  const thumbnailUrls: Partial<Pick<
    TangentAssetRecord,
    'thumbnail1024Url' | 'thumbnail256Url' | 'thumbnail512Url'
  >> = {}
  await writeThumbnail(assetDir, assetId, 256, input.thumbnails?.[256], thumbnailUrls)
  await writeThumbnail(assetDir, assetId, 512, input.thumbnails?.[512], thumbnailUrls)
  await writeThumbnail(assetDir, assetId, 1024, input.thumbnails?.[1024], thumbnailUrls)

  const record: TangentAssetRecord = {
    ...thumbnailUrls,
    byteSize: original.buffer.byteLength,
    createdAt: new Date().toISOString(),
    height: input.height,
    id: assetId,
    mime: original.mime,
    origin: input.origin,
    originalUrl: createFileUrl(assetId, originalFileName),
    storage: 'local-dev',
    title: input.title || input.fileName || 'Image',
    width: input.width,
  }
  await writeAssetRecord(assetDir, record)
  return record
}

export async function createLocalAssetFromUpload(input: {
  bytes: ArrayBuffer
  fileName?: string
  height?: number
  mime: string
  origin?: TangentAssetRecord['origin']
  title?: string
  width?: number
}) {
  assertImageMime(input.mime)
  const assetId = `asset_${randomUUID()}`
  const assetDir = path.join(assetsRoot, assetId)
  await mkdir(assetDir, { recursive: true })

  const originalFileName = `original.${getExtension(input.mime)}`
  const buffer = Buffer.from(input.bytes)
  assertAssetSize(buffer.byteLength)
  await writeFile(path.join(assetDir, originalFileName), buffer)

  const record: TangentAssetRecord = {
    byteSize: buffer.byteLength,
    createdAt: new Date().toISOString(),
    height: input.height ?? 0,
    id: assetId,
    mime: input.mime,
    origin: input.origin ?? 'upload',
    originalUrl: createFileUrl(assetId, originalFileName),
    storage: 'local-dev',
    title: input.title || input.fileName || 'Image',
    width: input.width ?? 0,
  }
  await writeAssetRecord(assetDir, record)
  return record
}

export async function getLocalAssetRecord(assetId: string) {
  assertSafePathSegment(assetId)
  const recordPath = path.join(assetsRoot, assetId, 'metadata.json')
  const raw = await readFile(recordPath, 'utf8')
  return JSON.parse(raw) as TangentAssetRecord
}

export async function readLocalAssetFile(assetId: string, fileName: string) {
  assertSafePathSegment(assetId)
  assertSafePathSegment(fileName)
  const filePath = path.join(assetsRoot, assetId, fileName)
  const file = await readFile(filePath)
  return { file, mime: getMimeFromFileName(fileName) }
}

function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error('Invalid image data URL.')
  return {
    buffer: Buffer.from(match[2] ?? '', 'base64'),
    mime: match[1] ?? '',
  }
}

async function writeThumbnail(
  assetDir: string,
  assetId: string,
  size: 256 | 512 | 1024,
  thumbnail: TangentAssetThumbnailInput | undefined,
  urls: Partial<Pick<TangentAssetRecord, 'thumbnail1024Url' | 'thumbnail256Url' | 'thumbnail512Url'>>
) {
  if (!thumbnail?.dataUrl) return
  const parsed = parseImageDataUrl(thumbnail.dataUrl)
  assertImageMime(parsed.mime)
  const fileName = `thumb-${size}.${getExtension(parsed.mime)}`
  await writeFile(path.join(assetDir, fileName), parsed.buffer)
  urls[`thumbnail${size}Url` as keyof typeof urls] = createFileUrl(assetId, fileName)
}

async function writeAssetRecord(assetDir: string, record: TangentAssetRecord) {
  await writeFile(path.join(assetDir, 'metadata.json'), `${JSON.stringify(record, null, 2)}\n`)
}

function createFileUrl(assetId: string, fileName: string) {
  return `/api/assets/files/${assetId}/${fileName}`
}

function assertImageMime(mime: string) {
  if (!allowedMimeTypes.has(mime)) throw new Error('Unsupported image MIME type.')
}

function assertAssetSize(byteSize: number) {
  if (byteSize > maxAssetBytes) throw new Error('Image must be 30MB or smaller.')
}

function getExtension(mime: string) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

function getMimeFromFileName(fileName: string) {
  if (fileName.endsWith('.png')) return 'image/png'
  if (fileName.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

function assertSafePathSegment(value: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(value) || value.includes('..')) {
    throw new Error('Invalid asset path.')
  }
}
