import {
  createImageGenerationParams,
  getEstimatedImageGenerationDurationMs as getCatalogEstimatedImageGenerationDurationMs,
  getGeneratedImageAspectWarning,
} from '@/features/ai/aiImageModelCatalog'
import type { CanvasNodeShape } from '@/features/canvas-engine'
import type { JsonObject } from '@/types/nodeRuntime'

export function createRuntimeGraphImageGenerationParams(
  data: JsonObject,
  nodeType: CanvasNodeShape['props']['nodeType'],
) {
  return createImageGenerationParams(data, nodeType as 'image_gen' | 'image_gen_4')
}

export function getEstimatedImageGenerationDurationMs(node: CanvasNodeShape) {
  return getCatalogEstimatedImageGenerationDurationMs(node.props.data, node.props.nodeType as 'image_gen' | 'image_gen_4')
}

export { getGeneratedImageAspectWarning }
