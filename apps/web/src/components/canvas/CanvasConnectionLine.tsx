'use client'

import { useEffect } from 'react'
import type { Editor } from 'tldraw'
import { usePortConnectionStore } from './portConnectionStore'

type CanvasConnectionLineProps = {
  editor: Editor | null
}

export function CanvasConnectionLine({ editor }: CanvasConnectionLineProps) {
  const connectingFrom = usePortConnectionStore((s) => s.connectingFrom)
  const mouseScreenPoint = usePortConnectionStore((s) => s.mouseScreenPoint)
  const cancel = usePortConnectionStore((s) => s.cancel)
  const setMouseScreenPoint = usePortConnectionStore((s) => s.setMouseScreenPoint)

  useEffect(() => {
    if (!connectingFrom) return

    const handlePointerMove = (event: PointerEvent) => {
      setMouseScreenPoint({ x: event.clientX, y: event.clientY })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[data-port-id]')) return
      cancel()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [cancel, connectingFrom, setMouseScreenPoint])

  if (!editor || !connectingFrom || !mouseScreenPoint) return null

  const start = editor.pageToScreen(connectingFrom.pagePoint)
  const color = connectingFrom.portDataType === 'image' ? '#22c55e' : '#eab308'
  const curveOffset = Math.max(64, Math.abs(mouseScreenPoint.x - start.x) * 0.45)
  const path = [
    `M ${start.x} ${start.y}`,
    `C ${start.x + curveOffset} ${start.y}`,
    `${mouseScreenPoint.x - curveOffset} ${mouseScreenPoint.y}`,
    `${mouseScreenPoint.x} ${mouseScreenPoint.y}`,
  ].join(' ')

  return (
    <svg className="canvas-connection-line-overlay" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeDasharray="6 4"
        strokeLinecap="round"
        strokeWidth={2}
      />
      <circle cx={start.x} cy={start.y} fill={color} r={4} />
      <circle cx={mouseScreenPoint.x} cy={mouseScreenPoint.y} fill={color} r={3} />
    </svg>
  )
}
