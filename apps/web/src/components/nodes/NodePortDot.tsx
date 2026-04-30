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
  const isCompatibleTarget = Boolean(
    connectingFrom &&
    connectingFrom.shapeId !== shape.id &&
    port.direction === 'in' &&
    connectingFrom.portDataType === port.dataType
  )

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.preventDefault()
  }, [])

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.preventDefault()
    const pagePoint = getPortPagePoint(getEditorPagePoint, shape, port)
    if (!pagePoint) return

    if (connectingFrom && port.direction === 'in') {
      window.dispatchEvent(new CustomEvent('port:complete', {
        detail: {
          from: connectingFrom,
          targetPortId: port.id,
          targetScreenPoint: { x: event.clientX, y: event.clientY },
          targetShapeId: shape.id,
        },
      }))
      usePortConnectionStore.getState().cancel()
      return
    }

    if (port.direction !== 'out') return

    storeStart({
      pagePoint,
      portDataType: port.dataType,
      portDirection: port.direction,
      portId: port.id,
      shapeId: shape.id,
    }, { x: event.clientX, y: event.clientY })
  }, [connectingFrom, getEditorPagePoint, port, shape, storeStart])

  return (
    <div
      className="node-card__port"
      data-active={connectingFrom?.shapeId === shape.id && connectingFrom.portId === port.id ? 'true' : undefined}
      data-compatible={isCompatibleTarget ? 'true' : undefined}
      data-direction={port.direction}
      data-port-direction={port.direction}
      data-port-id={port.id}
      data-port-type={port.dataType}
      data-shape-id={shape.id}
      data-type={port.dataType}
      onClick={handleClick}
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
