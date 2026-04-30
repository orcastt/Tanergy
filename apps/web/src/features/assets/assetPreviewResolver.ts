'use client'

import { useEffect, useState } from 'react'
import type { Editor, TLAssetId } from 'tldraw'

export type AssetPreviewMode = 'full' | 'placeholder' | 'thumbnail'
export type AssetPreviewQuality = 'original' | 'placeholder' | 'thumb-1024' | 'thumb-256' | 'thumb-512'

type AssetPreviewIntent = {
  assetId: string | null
  mode: AssetPreviewMode
  screenHeight?: number
  screenWidth?: number
}

type AssetPreviewResult = {
  height?: number
  pending: boolean
  quality: AssetPreviewQuality
  src: string | null
  title: string
  width?: number
}

type LocalImageAsset = {
  props?: {
    h?: number
    name?: string
    src?: string
    w?: number
  }
}

type ThumbnailSize = 256 | 512 | 1024

type ThumbnailEntry = {
  pending: Partial<Record<ThumbnailSize, Promise<void>>>
  source: string
  thumbnails: Partial<Record<ThumbnailSize, { height: number; src: string; width: number }>>
}

const thumbnailCache = new Map<string, ThumbnailEntry>()
const listeners = new Set<(assetId: string) => void>()

export function useAssetPreview(editor: Editor, intent: AssetPreviewIntent) {
  const [, setCacheVersion] = useState(0)
  const { assetId, mode, screenHeight, screenWidth } = intent
  const result = resolveAssetPreview(editor, {
    assetId,
    mode,
    screenHeight,
    screenWidth,
  })

  useEffect(() => subscribeAssetPreviewCache((nextAssetId) => {
    if (nextAssetId === assetId) setCacheVersion((version) => version + 1)
  }), [assetId])

  useEffect(() => {
    if (!result.pending || !assetId) return
    requestAssetThumbnail(assetId, result.sourceForCache, result.targetThumbnailSize)
  }, [assetId, result.pending, result.sourceForCache, result.targetThumbnailSize])

  return result
}

export function primeAssetPreviewThumbnails(input: {
  assetId: string
  height: number
  src: string
  width: number
}) {
  if (typeof window === 'undefined') return
  const longestEdge = Math.max(input.width, input.height)
  const sizes: ThumbnailSize[] = longestEdge > 512 ? [256, 512] : [256]
  window.setTimeout(() => {
    sizes.forEach((size) => requestAssetThumbnail(input.assetId, input.src, size))
  }, 0)
}

function resolveAssetPreview(editor: Editor, intent: AssetPreviewIntent): AssetPreviewResult & {
  sourceForCache: string
  targetThumbnailSize: ThumbnailSize
} {
  const asset = getLocalImageAsset(editor, intent.assetId)
  const targetThumbnailSize = getTargetThumbnailSize(intent.screenWidth, intent.screenHeight)
  if (!asset?.src) {
    return createPlaceholderResult(targetThumbnailSize, '')
  }

  const base = {
    height: asset.height,
    sourceForCache: asset.src,
    targetThumbnailSize,
    title: asset.title,
    width: asset.width,
  }

  if (intent.mode === 'full') {
    return { ...base, pending: false, quality: 'original', src: asset.src }
  }
  if (intent.mode === 'placeholder') {
    return { ...base, pending: false, quality: 'placeholder', src: null }
  }

  const thumbnail = getCachedThumbnail(intent.assetId, asset.src, targetThumbnailSize)
  if (thumbnail) {
    return {
      ...base,
      height: thumbnail.height,
      pending: false,
      quality: `thumb-${targetThumbnailSize}` as AssetPreviewQuality,
      src: thumbnail.src,
      width: thumbnail.width,
    }
  }

  return { ...base, pending: true, quality: 'placeholder', src: null }
}

function getLocalImageAsset(editor: Editor, assetId: string | null) {
  if (!assetId) return null
  const asset = editor.getAsset(assetId as TLAssetId) as LocalImageAsset | undefined
  const src = asset?.props?.src
  if (!src) return null
  return {
    height: asset.props?.h,
    src,
    title: asset.props?.name || 'Image',
    width: asset.props?.w,
  }
}

function getCachedThumbnail(assetId: string | null, src: string, size: ThumbnailSize) {
  if (!assetId) return null
  const entry = getCacheEntry(assetId, src)
  return entry.thumbnails[size] ?? null
}

function requestAssetThumbnail(assetId: string | null, src: string, size: ThumbnailSize) {
  if (!assetId || !src || typeof window === 'undefined') return
  const entry = getCacheEntry(assetId, src)
  if (entry.thumbnails[size] || entry.pending[size]) return

  entry.pending[size] = createThumbnail(src, size)
    .then((thumbnail) => {
      entry.thumbnails[size] = thumbnail
      notifyAssetPreviewCache(assetId)
    })
    .catch(() => undefined)
    .finally(() => {
      delete entry.pending[size]
    })
}

function getCacheEntry(assetId: string, src: string) {
  const current = thumbnailCache.get(assetId)
  if (current?.source === src) return current
  const next: ThumbnailEntry = { pending: {}, source: src, thumbnails: {} }
  thumbnailCache.set(assetId, next)
  return next
}

async function createThumbnail(src: string, maxSize: ThumbnailSize) {
  const image = await decodeImage(src)
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight, 1)
  const scale = Math.min(1, maxSize / longestEdge)
  if (scale >= 0.92) {
    return { height: image.naturalHeight, src, width: image.naturalWidth }
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) return { height: image.naturalHeight, src, width: image.naturalWidth }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'medium'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const thumbnailSrc = canvas.toDataURL('image/webp', 0.76)
  return { height: canvas.height, src: thumbnailSrc, width: canvas.width }
}

function decodeImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.decoding = 'async'
    image.onerror = () => reject(new Error('Failed to decode image preview.'))
    image.onload = () => resolve(image)
    image.src = src
  })
}

function getTargetThumbnailSize(width = 0, height = 0): ThumbnailSize {
  const longestEdge = Math.max(width, height)
  if (longestEdge > 520) return 1024
  if (longestEdge > 220) return 512
  return 256
}

function createPlaceholderResult(targetThumbnailSize: ThumbnailSize, sourceForCache: string) {
  return {
    pending: false,
    quality: 'placeholder' as const,
    sourceForCache,
    src: null,
    targetThumbnailSize,
    title: 'Image',
  }
}

function subscribeAssetPreviewCache(listener: (assetId: string) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notifyAssetPreviewCache(assetId: string) {
  listeners.forEach((listener) => listener(assetId))
}
