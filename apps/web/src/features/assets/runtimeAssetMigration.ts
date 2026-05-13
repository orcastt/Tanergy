'use client'

import type { Editor, TLAssetId, TLImageAsset } from 'tldraw'
import { toSerializableTangentAssetRecord, type TangentAssetRecord } from './assetTypes'
import { uploadImageDataUrlAsset } from './assetUploadClient'
import { acceptedImageMimeTypes, imageMaxBytes } from './imageAssetInputs'

type RuntimeImageAsset = TLImageAsset & {
  meta?: {
    tangentAsset?: TangentAssetRecord
  }
}

export type RuntimeAssetMigrationResult = {
  migrated: number
  skipped: number
}

export async function migrateRuntimeImageAssets(editor: Editor): Promise<RuntimeAssetMigrationResult> {
  let migrated = 0
  let skipped = 0

  for (const asset of editor.getAssets() as RuntimeImageAsset[]) {
    if (asset.type !== 'image' || asset.meta?.tangentAsset) continue
    const src = asset.props.src
    if (!src || isPersistableAssetUrl(src)) continue

    const dataUrl = await getMigratableDataUrl(src)
    if (!dataUrl) {
      skipped += 1
      continue
    }

    const record = await uploadImageDataUrlAsset({
      dataUrl,
      fileName: asset.props.name,
      height: asset.props.h,
      origin: 'paste',
      title: asset.props.name,
      width: asset.props.w,
    })

    editor.updateAssets([
      {
        id: asset.id as TLAssetId,
        meta: { tangentAsset: toSerializableTangentAssetRecord(record) },
        props: {
          fileSize: record.byteSize,
          h: record.height,
          isAnimated: asset.props.isAnimated === true,
          mimeType: record.mime,
          name: record.title,
          src: record.originalUrl,
          w: record.width,
        },
        type: 'image',
      },
    ])
    migrated += 1
  }

  return { migrated, skipped }
}

function isPersistableAssetUrl(src: string) {
  return !src.startsWith('data:') && !src.startsWith('blob:')
}

async function getMigratableDataUrl(src: string) {
  if (src.startsWith('data:')) return isAllowedDataUrl(src) && getDataUrlByteLength(src) <= imageMaxBytes ? src : null
  if (!src.startsWith('blob:')) return null

  const response = await fetch(src)
  const blob = await response.blob()
  if (!acceptedImageMimeTypes.includes(blob.type)) return null
  if (blob.size > imageMaxBytes) return null
  return readBlobAsDataUrl(blob)
}

function isAllowedDataUrl(src: string) {
  return acceptedImageMimeTypes.some((mime) => src.startsWith(`data:${mime};base64,`))
}

function getDataUrlByteLength(src: string) {
  const marker = ';base64,'
  const markerIndex = src.indexOf(marker)
  if (markerIndex < 0) return Number.POSITIVE_INFINITY
  const base64 = src.slice(markerIndex + marker.length).replace(/\s/g, '')
  if (!base64) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor(base64.length * 3 / 4) - padding
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read runtime image asset.'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(blob)
  })
}
