import type { JsonObject } from '@/types/nodeRuntime'
import type { RuntimeInputResolution } from './nodeDataFlow'

export type ImageNodeEffectiveAsset = {
  assetId: string
  imageHeight?: number
  imageWidth?: number
  source: 'input' | 'own'
  title: string
}

const emptyImageAssetIds = new Set(['asset_mock_image_001'])

export function getImageNodeEffectiveAsset(
  data: JsonObject,
  inputResolution: RuntimeInputResolution
): ImageNodeEffectiveAsset | null {
  const incomingImage = inputResolution.imageValues[0]
  if (incomingImage?.assetId) {
    return {
      assetId: incomingImage.assetId,
      imageHeight: incomingImage.imageHeight,
      imageWidth: incomingImage.imageWidth,
      source: 'input',
      title: incomingImage.title || 'Image',
    }
  }

  const assetId = getOwnImageAssetId(data.assetId)
  if (!assetId) return null

  return {
    assetId,
    imageHeight: getNumber(data.imageHeight),
    imageWidth: getNumber(data.imageWidth),
    source: 'own',
    title: String(data.title ?? 'Image'),
  }
}

export function getOwnImageAssetId(value: unknown) {
  if (typeof value !== 'string') return null
  const assetId = value.trim()
  if (!assetId || emptyImageAssetIds.has(assetId)) return null
  return assetId
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
