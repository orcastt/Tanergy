import { memo, useMemo } from 'react'
import { Ellipse, Group, Line, Path, Rect, Text } from 'react-konva'
import type { CanvasShape } from '@/features/canvas-engine'
import { getStrokeDash, resolveKonvaShapeStyle } from './konvaCanvasStyle'
import { getPatternTile } from './konvaPatternUtils'
import { getArrowHeadPoints, getCloudPath, getFreehandPath } from './konvaPathUtils'

type KonvaCanvasShapeProps = {
  interactive?: boolean
  isSelected: boolean
  panMode: boolean
  shape: CanvasShape
  toolAllowsDrag: boolean
  zoom: number
  onDragMove: (shapeId: string, x: number, y: number) => void
  onDragStart: (shapeId: string) => void
  onDragEnd: (shapeId: string, x: number, y: number) => void
  onSelect: (shapeId: string, options?: { additive?: boolean }) => void
}

function KonvaCanvasShapeComponent({
  interactive = true,
  isSelected,
  onDragMove,
  onDragStart,
  onDragEnd,
  onSelect,
  panMode,
  shape,
  toolAllowsDrag,
  zoom,
}: KonvaCanvasShapeProps) {
  const style = useMemo(() => resolveKonvaShapeStyle(shape.style), [shape.style])
  const renderedShape = useMemo(
    () => renderShape(shape, style, isSelected, zoom),
    [isSelected, shape, style, zoom]
  )
  const canInteract = interactive && !panMode

  return (
    <Group
      draggable={canInteract && toolAllowsDrag}
      key={shape.id}
      listening={interactive}
      onClick={canInteract ? (event) => {
        if (event.evt.button === 1) return
        event.cancelBubble = true
        onSelect(shape.id, { additive: event.evt.shiftKey })
      } : undefined}
      onDragMove={canInteract ? (event) => onDragMove(shape.id, event.target.x(), event.target.y()) : undefined}
      onDragStart={canInteract ? () => onDragStart(shape.id) : undefined}
      onDragEnd={canInteract ? (event) => onDragEnd(shape.id, event.target.x(), event.target.y()) : undefined}
      onPointerDown={canInteract ? (event) => {
        if (event.evt.button === 1) return
        event.cancelBubble = true
        onSelect(shape.id, { additive: event.evt.shiftKey })
      } : undefined}
      x={shape.x}
      y={shape.y}
    >
      {renderedShape}
      {isSelected && !isLineLikeShape(shape) ? <SelectionBox shape={shape} zoom={zoom} /> : null}
    </Group>
  )
}

export const KonvaCanvasShape = memo(KonvaCanvasShapeComponent, areShapePropsEqual)

function areShapePropsEqual(previous: KonvaCanvasShapeProps, next: KonvaCanvasShapeProps) {
  if (previous.interactive !== next.interactive) return false
  if (previous.shape !== next.shape) return false
  if (previous.isSelected !== next.isSelected) return false
  if (previous.panMode !== next.panMode) return false
  if (previous.toolAllowsDrag !== next.toolAllowsDrag) return false
  if (next.isSelected && previous.zoom !== next.zoom) return false
  return true
}

function renderShape(shape: CanvasShape, style: ReturnType<typeof resolveKonvaShapeStyle>, isSelected: boolean, zoom: number) {
  const highlightStroke = '#6b5cff'
  const { dash, fill, fillStyle, opacity, stroke, strokeWidth } = style
  const strokeDash = getStrokeDash(dash, strokeWidth)
  const highlightWidth = Math.max(strokeWidth + 4 / zoom, strokeWidth * 2.4)
  const closedFillProps = getClosedFillProps(fill, fillStyle, stroke)
  const strokeLineCap = dash === 'dotted' ? 'round' : 'butt'
  if (shape.type === 'rect') {
    return <Rect {...closedFillProps} cornerRadius={10} dash={strokeDash} height={shape.props.height} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} width={shape.props.width} />
  }
  if (shape.type === 'ellipse') {
    return <Ellipse {...closedFillProps} dash={strokeDash} opacity={opacity} radiusX={shape.props.width / 2} radiusY={shape.props.height / 2} stroke={stroke} strokeWidth={strokeWidth} x={shape.props.width / 2} y={shape.props.height / 2} />
  }
  if (shape.type === 'diamond') {
    const { height, width } = shape.props
    return <Line {...closedFillProps} closed dash={strokeDash} lineCap={strokeLineCap} opacity={opacity} points={[width / 2, 0, width, height / 2, width / 2, height, 0, height / 2]} stroke={stroke} strokeWidth={strokeWidth} />
  }
  if (shape.type === 'triangle') {
    const { height, width } = shape.props
    return <Line {...closedFillProps} closed dash={strokeDash} lineCap={strokeLineCap} opacity={opacity} points={[width / 2, 0, width, height, 0, height]} stroke={stroke} strokeWidth={strokeWidth} />
  }
  if (shape.type === 'cloud') {
    return <Path {...closedFillProps} dash={strokeDash} data={getCloudPath(shape.props.width, shape.props.height)} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} />
  }
  if (shape.type === 'line') {
    const points = [0, 0, shape.props.end.x, shape.props.end.y]
    return (
      <>
        {isSelected ? <Line hitStrokeWidth={16} lineCap="round" listening={false} opacity={0.28} points={points} stroke={highlightStroke} strokeWidth={highlightWidth} /> : null}
        <Line dash={strokeDash} hitStrokeWidth={16} lineCap="round" opacity={opacity} points={points} stroke={stroke} strokeWidth={strokeWidth} />
      </>
    )
  }
  if (shape.type === 'arrow') {
    const points = [0, 0, shape.props.end.x, shape.props.end.y]
    return (
      <>
        {isSelected ? <Line hitStrokeWidth={16} lineCap="round" listening={false} opacity={0.28} points={points} stroke={highlightStroke} strokeWidth={highlightWidth} /> : null}
        <Line dash={strokeDash} hitStrokeWidth={16} lineCap="round" opacity={opacity} points={points} stroke={stroke} strokeWidth={strokeWidth} />
        <Line closed fill={stroke} opacity={opacity} points={getArrowHeadPoints(shape.props.end, { x: 0, y: 0 }, Math.max(12, strokeWidth * 5))} />
      </>
    )
  }
  if (shape.type === 'stroke') {
    const path = getFreehandPath(shape.props.points, strokeWidth * 2.2)
    return (
      <>
        {isSelected ? <Path data={path} fill={highlightStroke} listening={false} opacity={0.18} scaleX={1.04} scaleY={1.04} /> : null}
        <Path data={path} fill={stroke} hitStrokeWidth={16} opacity={opacity} />
      </>
    )
  }
  if (shape.type === 'text') {
    return <Text fill={stroke} fontFamily="Inter, system-ui, sans-serif" fontSize={18} height={shape.props.height} opacity={opacity} text={shape.props.text} width={shape.props.width} />
  }
  if (shape.type === 'image') {
    return <Rect dash={strokeDash} fill="rgba(102, 122, 144, 0.12)" height={shape.props.height} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} width={shape.props.width} />
  }
  return null
}

function getClosedFillProps(fill: string, fillStyle: ReturnType<typeof resolveKonvaShapeStyle>['fillStyle'], stroke: string) {
  const patternTile = fillStyle === 'pattern' ? getPatternTile(stroke) : undefined
  return patternTile
    ? {
        fillPatternImage: patternTile.image as unknown as HTMLImageElement,
        fillPatternRepeat: 'repeat' as const,
        fillPatternScaleX: patternTile.scale,
        fillPatternScaleY: patternTile.scale,
      }
    : { fill }
}

function SelectionBox({ shape, zoom }: { shape: CanvasShape; zoom: number }) {
  if (isLineLikeShape(shape)) return null
  const rect = { height: shape.props.height, width: shape.props.width, x: 0, y: 0 }
  return (
    <Rect dash={[5 / zoom, 4 / zoom]} height={rect.height} listening={false} stroke="#6b5cff" strokeWidth={1.2 / zoom} width={rect.width} x={rect.x} y={rect.y} />
  )
}

function isLineLikeShape(shape: CanvasShape) {
  return shape.type === 'arrow' || shape.type === 'line' || shape.type === 'stroke'
}
