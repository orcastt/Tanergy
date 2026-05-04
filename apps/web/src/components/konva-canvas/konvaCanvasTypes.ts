import type { CanvasBounds, CanvasPoint, CanvasShape, StrokePoint } from '@/features/canvas-engine'
import type { NodePortDataType } from '@/types/nodeRuntime'
import type { KonvaImageCropHandle } from './konvaImageCropCommands'

export type KonvaCanvasTool =
  | 'hand'
  | 'select'
  | 'draw'
  | 'rect'
  | 'diamond'
  | 'ellipse'
  | 'triangle'
  | 'cloud'
  | 'frame'
  | 'line'
  | 'arrow'
  | 'sticky'
  | 'text'
  | 'eraser'

export type KonvaResizeHandle = 'ne' | 'nw' | 'se' | 'sw'

export type KonvaLineEndpointHandle = 'end' | 'start'
export type KonvaLineRouteHandle = 'bend-0' | 'bend-1' | 'control'

export type KonvaToolGroup = {
  label: string
  tools: KonvaCanvasTool[]
}

export type KonvaToolSession =
  | {
      origin: CanvasPoint
      pointerId?: number
      type: 'pan'
    }
  | {
      draft: CanvasShape
      origin: CanvasPoint
      pointerId?: number
      rawPoints?: StrokePoint[]
      type: 'create'
    }
  | {
      pointerId?: number
      type: 'erase'
    }
  | {
      additive: boolean
      current: CanvasPoint
      origin: CanvasPoint
      pointerId?: number
      type: 'select-box'
    }
  | {
      handle: KonvaResizeHandle
      originBounds: CanvasBounds
      originShapes: CanvasShape[]
      pointerId?: number
      rotatedBox?: {
        center: CanvasPoint
        localBounds: CanvasBounds
        rotation: number
      } | null
      shapeIds: string[]
      type: 'resize'
    }
  | {
      center: CanvasPoint
      guideRadius: number
      originShapes: CanvasShape[]
      originRotation: number
      pointerId?: number
      shapeIds: string[]
      startAngle: number
      type: 'rotate'
    }
  | {
      endpoint: KonvaLineEndpointHandle
      originShape: Extract<CanvasShape, { type: 'arrow' | 'line' }>
      pointerId?: number
      shapeId: string
      type: 'line-endpoint'
    }
  | {
      handle: KonvaLineRouteHandle
      originShape: Extract<CanvasShape, { type: 'arrow' | 'line' }>
      pointerId?: number
      shapeId: string
      type: 'line-route-handle'
    }
  | {
      dataType: NodePortDataType
      pointerId?: number
      sourceEndpoints?: {
        portId: string
        shapeId: string
      }[]
      sourcePortId: string
      sourceShapeId: string
      type: 'node-connection'
    }
  | {
      handle: KonvaImageCropHandle
      originShape: Extract<CanvasShape, { type: 'image' }>
      pointerId?: number
      shapeId: string
      type: 'image-crop'
    }

export const konvaToolLabels: Record<KonvaCanvasTool, string> = {
  arrow: 'Arrow',
  cloud: 'Cloud',
  diamond: 'Diamond',
  draw: 'Draw',
  ellipse: 'Circle',
  eraser: 'Eraser',
  frame: 'Frame',
  hand: 'Hand',
  line: 'Line',
  rect: 'Rectangle',
  select: 'Select',
  sticky: 'Sticky',
  text: 'Text',
  triangle: 'Triangle',
}

export const konvaToolShortcuts: Partial<Record<KonvaCanvasTool, string>> = {
  arrow: 'A',
  cloud: 'U',
  diamond: 'D',
  draw: 'P',
  ellipse: 'C',
  eraser: 'E',
  frame: 'F',
  hand: 'H',
  line: 'L',
  rect: 'R',
  select: 'V',
  sticky: 'N',
  text: 'T',
  triangle: 'G',
}

export const konvaToolGroups: KonvaToolGroup[] = [
  { label: 'Move', tools: ['hand', 'select'] },
  { label: 'Shapes', tools: ['rect', 'diamond', 'ellipse', 'triangle', 'cloud', 'frame'] },
  { label: 'Lines', tools: ['arrow', 'line', 'draw'] },
  { label: 'Content', tools: ['sticky', 'text', 'eraser'] },
]
