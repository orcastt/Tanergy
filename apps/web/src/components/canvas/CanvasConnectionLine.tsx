'use client'

import { useEffect } from 'react'
import type { Editor } from 'tldraw'
import { usePortConnectionStore } from '@/components/canvas/portConnectionStore'

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
      event.preventDefault()
      event.stopPropagation()
      window.dispatchEvent(new CustomEvent('port:complete', {
        detail: {
          from: usePortConnectionStore.getState().connectingFrom,
          targetScreenPoint: { x: event.clientX, y: event.clientY },
        },
      }))
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
  const end = getPreviewEndPoint(start, mouseScreenPoint)
  const color = connectingFrom.portDataType === 'image' ? '#22c55e' : '#eab308'
  const curveOffset = Math.max(64, Math.abs(end.x - start.x) * 0.45)
  const path = [
    `M ${start.x} ${start.y}`,
    `C ${start.x + curveOffset} ${start.y}`,
    `${end.x - curveOffset} ${end.y}`,
    `${end.x} ${end.y}`,
  ].join(' ')

  return (
    <svg className="canvas-connection-line-overlay" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={3}
      />
      <circle cx={start.x} cy={start.y} fill="white" r={9} stroke={color} strokeWidth={3} />
      <circle cx={start.x} cy={start.y} fill={color} r={4} />
      <circle cx={end.x} cy={end.y} fill="white" r={7} stroke={color} strokeWidth={3} />
      <circle cx={end.x} cy={end.y} fill={color} r={3} />
    </svg>
  )
}

function getPreviewEndPoint(start: { x: number; y: number }, point: { x: number; y: number }) {
  const distance = Math.hypot(point.x - start.x, point.y - start.y)
  if (distance >= 12) return point
  return { x: start.x + 54, y: start.y }
}
