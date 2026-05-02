import type { TLGeoShapeGeoStyle } from 'tldraw'
import type { CanvasLineIconName } from './CanvasLineIcon'

export type ToolAction =
  | { geo: TLGeoShapeGeoStyle; icon: CanvasLineIconName; id: string; kind: 'geo'; label: string }
  | {
      icon: CanvasLineIconName
      id: string
      kind: 'tool'
      label: string
      tool: 'arrow' | 'draw' | 'eraser' | 'frame' | 'line' | 'note' | 'text'
    }

export const shapeTools: Extract<ToolAction, { kind: 'geo' }>[] = [
  { geo: 'rectangle', icon: 'rectangle', id: 'rectangle', kind: 'geo', label: 'Rectangle' },
  { geo: 'diamond', icon: 'diamond', id: 'diamond', kind: 'geo', label: 'Diamond' },
  { geo: 'ellipse', icon: 'ellipse', id: 'ellipse', kind: 'geo', label: 'Ellipse' },
  { geo: 'triangle', icon: 'triangle', id: 'triangle', kind: 'geo', label: 'Triangle' },
  { geo: 'cloud', icon: 'cloud', id: 'cloud', kind: 'geo', label: 'Cloud' },
]

export const directTools: Extract<ToolAction, { kind: 'tool' }>[] = [
  { icon: 'arrow', id: 'arrow', kind: 'tool', label: 'Arrow', tool: 'arrow' },
  { icon: 'line', id: 'line', kind: 'tool', label: 'Line', tool: 'line' },
  { icon: 'draw', id: 'draw', kind: 'tool', label: 'Draw', tool: 'draw' },
  { icon: 'text', id: 'text', kind: 'tool', label: 'Text', tool: 'text' },
  { icon: 'eraser', id: 'eraser', kind: 'tool', label: 'Eraser', tool: 'eraser' },
]

export const noteTool: ToolAction = {
  icon: 'rectangle',
  id: 'note',
  kind: 'tool',
  label: 'Sticky note',
  tool: 'note',
}

export const frameTool: ToolAction = {
  icon: 'rectangle',
  id: 'frame',
  kind: 'tool',
  label: 'Frame',
  tool: 'frame',
}
