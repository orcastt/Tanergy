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
  opacity?: number
  stroke?: string
  strokeWidth?: number
}

export type CanvasShapeBase<Type extends string, Props extends object = object> = {
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

export type CanvasRectShape = CanvasShapeBase<'rect', CanvasSize>

export type CanvasDiamondShape = CanvasShapeBase<'diamond', CanvasSize>

export type CanvasEllipseShape = CanvasShapeBase<'ellipse', CanvasSize>

export type CanvasTriangleShape = CanvasShapeBase<'triangle', CanvasSize>

export type CanvasCloudShape = CanvasShapeBase<'cloud', CanvasSize>

export type CanvasLineShape = CanvasShapeBase<'line', {
  control?: CanvasPoint | null
  end: CanvasPoint
}>

export type CanvasArrowShape = CanvasShapeBase<'arrow', {
  control?: CanvasPoint | null
  end: CanvasPoint
}>

export type CanvasImageShape = CanvasShapeBase<'image', CanvasSize & {
  assetId: string
  alt?: string
}>

export type CanvasTextShape = CanvasShapeBase<'text', CanvasSize & {
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
  | CanvasImageShape
  | CanvasLineShape
  | CanvasRectShape
  | CanvasStrokeShape
  | CanvasTextShape
  | CanvasTriangleShape

export type CanvasDocumentMetadata = {
  createdAt: string
  name?: string
  updatedAt: string
}

export type CanvasDocument = {
  camera: CanvasCamera
  id: string
  metadata: CanvasDocumentMetadata
  schemaVersion: 1
  shapes: CanvasShape[]
}

export type CanvasBounds = {
  maxX: number
  maxY: number
  minX: number
  minY: number
}
