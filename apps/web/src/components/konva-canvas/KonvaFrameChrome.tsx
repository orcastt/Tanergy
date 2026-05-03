import { Rect } from 'react-konva'
import type { CanvasFrameShape } from '@/features/canvas-engine'
import { getStrokeDash, resolveKonvaShapeStyle } from './konvaCanvasStyle'

type KonvaFrameChromeProps = {
  frame: CanvasFrameShape
}

export function KonvaFrameChrome({ frame }: KonvaFrameChromeProps) {
  const style = resolveKonvaShapeStyle(frame.style)
  return (
    <>
      <Rect
        dash={getStrokeDash(style.dash, style.strokeWidth)}
        fill="transparent"
        height={frame.props.height}
        listening={false}
        opacity={style.opacity}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        width={frame.props.width}
        x={frame.x}
        y={frame.y}
      />
    </>
  )
}
