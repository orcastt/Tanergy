import { AssetRecordType, type Editor, type TLAssetId } from 'tldraw'
import type { TangentAssetRecord } from './assetTypes'

type ImageAssetRecord = {
  meta?: {
    tangentAsset?: TangentAssetRecord
  }
  props?: {
    h?: number
    mimeType?: string
    name?: string
    src?: string
    w?: number
  }
}

export function createEditorImageAsset(editor: Editor, asset: TangentAssetRecord) {
  const assetId = AssetRecordType.createId(asset.id) as TLAssetId
  editor.createAssets([
    {
      id: assetId,
      meta: { tangentAsset: asset },
      props: {
        h: asset.height,
        isAnimated: false,
        mimeType: asset.mime,
        name: asset.title,
        src: asset.originalUrl,
        w: asset.width,
      },
      type: 'image',
      typeName: 'asset',
    },
  ])
  return assetId
}

export function getImageAsset(editor: Editor, assetId?: string | null) {
  if (!assetId) return null
  const asset = editor.getAsset(assetId as TLAssetId) as ImageAssetRecord | undefined
  const src = asset?.props?.src
  if (!src) return null
  return {
    assetId,
    height: asset.props?.h,
    mimeType: asset.props?.mimeType,
    serverAsset: asset.meta?.tangentAsset,
    src,
    title: asset.props?.name || 'Image',
    width: asset.props?.w,
  }
}
