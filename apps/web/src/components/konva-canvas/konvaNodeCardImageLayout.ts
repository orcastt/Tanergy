import type { CanvasNodeShape } from '@/features/canvas-engine'
import { getNormalizedImageGenerationData } from '@/features/node-runtime/registry'
import type { RuntimeGraphImageAssetRef } from '@/features/node-runtime/runtimeGraphAssets'

export type NodeCardImageSlotBounds = {
  height: number
  width: number
  x: number
  y: number
}

export function getNodeCardImageSlotBounds(input: {
  count: number
  height: number
  imageRef?: RuntimeGraphImageAssetRef | null
  shape: CanvasNodeShape
  slotIndex: number
  y: number
}): NodeCardImageSlotBounds {
  const container = getNodeCardImageSlotContainer(input)
  if (input.count !== 1) return container
  const aspectRatio = getGeneratedImageAspectRatio(input.shape, input.imageRef ?? null)
  return aspectRatio ? fitAspectRatioInside(container, aspectRatio) : container
}

function getNodeCardImageSlotContainer(input: {
  count: number
  height: number
  shape: CanvasNodeShape
  slotIndex: number
  y: number
}): NodeCardImageSlotBounds {
  const slotWidth = input.count === 4 ? (input.shape.props.width - 38) / 2 : input.shape.props.width - 28
  const slotHeight = input.count === 4 ? (input.height - 8) / 2 : input.height
  return {
    height: slotHeight,
    width: slotWidth,
    x: 14 + (input.slotIndex % 2) * (slotWidth + 10),
    y: input.y + Math.floor(input.slotIndex / 2) * (slotHeight + 8),
  }
}

function getGeneratedImageAspectRatio(shape: CanvasNodeShape, imageRef: RuntimeGraphImageAssetRef | null) {
  const imageRatio = getImageDimensionsAspectRatio(imageRef?.imageWidth, imageRef?.imageHeight)
  if (imageRatio) return imageRatio
  const normalized = getNormalizedImageGenerationData(shape.props.data)
  return (
    parseWidthHeightAspectRatio(normalized.size)
    ?? parseWidthHeightAspectRatio(normalized.seedreamSize)
    ?? parseWidthHeightAspectRatio(normalized.jimengSize)
    ?? parseRatioStringAspectRatio(normalized.aspectRatio)
  )
}

function getImageDimensionsAspectRatio(width: unknown, height: unknown) {
  if (typeof width !== 'number' || typeof height !== 'number') return null
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return width / height
}

function parseWidthHeightAspectRatio(value: unknown) {
  if (typeof value !== 'string') return null
  const match = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(value.trim())
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  return getImageDimensionsAspectRatio(width, height)
}

function parseRatioStringAspectRatio(value: unknown) {
  if (typeof value !== 'string') return null
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value.trim())
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  return getImageDimensionsAspectRatio(width, height)
}

function fitAspectRatioInside(bounds: NodeCardImageSlotBounds, aspectRatio: number): NodeCardImageSlotBounds {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return bounds
  const containerAspectRatio = bounds.width / Math.max(bounds.height, 1)
  if (Math.abs(containerAspectRatio - aspectRatio) < 0.001) return bounds

  if (containerAspectRatio > aspectRatio) {
    const height = bounds.height
    const width = height * aspectRatio
    return {
      ...bounds,
      width,
      x: bounds.x + (bounds.width - width) / 2,
    }
  }

  const width = bounds.width
  const height = width / aspectRatio
  return {
    ...bounds,
    height,
    y: bounds.y + (bounds.height - height) / 2,
  }
}
