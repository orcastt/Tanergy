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
