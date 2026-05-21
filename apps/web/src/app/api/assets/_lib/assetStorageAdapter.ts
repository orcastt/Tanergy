import type { ApiRequestContext } from '../../_lib/apiRequestContext'
import type { TangentAssetDataUrlInput, TangentAssetRecord } from '@/features/assets/assetTypes'
import {
  createLocalAssetFromDataUrl,
  createLocalAssetFromUpload,
  getLocalAssetRecord,
  readLocalAssetFile,
} from './localAssetStore'

export type AssetUploadInput = {
  bytes: ArrayBuffer
  fileName?: string
  height?: number
  mime: string
  origin?: TangentAssetRecord['origin']
  title?: string
  width?: number
}

export type AssetStorageAdapter = {
  createFromDataUrl: (input: TangentAssetDataUrlInput, context: ApiRequestContext) => Promise<TangentAssetRecord>
  createFromUpload: (input: AssetUploadInput, context: ApiRequestContext) => Promise<TangentAssetRecord>
  getRecord: (assetId: string, context: ApiRequestContext) => Promise<TangentAssetRecord>
  readFile: (
    assetId: string,
    fileName: string,
    context: ApiRequestContext
  ) => Promise<{ file: ArrayBuffer; mime: string }>
}

const localAdapter: AssetStorageAdapter = {
  createFromDataUrl: createLocalAssetFromDataUrl,
  createFromUpload: createLocalAssetFromUpload,
  getRecord: getLocalAssetRecord,
  readFile: readLocalAssetFile,
}

export function getAssetStorageAdapter(): AssetStorageAdapter {
  const driver = process.env.TANGENT_ASSET_STORAGE_DRIVER ?? 'local-dev'
  if (driver === 'local-dev') return localAdapter
  throw new Error(`Unsupported asset storage driver "${driver}". Supported driver: local-dev.`)
}
