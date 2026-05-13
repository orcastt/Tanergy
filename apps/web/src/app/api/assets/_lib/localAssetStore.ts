import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  TangentAssetDataUrlInput,
  TangentAssetRecord,
  TangentAssetThumbnailInput,
} from '@/features/assets/assetTypes'
import type { ApiRequestContext } from '../../_lib/apiRequestContext'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxAssetBytes = 100 * 1024 * 1024
const storageRoot = process.env.TANGENT_ASSET_STORAGE_DIR ?? getDefaultLocalStorageRoot('.tangent-assets')
const assetsRoot = path.join(storageRoot, 'assets')

type ParsedDataUrl = {
  buffer: Buffer
  mime: string
}

export async function createLocalAssetFromDataUrl(input: TangentAssetDataUrlInput, context: ApiRequestContext) {
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
    createdBy: context.userId,
    height: input.height,
    id: assetId,
    mime: original.mime,
    origin: input.origin,
    originalUrl: createFileUrl(assetId, originalFileName),
    storage: 'local-dev',
    title: input.title || input.fileName || 'Image',
    width: input.width,
    workspaceId: context.workspaceId,
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
}, context: ApiRequestContext) {
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
    createdBy: context.userId,
    height: input.height ?? 0,
    id: assetId,
    mime: input.mime,
    origin: input.origin ?? 'upload',
    originalUrl: createFileUrl(assetId, originalFileName),
    storage: 'local-dev',
    title: input.title || input.fileName || 'Image',
    width: input.width ?? 0,
    workspaceId: context.workspaceId,
  }
  await writeAssetRecord(assetDir, record)
  return record
}

export async function getLocalAssetRecord(assetId: string, context: ApiRequestContext) {
  const record = await readStoredAssetRecord(assetId, context)
  assertWorkspaceAccess(record, context)
  return record
}

export async function readLocalAssetFile(assetId: string, fileName: string, context: ApiRequestContext) {
  assertSafePathSegment(assetId)
  assertSafePathSegment(fileName)
  if (!context.isDevFallback) {
    await getLocalAssetRecord(assetId, context)
  }
  const filePath = path.join(assetsRoot, assetId, fileName)
  const file = await readFile(filePath)
  const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  return { file: body, mime: getMimeFromFileName(fileName) }
}

async function readStoredAssetRecord(assetId: string, context: ApiRequestContext) {
  assertSafePathSegment(assetId)
  const recordPath = path.join(assetsRoot, assetId, 'metadata.json')
  const raw = await readFile(recordPath, 'utf8')
  return normalizeAssetRecord(JSON.parse(raw) as Partial<TangentAssetRecord>, context)
}

function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const match = /^data:([^;,]+);base64,([a-zA-Z0-9+/=\s]+)$/s.exec(dataUrl)
  if (!match) throw new Error('Invalid image data URL.')
  const mime = match[1]?.toLowerCase() ?? ''
  assertImageMime(mime)
  const base64 = (match[2] ?? '').replace(/\s+/g, '')
  assertAssetSize(estimateBase64ByteLength(base64))
  const buffer = Buffer.from(base64, 'base64')
  assertAssetSize(buffer.byteLength)
  return {
    buffer,
    mime,
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
  assertAssetSize(parsed.buffer.byteLength)
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
  if (byteSize > maxAssetBytes) throw new Error('Image must be 100MB or smaller.')
}

function estimateBase64ByteLength(base64: string) {
  if (!base64 || base64.length % 4 !== 0) throw new Error('Invalid image data URL.')
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
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

function getDefaultLocalStorageRoot(directoryName: string) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), '..', '..', directoryName)
}

function normalizeAssetRecord(record: Partial<TangentAssetRecord>, context: ApiRequestContext): TangentAssetRecord {
  return {
    byteSize: record.byteSize ?? 0,
    createdAt: record.createdAt ?? new Date(0).toISOString(),
    createdBy: record.createdBy ?? context.userId,
    height: record.height ?? 0,
    id: record.id ?? '',
    mime: record.mime ?? 'image/jpeg',
    origin: record.origin ?? 'upload',
    originalUrl: record.originalUrl ?? '',
    storage: record.storage ?? 'local-dev',
    thumbnail1024Url: record.thumbnail1024Url,
    thumbnail256Url: record.thumbnail256Url,
    thumbnail512Url: record.thumbnail512Url,
    title: record.title ?? 'Image',
    width: record.width ?? 0,
    workspaceId: record.workspaceId ?? context.workspaceId,
  }
}

function assertWorkspaceAccess(record: TangentAssetRecord, context: ApiRequestContext) {
  if (process.env.NODE_ENV !== 'production' && process.env.TANGENT_REQUIRE_API_AUTH !== '1') return
  if (record.workspaceId !== context.workspaceId) {
    throw new Error('Asset not found in workspace.')
  }
}

function assertSafePathSegment(value: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(value) || value.includes('..')) {
    throw new Error('Invalid asset path.')
  }
}
