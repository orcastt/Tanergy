import { Circle, Group, Rect, Text } from 'react-konva'
import type { CanvasNodeShape } from '@/features/canvas-engine'
import { getPortColorName, getResolvedNodePorts } from '@/features/node-runtime/registry'

type KonvaNodeCardShapeProps = {
  opacity: number
  shape: CanvasNodeShape
}

export function KonvaNodeCardShape({ opacity, shape }: KonvaNodeCardShapeProps) {
  const accent = getNodeAccent(shape.props.nodeType)
  const title = getStringValue(shape.props.data.title) || getNodeTitle(shape.props.nodeType)
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const ports = getResolvedNodePorts(shape.props.nodeType, shape.props.data)

  return (
    <Group opacity={opacity}>
      <Rect
        cornerRadius={12}
        fill="#ffffff"
        height={shape.props.height}
        shadowBlur={12}
        shadowColor="rgba(15, 23, 42, 0.14)"
        shadowOffsetY={4}
        stroke="rgba(15, 23, 42, 0.12)"
        strokeWidth={1}
        width={shape.props.width}
      />
      <Rect
        cornerRadius={[12, 12, 0, 0]}
        fill={accent}
        height={8}
        opacity={0.9}
        width={shape.props.width}
      />
      <Text
        fill="#0f172a"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={15}
        fontStyle="700"
        height={22}
        text={title}
        width={shape.props.width - 28}
        x={14}
        y={18}
      />
      <Text
        align="right"
        fill="#64748b"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={10}
        fontStyle="700"
        text={status.toUpperCase()}
        width={shape.props.width - 28}
        x={14}
        y={42}
      />
      <Group clipFunc={(context) => roundedRectClip(context, 14, 66, shape.props.width - 28, shape.props.height - 92, 10)}>
        <Rect
          cornerRadius={10}
          fill="rgba(248, 250, 252, 0.96)"
          height={shape.props.height - 92}
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth={1}
          width={shape.props.width - 28}
          x={14}
          y={66}
        />
        <Text
          align="center"
          fill="#64748b"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={12}
          height={shape.props.height - 92}
          text={getImageNodeSummary(shape)}
          verticalAlign="middle"
          width={shape.props.width - 28}
          x={14}
          y={66}
        />
      </Group>
      <Text
        fill="#64748b"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={10}
        text={shape.props.nodeId}
        width={shape.props.width - 28}
        x={14}
        y={shape.props.height - 20}
      />
      {ports.map((port) => (
        <Circle
          fill={getPortColorName(port.dataType) === 'green' ? '#22c55e' : '#facc15'}
          key={`${port.direction}:${port.id}`}
          radius={5}
          stroke="#ffffff"
          strokeWidth={2}
          x={port.direction === 'in' ? 0 : shape.props.width}
          y={shape.props.height * port.anchorY}
        />
      ))}
    </Group>
  )
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getImageNodeSummary(shape: CanvasNodeShape) {
  if (shape.props.nodeType !== 'image') return shape.props.runtimeSummary.costHint ?? 'Node controls'
  const assetId = getStringValue(shape.props.data.assetId)
  const width = typeof shape.props.data.imageWidth === 'number' ? shape.props.data.imageWidth : null
  const height = typeof shape.props.data.imageHeight === 'number' ? shape.props.data.imageHeight : null
  return [assetId ?? 'No asset', width && height ? `${width} x ${height}` : null].filter(Boolean).join('\n')
}

function getNodeTitle(type: CanvasNodeShape['props']['nodeType']) {
  if (type === 'image') return 'Image'
  if (type === 'image_gen') return 'Image Gen'
  if (type === 'image_gen_4') return 'Image Gen 4'
  if (type === 'analysis') return 'Analysis'
  return 'Prompt'
}

function getNodeAccent(type: CanvasNodeShape['props']['nodeType']) {
  if (type === 'image') return '#f97316'
  if (type === 'analysis') return '#16a34a'
  if (type === 'prompt') return '#8b5cf6'
  return '#2563eb'
}

type ClipContext = Pick<CanvasRenderingContext2D,
  | 'beginPath'
  | 'closePath'
  | 'lineTo'
  | 'moveTo'
  | 'quadraticCurveTo'
>

function roundedRectClip(context: ClipContext, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}
