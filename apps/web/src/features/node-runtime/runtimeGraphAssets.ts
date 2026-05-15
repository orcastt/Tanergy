import type { JsonObject } from '@/types/nodeRuntime'

export type RuntimeGraphImageAssetRef = {
  assetId: string
  crop?: RuntimeGraphImageCrop
  imageHeight?: number
  imageWidth?: number
  originalUrl?: string
  thumbnail1024Url?: string
  thumbnail256Url?: string
  thumbnail512Url?: string
  title?: string
}

export type RuntimeGraphImageCrop = {
  height: number
  width: number
  x: number
  y: number
}

export type RuntimeGraphGeneratedOutputHistory = RuntimeGraphImageAssetRef[][]

export function getRuntimeGraphImageNodePayload(data: JsonObject): JsonObject | null {
  const ref = getRuntimeGraphImageAssetRef(data)
  return ref ? runtimeGraphImageRefToPayload(ref) : null
}

export function getRuntimeGraphGeneratedOutputPayload(data: JsonObject, portId: string): JsonObject | null {
  const refs = getRuntimeGraphGeneratedOutputRefs(data)
  const index = getGeneratedOutputIndex(portId)
  const ref = refs[index] ?? null
  return ref ? runtimeGraphImageRefToPayload(ref) : null
}

export function getRuntimeGraphGeneratedOutputRefs(data: JsonObject): RuntimeGraphImageAssetRef[] {
  return Array.isArray(data.generatedOutputs)
    ? data.generatedOutputs.map((value) => asRuntimeGraphImageAssetRef(value)).filter((value): value is RuntimeGraphImageAssetRef => Boolean(value))
    : []
}

export function getRuntimeGraphGeneratedOutputHistory(data: JsonObject): RuntimeGraphGeneratedOutputHistory {
  if (!Array.isArray(data.generatedOutputHistory)) return []
  return data.generatedOutputHistory.map((slot) => (
    Array.isArray(slot)
      ? slot.map((value) => asRuntimeGraphImageAssetRef(value)).filter((value): value is RuntimeGraphImageAssetRef => Boolean(value))
      : []
  ))
}

export function getRuntimeGraphGeneratedOutputHistorySlot(data: JsonObject, slotIndex: number): RuntimeGraphImageAssetRef[] {
  return getRuntimeGraphGeneratedOutputHistory(data)[slotIndex] ?? []
}

export function getRuntimeGraphImageAssetRef(value: unknown): RuntimeGraphImageAssetRef | null {
  const data = asJsonObject(value)
  if (!data) return null
  const assetId = getString(data.assetId)
  const originalUrl = getString(data.originalUrl)
  const thumbnail512Url = getString(data.thumbnail512Url)
  if (!assetId && !originalUrl && !thumbnail512Url) return null
  return pruneUndefined({
    assetId: assetId ?? '',
    crop: getRuntimeGraphImageCrop(data.crop),
    imageHeight: getNumber(data.imageHeight),
    imageWidth: getNumber(data.imageWidth),
    originalUrl,
    thumbnail1024Url: getString(data.thumbnail1024Url),
    thumbnail256Url: getString(data.thumbnail256Url),
    thumbnail512Url,
    title: getString(data.title),
  }) as RuntimeGraphImageAssetRef
}

export function runtimeGraphImageRefToPayload(ref: RuntimeGraphImageAssetRef): JsonObject {
  return pruneUndefined({
    assetId: ref.assetId,
    crop: ref.crop,
    imageHeight: ref.imageHeight,
    imageWidth: ref.imageWidth,
    originalUrl: ref.originalUrl,
    thumbnail1024Url: ref.thumbnail1024Url,
    thumbnail256Url: ref.thumbnail256Url,
    thumbnail512Url: ref.thumbnail512Url,
    title: ref.title,
  })
}

export function runtimeGraphGeneratedOutputHistoryToPayload(history: RuntimeGraphGeneratedOutputHistory) {
  return history.map((slot) => slot.map((ref) => runtimeGraphImageRefToPayload(ref)))
}

export function getRuntimeGraphImageCrop(value: unknown): RuntimeGraphImageCrop | undefined {
  const crop = asJsonObject(value)
  if (!crop) return undefined
  const x = getNumber(crop.x)
  const y = getNumber(crop.y)
  const width = getNumber(crop.width)
  const height = getNumber(crop.height)
  if (x === undefined || y === undefined || width === undefined || height === undefined) return undefined
  const cropX = clamp(x, 0, 0.99)
  const cropY = clamp(y, 0, 0.99)
  return {
    height: clamp(height, 0.01, 1 - cropY),
    width: clamp(width, 0.01, 1 - cropX),
    x: cropX,
    y: cropY,
  }
}

function asRuntimeGraphImageAssetRef(value: unknown) {
  const ref = getRuntimeGraphImageAssetRef(value)
  return ref?.assetId ? ref : null
}

function getGeneratedOutputIndex(portId: string) {
  if (portId === 'image_out') return 0
  const index = Number(portId.replace('image_out_', '')) - 1
  return Number.isFinite(index) && index >= 0 ? index : 0
}

function asJsonObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject
}
