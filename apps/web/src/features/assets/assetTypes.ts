export type TangentAssetOrigin =
  | 'ai_run'
  | 'editor_export'
  | 'generated'
  | 'merge_capture'
  | 'paste'
  | 'screenshot'
  | 'upload'

export type TangentAssetRecord = {
  byteSize: number
  createdAt: string
  createdBy: string
  height: number
  id: string
  mime: string
  origin: TangentAssetOrigin
  originalUrl: string
  storage: 'local-dev' | 's3-compatible'
  thumbnail1024Url?: string
  thumbnail256Url?: string
  thumbnail512Url?: string
  title: string
  width: number
  workspaceId: string
}

export type TangentAssetThumbnailInput = {
  dataUrl: string
  height: number
  width: number
}

export type TangentAssetDataUrlInput = {
  dataUrl: string
  fileName?: string
  height: number
  origin: TangentAssetOrigin
  thumbnails?: {
    256?: TangentAssetThumbnailInput
    512?: TangentAssetThumbnailInput
    1024?: TangentAssetThumbnailInput
  }
  title?: string
  width: number
}

export type TangentAssetResponse = {
  asset?: TangentAssetRecord
  error?: string
}

export function toSerializableTangentAssetRecord(asset: TangentAssetRecord): TangentAssetRecord {
  const record: TangentAssetRecord = {
    byteSize: asset.byteSize,
    createdAt: asset.createdAt,
    createdBy: asset.createdBy,
    height: asset.height,
    id: asset.id,
    mime: asset.mime,
    origin: asset.origin,
    originalUrl: asset.originalUrl,
    storage: asset.storage,
    title: asset.title,
    width: asset.width,
    workspaceId: asset.workspaceId,
  }
  if (asset.thumbnail256Url) record.thumbnail256Url = asset.thumbnail256Url
  if (asset.thumbnail512Url) record.thumbnail512Url = asset.thumbnail512Url
  if (asset.thumbnail1024Url) record.thumbnail1024Url = asset.thumbnail1024Url
  return record
}
