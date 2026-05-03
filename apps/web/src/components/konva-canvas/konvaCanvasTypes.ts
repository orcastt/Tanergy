import type { CanvasPoint, CanvasShape, StrokePoint } from '@/features/canvas-engine'

export type KonvaCanvasTool =
  | 'hand'
  | 'select'
  | 'draw'
  | 'rect'
  | 'diamond'
  | 'ellipse'
  | 'triangle'
  | 'cloud'
  | 'line'
  | 'arrow'
  | 'text'
  | 'eraser'

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

export const konvaToolLabels: Record<KonvaCanvasTool, string> = {
  arrow: 'Arrow',
  cloud: 'Cloud',
  diamond: 'Diamond',
  draw: 'Draw',
  ellipse: 'Circle',
  eraser: 'Eraser',
  hand: 'Hand',
  line: 'Line',
  rect: 'Rectangle',
  select: 'Select',
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
  hand: 'H',
  line: 'L',
  rect: 'R',
  select: 'V',
  text: 'T',
  triangle: 'G',
}

export const konvaToolGroups: KonvaToolGroup[] = [
  { label: 'Move', tools: ['hand', 'select'] },
  { label: 'Shapes', tools: ['rect', 'diamond', 'ellipse', 'triangle', 'cloud'] },
  { label: 'Lines', tools: ['arrow', 'line', 'draw'] },
  { label: 'Content', tools: ['text', 'eraser'] },
]
