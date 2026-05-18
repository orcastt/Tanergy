import type { CanvasNodeShape, CanvasShape } from '@/features/canvas-engine'
import { getDefaultNodeCardSize } from '@/features/node-runtime/registry'

const defaultMinResizeSize = 12

export function getKonvaShapeMinResizeSize(shape: CanvasShape) {
  if (shape.type !== 'node_card') return {
    height: defaultMinResizeSize,
    width: defaultMinResizeSize,
  }
  return getDefaultNodeCardSize(shape.props.nodeType)
}

export function normalizeKonvaNodeCardSize(shape: CanvasNodeShape): CanvasNodeShape {
  const minSize = getKonvaShapeMinResizeSize(shape)
  const height = Math.max(minSize.height, shape.props.height)
  const width = Math.max(minSize.width, shape.props.width)
  if (height === shape.props.height && width === shape.props.width) return shape
  return {
    ...shape,
    props: {
      ...shape.props,
      height,
      width,
    },
  }
}

export function normalizeKonvaShapeMinResizeSize(shape: CanvasShape): CanvasShape {
  return shape.type === 'node_card' ? normalizeKonvaNodeCardSize(shape) : shape
}
