'use client'

import { uploadImageDataUrlAsset } from '@/features/assets/assetUploadClient'
import type { TangentAssetRecord } from '@/features/assets/assetTypes'
import type { JsonObject } from '@/types/nodeRuntime'
import type { AiRunRecord, AiRunRequest } from '@/features/ai/aiTypes'

export async function uploadMockGeneratedAssets(run: AiRunRecord, request: AiRunRequest): Promise<TangentAssetRecord[]> {
  const count = Math.max(1, Math.min(4, run.outputAssetIds.length || Number(request.params?.count ?? 1)))
  const size = getMockImageSize(request.params)
  return Promise.all(Array.from({ length: count }, (_, index) => {
    const dataUrl = createMockGeneratedImageDataUrl({
      count,
      height: size.height,
      index,
      modelId: run.modelId,
      prompt: request.prompt ?? 'Generated image',
      runId: run.runId,
      width: size.width,
    })
    return uploadImageDataUrlAsset({
      dataUrl,
      fileName: `mock-ai-run-${index + 1}.png`,
      height: size.height,
      origin: 'ai_run',
      title: count === 1 ? 'Generated image' : `Generated option ${index + 1}`,
      width: size.width,
    })
  }))
}

function getMockImageSize(params: JsonObject | undefined) {
  const longSide = getMockLongSide(params)
  const parsedSize = parseSizeValue(params?.size)
  if (parsedSize) {
    const scale = longSide / Math.max(parsedSize.width, parsedSize.height)
    return {
      height: Math.max(1, Math.round(parsedSize.height * scale)),
      width: Math.max(1, Math.round(parsedSize.width * scale)),
    }
  }

  const aspect = typeof params?.aspectRatio === 'string' ? params.aspectRatio : '1:1'
  if (aspect === '21:9') return { height: Math.round(longSide * 9 / 21), width: longSide }
  if (aspect === '16:9') return { height: Math.round(longSide * 9 / 16), width: longSide }
  if (aspect === '5:4') return { height: Math.round(longSide * 4 / 5), width: longSide }
  if (aspect === '4:3') return { height: Math.round(longSide * 3 / 4), width: longSide }
  if (aspect === '4:5') return { height: longSide, width: Math.round(longSide * 4 / 5) }
  if (aspect === '3:2') return { height: Math.round(longSide * 2 / 3), width: longSide }
  if (aspect === '3:4') return { height: longSide, width: Math.round(longSide * 3 / 4) }
  if (aspect === '2:3') return { height: longSide, width: Math.round(longSide * 2 / 3) }
  if (aspect === '9:16') return { height: longSide, width: Math.round(longSide * 9 / 16) }
  return { height: longSide, width: longSide }
}

function getMockLongSide(params: JsonObject | undefined) {
  const imageSize = typeof params?.imageSize === 'string' ? params.imageSize : undefined
  if (imageSize === '0.5K') return 256
  if (imageSize === '2K') return 512
  if (imageSize === '4K') return 640

  const quality = typeof params?.quality === 'string' ? params.quality : undefined
  if (quality === 'low') return 256
  if (quality === 'high') return 512

  const legacyResolution = typeof params?.resolution === 'string' ? params.resolution : undefined
  if (legacyResolution === '0.5K') return 256
  if (legacyResolution === '2K') return 512
  if (legacyResolution === '4K') return 640

  return 384
}

function parseSizeValue(value: JsonObject[string] | undefined) {
  if (typeof value !== 'string') return null
  const match = /^(\d+)x(\d+)$/.exec(value)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { height, width }
}

function createMockGeneratedImageDataUrl(input: { count: number; height: number; index: number; modelId: string; prompt: string; runId: string; width: number }) {
  const canvas = globalThis.document.createElement('canvas')
  canvas.width = input.width
  canvas.height = input.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas preview generator is unavailable.')
  const hue = hashString(`${input.runId}:${input.index}`) % 360
  const gradient = context.createLinearGradient(0, 0, input.width, input.height)
  gradient.addColorStop(0, `hsl(${hue} 82% 56%)`)
  gradient.addColorStop(1, `hsl(${(hue + 54) % 360} 76% 38%)`)
  context.fillStyle = gradient
  context.fillRect(0, 0, input.width, input.height)
  context.fillStyle = 'rgba(255,255,255,0.18)'
  for (let i = 0; i < 8; i += 1) {
    context.beginPath()
    context.arc(input.width * (0.12 + i * 0.11), input.height * (0.2 + (i % 3) * 0.22), input.width * 0.12, 0, Math.PI * 2)
    context.fill()
  }
  context.fillStyle = 'rgba(15,23,42,0.72)'
  context.fillRect(0, input.height - 132, input.width, 132)
  context.fillStyle = '#ffffff'
  context.font = '700 34px Inter, system-ui, sans-serif'
  context.fillText(input.count === 1 ? 'Mock Image Gen' : `Mock Image ${input.index + 1}`, 36, input.height - 76)
  context.font = '500 22px Inter, system-ui, sans-serif'
  context.fillText(input.prompt.slice(0, 72), 36, input.height - 38)
  context.font = '600 16px Inter, system-ui, sans-serif'
  context.fillText(input.modelId, 36, 38)
  return canvas.toDataURL('image/png')
}

function hashString(value: string) {
  return Array.from(value).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0) >>> 0
}
