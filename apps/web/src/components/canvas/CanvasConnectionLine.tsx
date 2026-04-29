'use client'

import type { Editor } from 'tldraw'
import { usePortConnectionStore } from './portConnectionStore'

type CanvasConnectionLineProps = {
  editor: Editor | null
}

export function CanvasConnectionLine({ editor }: CanvasConnectionLineProps) {
  const connectingFrom = usePortConnectionStore((s) => s.connectingFrom)
  const mouseScreenPoint = usePortConnectionStore((s) => s.mouseScreenPoint)

  if (!editor || !connectingFrom || !mouseScreenPoint) return null

  const start = editor.pageToScreen(connectingFrom.pagePoint)
  const color = connectingFrom.portDataType === 'image' ? '#22c55e' : '#eab308'

  return (
    <svg className="canvas-connection-line-overlay" aria-hidden>
      <line
        stroke={color}
        strokeDasharray="6 4"
        strokeLinecap="round"
        strokeWidth={2}
        x1={start.x}
        x2={mouseScreenPoint.x}
        y1={start.y}
        y2={mouseScreenPoint.y}
      />
      <circle cx={start.x} cy={start.y} fill={color} r={4} />
      <circle cx={mouseScreenPoint.x} cy={mouseScreenPoint.y} fill={color} r={3} />
    </svg>
  )
}
