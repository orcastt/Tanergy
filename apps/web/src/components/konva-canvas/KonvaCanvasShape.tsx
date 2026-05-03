import { memo, useMemo } from 'react'
import { Ellipse, Group, Line, Path, Rect, Text } from 'react-konva'
import { getPointsBounds, type CanvasPoint, type CanvasShape } from '@/features/canvas-engine'
import { getArrowHeadPoints, getCloudPath, getFreehandPath } from './konvaPathUtils'

type KonvaCanvasShapeProps = {
  isSelected: boolean
  panMode: boolean
  shape: CanvasShape
  toolAllowsDrag: boolean
  zoom: number
  onDragEnd: (shapeId: string, x: number, y: number) => void
  onSelect: (shapeId: string) => void
}

function KonvaCanvasShapeComponent({
  isSelected,
  onDragEnd,
  onSelect,
  panMode,
  shape,
  toolAllowsDrag,
  zoom,
}: KonvaCanvasShapeProps) {
  const stroke = shape.style?.stroke ?? '#233142'
  const fill = shape.style?.fill ?? 'rgba(255, 255, 255, 0.78)'
  const strokeWidth = shape.style?.strokeWidth ?? 2
  const opacity = shape.style?.opacity ?? 1
  const renderedShape = useMemo(
    () => renderShape(shape, stroke, fill, strokeWidth, opacity),
    [fill, opacity, shape, stroke, strokeWidth]
  )

  return (
    <Group
      draggable={toolAllowsDrag && !panMode}
      key={shape.id}
      onClick={(event) => {
        if (panMode || event.evt.button === 1) return
        event.cancelBubble = true
        onSelect(shape.id)
      }}
      onDragEnd={(event) => onDragEnd(shape.id, event.target.x(), event.target.y())}
      onPointerDown={(event) => {
        if (panMode || event.evt.button === 1) return
        event.cancelBubble = true
        onSelect(shape.id)
      }}
      x={shape.x}
      y={shape.y}
    >
      {renderedShape}
      {isSelected ? <SelectionBox shape={shape} zoom={zoom} /> : null}
    </Group>
  )
}

export const KonvaCanvasShape = memo(KonvaCanvasShapeComponent, areShapePropsEqual)

function areShapePropsEqual(previous: KonvaCanvasShapeProps, next: KonvaCanvasShapeProps) {
  if (previous.shape !== next.shape) return false
  if (previous.isSelected !== next.isSelected) return false
  if (previous.panMode !== next.panMode) return false
  if (previous.toolAllowsDrag !== next.toolAllowsDrag) return false
  if (next.isSelected && previous.zoom !== next.zoom) return false
  return true
}

function renderShape(shape: CanvasShape, stroke: string, fill: string, strokeWidth: number, opacity: number) {
  if (shape.type === 'rect') {
    return <Rect height={shape.props.height} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} width={shape.props.width} fill={fill} cornerRadius={10} />
  }
  if (shape.type === 'ellipse') {
    return <Ellipse fill={fill} opacity={opacity} radiusX={shape.props.width / 2} radiusY={shape.props.height / 2} stroke={stroke} strokeWidth={strokeWidth} x={shape.props.width / 2} y={shape.props.height / 2} />
  }
  if (shape.type === 'diamond') {
    const { height, width } = shape.props
    return <Line closed fill={fill} opacity={opacity} points={[width / 2, 0, width, height / 2, width / 2, height, 0, height / 2]} stroke={stroke} strokeWidth={strokeWidth} />
  }
  if (shape.type === 'triangle') {
    const { height, width } = shape.props
    return <Line closed fill={fill} opacity={opacity} points={[width / 2, 0, width, height, 0, height]} stroke={stroke} strokeWidth={strokeWidth} />
  }
  if (shape.type === 'cloud') {
    return <Path data={getCloudPath(shape.props.width, shape.props.height)} fill={fill} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} />
  }
  if (shape.type === 'line') {
    return <Line hitStrokeWidth={16} lineCap="round" points={[0, 0, shape.props.end.x, shape.props.end.y]} stroke={stroke} strokeWidth={strokeWidth} />
  }
  if (shape.type === 'arrow') {
    return (
      <>
        <Line hitStrokeWidth={16} lineCap="round" points={[0, 0, shape.props.end.x, shape.props.end.y]} stroke={stroke} strokeWidth={strokeWidth} />
        <Line closed fill={stroke} points={getArrowHeadPoints(shape.props.end, { x: 0, y: 0 }, Math.max(12, strokeWidth * 5))} />
      </>
    )
  }
  if (shape.type === 'stroke') {
    return <Path data={getFreehandPath(shape.props.points, strokeWidth * 2.2)} fill={stroke} hitStrokeWidth={16} opacity={opacity} />
  }
  if (shape.type === 'text') {
    return <Text fill={stroke} fontFamily="Inter, system-ui, sans-serif" fontSize={18} height={shape.props.height} text={shape.props.text} width={shape.props.width} />
  }
  if (shape.type === 'image') {
    return <Rect fill="rgba(102, 122, 144, 0.12)" height={shape.props.height} stroke={stroke} strokeWidth={strokeWidth} width={shape.props.width} />
  }
  return null
}

function SelectionBox({ shape, zoom }: { shape: CanvasShape; zoom: number }) {
  const rect = getLocalSelectionRect(shape)
  const handleSize = Math.max(5, 7 / zoom)
  return (
    <>
      <Rect dash={[5 / zoom, 4 / zoom]} height={rect.height} listening={false} stroke="#6b5cff" strokeWidth={1.2 / zoom} width={rect.width} x={rect.x} y={rect.y} />
      {[rect.x, rect.x + rect.width].flatMap((x) => [rect.y, rect.y + rect.height].map((y) => (
        <Rect
          fill="#ffffff"
          height={handleSize}
          key={`${x}-${y}`}
          listening={false}
          offsetX={handleSize / 2}
          offsetY={handleSize / 2}
          stroke="#6b5cff"
          strokeWidth={1 / zoom}
          width={handleSize}
          x={x}
          y={y}
        />
      )))}
    </>
  )
}

function getLocalSelectionRect(shape: CanvasShape) {
  if (shape.type === 'stroke') {
    return expandRect(boundsToLocalRect(getPointsBounds(shape.props.points as CanvasPoint[])), 6)
  }
  if (shape.type === 'line' || shape.type === 'arrow') {
    return expandRect(boundsToLocalRect(getPointsBounds([{ x: 0, y: 0 }, shape.props.end])), 6)
  }
  return { height: shape.props.height, width: shape.props.width, x: 0, y: 0 }
}

function boundsToLocalRect(bounds: { maxX: number; maxY: number; minX: number; minY: number }) {
  return {
    height: Math.max(1, bounds.maxY - bounds.minY),
    width: Math.max(1, bounds.maxX - bounds.minX),
    x: bounds.minX,
    y: bounds.minY,
  }
}

function expandRect(rect: { height: number; width: number; x: number; y: number }, padding: number) {
  return {
    height: rect.height + padding * 2,
    width: rect.width + padding * 2,
    x: rect.x - padding,
    y: rect.y - padding,
  }
}
