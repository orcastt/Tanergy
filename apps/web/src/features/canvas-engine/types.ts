import type { JsonObject, NodePortDataType, NodeRuntimeSummary, NodeType } from '@/types/nodeRuntime'

export type CanvasPoint = {
  x: number
  y: number
}

export type CanvasSize = {
  height: number
  width: number
}

export type CanvasRect = CanvasPoint & CanvasSize

export type CanvasCamera = {
  x: number
  y: number
  zoom: number
}

export type CanvasPointer = CanvasPoint & {
  pointerId?: number
  pressure?: number
}

export type StrokePoint = CanvasPoint & {
  pressure?: number
  time?: number
}

export type CanvasShapeStyle = {
  dash?: 'draw' | 'solid' | 'dashed' | 'dotted'
  fill?: string
  fillStyle?: 'none' | 'semi' | 'solid' | 'pattern'
  fontSize?: number
  opacity?: number
  stroke?: string
  strokeWidth?: number
  textAlign?: 'center' | 'left' | 'right'
}

export type CanvasShapeBase<Type extends string, Props extends object = object> = {
  flipX?: boolean
  flipY?: boolean
  groupId?: string | null
  id: string
  isLocked?: boolean
  parentId?: string | null
  props: Props
  rotation?: number
  style?: CanvasShapeStyle
  type: Type
  x: number
  y: number
}

export type CanvasTextContainerProps = CanvasSize & {
  text?: string
}

export type CanvasRectShape = CanvasShapeBase<'rect', CanvasTextContainerProps>

export type CanvasDiamondShape = CanvasShapeBase<'diamond', CanvasTextContainerProps>

export type CanvasEllipseShape = CanvasShapeBase<'ellipse', CanvasTextContainerProps>

export type CanvasTriangleShape = CanvasShapeBase<'triangle', CanvasTextContainerProps>

export type CanvasCloudShape = CanvasShapeBase<'cloud', CanvasTextContainerProps>

export type CanvasFrameShape = CanvasShapeBase<'frame', CanvasSize & {
  title?: string
}>

export type CanvasLineShape = CanvasShapeBase<'line', {
  bends?: CanvasPoint[]
  control?: CanvasPoint | null
  end: CanvasPoint
  endHead?: 'arrow' | 'dot' | 'none'
  route?: 'curve' | 'orthogonal' | 'straight'
  startHead?: 'arrow' | 'dot' | 'none'
}>

export type CanvasArrowShape = CanvasShapeBase<'arrow', {
  bends?: CanvasPoint[]
  control?: CanvasPoint | null
  end: CanvasPoint
  endHead?: 'arrow' | 'dot' | 'none'
  route?: 'curve' | 'orthogonal' | 'straight'
  startHead?: 'arrow' | 'dot' | 'none'
}>

export type CanvasImageShape = CanvasShapeBase<'image', CanvasSize & {
  assetId: string
  alt?: string
  crop?: {
    height: number
    width: number
    x: number
    y: number
  }
  mime?: string
  originalUrl?: string
  thumbnail1024Url?: string
  thumbnail256Url?: string
  thumbnail512Url?: string
  title?: string
}>

export type CanvasNodeShape = CanvasShapeBase<'node_card', CanvasSize & {
  data: JsonObject
  nodeId: string
  nodeType: NodeType
  runtimeSummary: NodeRuntimeSummary
  version: number
}>

export type CanvasTextShape = CanvasShapeBase<'text', CanvasSize & {
  text: string
}>

export type CanvasStickyShape = CanvasShapeBase<'sticky', CanvasSize & {
  authorName?: string
  text: string
}>

export type CanvasStrokeShape = CanvasShapeBase<'stroke', {
  points: StrokePoint[]
}>

export type CanvasShape =
  | CanvasArrowShape
  | CanvasCloudShape
  | CanvasDiamondShape
  | CanvasEllipseShape
  | CanvasFrameShape
  | CanvasImageShape
  | CanvasLineShape
  | CanvasNodeShape
  | CanvasRectShape
  | CanvasStickyShape
  | CanvasStrokeShape
  | CanvasTextShape
  | CanvasTriangleShape

export type CanvasDocumentMetadata = {
  createdAt: string
  name?: string
  updatedAt: string
}

export type CanvasRuntimeEdge = {
  dataType: NodePortDataType
  id: string
  sourcePortId: string
  sourceShapeId: string
  targetPortId: string
  targetShapeId: string
}

export type CanvasDocument = {
  camera: CanvasCamera
  id: string
  metadata: CanvasDocumentMetadata
  runtimeEdges: CanvasRuntimeEdge[]
  schemaVersion: 1
  shapes: CanvasShape[]
}

export type CanvasBounds = {
  maxX: number
  maxY: number
  minX: number
  minY: number
}
