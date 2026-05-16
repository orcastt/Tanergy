import type { AiRunRequest } from '@/features/ai/aiTypes'
import { getDefaultImageModelId } from '@/features/ai/mockAiContracts'
import type { TangentAssetRecord } from '@/features/assets/assetTypes'
import type { CanvasNodeShape } from '@/features/canvas-engine'
import type { JsonObject } from '@/types/nodeRuntime'
import { getNormalizedImageGenerationData } from './registry'

export function createRuntimeGraphImageGenerationParams(
  data: ReturnType<typeof getNormalizedImageGenerationData>,
  nodeType: CanvasNodeShape['props']['nodeType'],
) {
  const count = nodeType === 'image_gen_4' ? 4 : 1
  const modelId = String(data.modelId ?? '')
  const params: JsonObject = { count }
  if (modelId === 'nano-banana-2') {
    params.aspectRatio = String(data.aspectRatio ?? '1:1')
    params.imageSize = String(data.imageSize ?? '1K')
    return params
  }
  if (modelId === 'doubao-seedream-5.0-lite') {
    params.seedreamSize = String(data.seedreamSize ?? '2K')
    return params
  }
  if (modelId === 'jimeng_t2i_v40') {
    params.jimengSize = String(data.jimengSize ?? '2048x2048')
    params.jimengStrength = String(data.jimengStrength ?? '0.5')
    return params
  }
  params.quality = String(data.quality ?? 'medium')
  params.size = String(data.size ?? '1024x1024')
  return params
}

export function getEstimatedImageGenerationDurationMs(node: CanvasNodeShape) {
  const data = getNormalizedImageGenerationData(node.props.data)
  const count = node.props.nodeType === 'image_gen_4' ? 4 : 1
  const modelId = String(data.modelId ?? getDefaultImageModelId())

  if (modelId === 'nano-banana-2' || modelId === 'gemini-3.1-flash-image-preview') {
    const imageSize = String(data.imageSize ?? '1K')
    const baseMs = imageSize === '2K'
      ? 58_000
      : imageSize === '4K'
          ? 84_000
          : 42_000
    return Math.round(baseMs * (1 + (count - 1) * 0.5))
  }

  if (modelId === 'doubao-seedream-5.0-lite') {
    const size = String(data.seedreamSize ?? '2K')
    const baseMs = size.startsWith('4K') || size.includes('4096') || size.includes('5504') || size.includes('6240')
      ? 96_000
      : size.startsWith('3K') || size.includes('3072') || size.includes('3456') || size.includes('4704')
        ? 78_000
        : 58_000
    return Math.round(baseMs * (count > 1 ? 1.45 : 1))
  }

  if (modelId === 'jimeng_t2i_v40') {
    const size = String(data.jimengSize ?? '2048x2048')
    const baseMs = size.includes('4096') || size.includes('4694') || size.includes('4992') || size.includes('5404') || size.includes('6198')
      ? 92_000
      : size === '1024x1024'
        ? 42_000
        : 62_000
    return Math.round(baseMs * (1 + (count - 1) * 0.55))
  }

  const quality = String(data.quality ?? 'medium')
  const size = String(data.size ?? '1024x1024')
  const baseMs = quality === 'low'
    ? 42_000
    : quality === 'high'
      ? 82_000
      : 58_000
  const sizeMultiplier = size === '1024x1024' ? 1 : 1.15
  return Math.round(baseMs * sizeMultiplier * (1 + (count - 1) * 0.55))
}

export function getGeneratedImageAspectWarning(
  request: AiRunRequest | null | undefined,
  generatedAssets: TangentAssetRecord[],
) {
  if (!request) return null
  if (String(request.selectedModelId ?? '') !== 'nano-banana-2') return null
  const requestedAspectRatio = parseAspectRatio(String(request.params?.aspectRatio ?? ''))
  if (!requestedAspectRatio) return null
  const mismatched = generatedAssets.find((asset) => {
    const actualAspectRatio = getAspectRatio(asset.width, asset.height)
    if (!actualAspectRatio) return false
    const normalizedDelta = Math.abs(actualAspectRatio - requestedAspectRatio) / requestedAspectRatio
    return normalizedDelta > 0.12
  })
  if (!mismatched) return null
  return `Returned image aspect differs from requested ${String(request.params?.aspectRatio ?? 'ratio')}.`
}

function parseAspectRatio(value: string) {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value.trim())
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  return getAspectRatio(width, height)
}

function getAspectRatio(width: number | null | undefined, height: number | null | undefined) {
  if (typeof width !== 'number' || typeof height !== 'number') return null
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return width / height
}
