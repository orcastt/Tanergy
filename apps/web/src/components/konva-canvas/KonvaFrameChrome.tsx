import { Group, Rect } from 'react-konva'
import type { CanvasFrameShape } from '@/features/canvas-engine'
import { getStrokeDash, resolveKonvaShapeStyle } from './konvaCanvasStyle'
import { konvaCaptureExcludeName } from './konvaSelectionExport'

type KonvaFrameChromeProps = {
  frame: CanvasFrameShape
}

export function KonvaFrameChrome({ frame }: KonvaFrameChromeProps) {
  const style = resolveKonvaShapeStyle(frame.style)
  const center = {
    x: frame.x + frame.props.width / 2,
    y: frame.y + frame.props.height / 2,
  }
  return (
    <Group listening={false} name={konvaCaptureExcludeName} rotation={frame.rotation ?? 0} x={center.x} y={center.y}>
      <Rect
        dash={getStrokeDash(style.dash, style.strokeWidth)}
        fill="transparent"
        height={frame.props.height}
        opacity={style.opacity}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        width={frame.props.width}
        x={-frame.props.width / 2}
        y={-frame.props.height / 2}
      />
    </Group>
  )
}
