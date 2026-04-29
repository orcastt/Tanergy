'use client'

import { useCallback, useState } from 'react'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { ResolvedNodePort } from '@/types/nodeRuntime'
import { usePortConnectionStore } from '@/components/canvas/portConnectionStore'

type NodePortDotProps = {
  getEditorPagePoint: (localX: number, localY: number) => { x: number; y: number } | null
  port: ResolvedNodePort
  shape: NodeCardShape
}

export function NodePortDot({ getEditorPagePoint, port, shape }: NodePortDotProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const connectingFrom = usePortConnectionStore((state) => state.connectingFrom)
  const storeStart = usePortConnectionStore((state) => state.start)
  const storeCancel = usePortConnectionStore((state) => state.cancel)
  const setMouseScreenPoint = usePortConnectionStore((state) => state.setMouseScreenPoint)

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.preventDefault()
    if (port.direction !== 'out') return

    const pagePoint = getPortPagePoint(getEditorPagePoint, shape, port)
    if (!pagePoint) return

    storeStart({
      pagePoint,
      portDataType: port.dataType,
      portDirection: port.direction,
      portId: port.id,
      shapeId: shape.id,
    })
    setMouseScreenPoint({ x: event.clientX, y: event.clientY })

    const onMove = (moveEvent: PointerEvent) => {
      setMouseScreenPoint({ x: moveEvent.clientX, y: moveEvent.clientY })
    }

    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.dispatchEvent(new CustomEvent('port:complete', {
        detail: {
          from: usePortConnectionStore.getState().connectingFrom,
          targetScreenPoint: { x: upEvent.clientX, y: upEvent.clientY },
        },
      }))
      storeCancel()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [getEditorPagePoint, port, setMouseScreenPoint, shape, storeCancel, storeStart])

  return (
    <div
      className="node-card__port"
      data-active={connectingFrom?.shapeId === shape.id && connectingFrom.portId === port.id ? 'true' : undefined}
      data-direction={port.direction}
      data-port-direction={port.direction}
      data-port-id={port.id}
      data-port-type={port.dataType}
      data-shape-id={shape.id}
      data-type={port.dataType}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onPointerDown={handlePointerDown}
      style={{ top: `${port.anchorY * 100}%` }}
    >
      {showTooltip ? <span className="node-card__port-tooltip">{port.dataType}</span> : null}
    </div>
  )
}

function getPortPagePoint(
  getEditorPagePoint: NodePortDotProps['getEditorPagePoint'],
  shape: NodeCardShape,
  port: ResolvedNodePort
) {
  const localX = port.direction === 'out' ? shape.props.w : 0
  const localY = shape.props.h * port.anchorY
  return getEditorPagePoint(localX, localY)
}
