import type { TLGeoShapeGeoStyle } from 'tldraw'

export type ToolAction =
  | { geo: TLGeoShapeGeoStyle; icon: string; id: string; kind: 'geo'; label: string }
  | {
      icon: string
      id: string
      kind: 'tool'
      label: string
      tool: 'arrow' | 'draw' | 'eraser' | 'frame' | 'line' | 'note' | 'text'
    }

export const shapeTools: Extract<ToolAction, { kind: 'geo' }>[] = [
  { geo: 'rectangle', icon: '▭', id: 'rectangle', kind: 'geo', label: 'Rectangle' },
  { geo: 'diamond', icon: '◇', id: 'diamond', kind: 'geo', label: 'Diamond' },
  { geo: 'ellipse', icon: '○', id: 'ellipse', kind: 'geo', label: 'Ellipse' },
  { geo: 'triangle', icon: '△', id: 'triangle', kind: 'geo', label: 'Triangle' },
  { geo: 'cloud', icon: '☁', id: 'cloud', kind: 'geo', label: 'Cloud' },
]

export const directTools: Extract<ToolAction, { kind: 'tool' }>[] = [
  { icon: '→', id: 'arrow', kind: 'tool', label: 'Arrow', tool: 'arrow' },
  { icon: '╱', id: 'line', kind: 'tool', label: 'Line', tool: 'line' },
  { icon: '✎', id: 'draw', kind: 'tool', label: 'Draw', tool: 'draw' },
  { icon: 'A', id: 'text', kind: 'tool', label: 'Text', tool: 'text' },
  { icon: '⌫', id: 'eraser', kind: 'tool', label: 'Eraser', tool: 'eraser' },
]

export const noteTool: ToolAction = {
  icon: '▤',
  id: 'note',
  kind: 'tool',
  label: 'Sticky note',
  tool: 'note',
}

export const frameTool: ToolAction = {
  icon: '▣',
  id: 'frame',
  kind: 'tool',
  label: 'Frame',
  tool: 'frame',
}
