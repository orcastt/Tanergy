import { Circle, Group, Rect, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { CanvasNodeShape } from '@/features/canvas-engine'
import type { NodeCardField } from '@/types/nodeRuntime'
import {
  getNodeDefinition,
  getPortColorName,
  getResolvedNodePorts,
} from '@/features/node-runtime/registry'

type KonvaNodeCardShapeProps = {
  onPortPointerDown?: (shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => void
  opacity: number
  shape: CanvasNodeShape
}

export function KonvaNodeCardShape({ onPortPointerDown, opacity, shape }: KonvaNodeCardShapeProps) {
  const definition = getNodeDefinition(shape.props.nodeType)
  const accent = getNodeAccent(shape.props.nodeType)
  const title = getStringValue(shape.props.data.title) || definition.displayName
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const ports = getResolvedNodePorts(shape.props.nodeType, shape.props.data)
  const fieldLines = getFieldLines(definition.cardFields, shape)
  const summaryLines = getSummaryLines(shape, definition.outputSummary)
  const bodyText = [...fieldLines, ...summaryLines].slice(0, 7).join('\n')
  const statusTone = getStatusTone(status)
  const bodyHeight = shape.props.height - 100

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
        cornerRadius={12}
        fill={accent}
        height={10}
        opacity={0.9}
        width={shape.props.width}
      />
      <Text
        fill="#0f172a"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={15}
        fontStyle="bold"
        height={22}
        text={title}
        width={shape.props.width - 116}
        x={14}
        y={18}
      />
      <Rect
        cornerRadius={10}
        fill={statusTone.fill}
        height={20}
        stroke={statusTone.stroke}
        strokeWidth={1}
        width={82}
        x={shape.props.width - 96}
        y={17}
      />
      <Text
        align="center"
        fill={statusTone.text}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={10}
        fontStyle="bold"
        height={20}
        text={status.toUpperCase()}
        verticalAlign="middle"
        width={82}
        x={shape.props.width - 96}
        y={17}
      />
      <Text
        fill="#64748b"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={10}
        height={14}
        text={shape.props.nodeType.replaceAll('_', ' ')}
        width={shape.props.width - 28}
        x={14}
        y={42}
      />
      <Group clipFunc={(context) => roundedRectClip(context, 14, 66, shape.props.width - 28, shape.props.height - 92, 10)}>
        <Rect
          cornerRadius={10}
          fill="rgba(248, 250, 252, 0.96)"
          height={bodyHeight}
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth={1}
          width={shape.props.width - 28}
          x={14}
          y={66}
        />
        <Text
          fill="#334155"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={11}
          height={bodyHeight - 20}
          lineHeight={1.32}
          text={bodyText}
          width={shape.props.width - 52}
          x={26}
          y={76}
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
      {ports.map((port) => {
        const isInput = port.direction === 'in'
        const y = shape.props.height * port.anchorY
        return (
          <Group key={`${port.direction}:${port.id}`}>
            <Circle
              fill="rgba(255, 255, 255, 0.01)"
              onPointerDown={onPortPointerDown ? (event) => onPortPointerDown(shape.id, port.id, event) : undefined}
              radius={13}
              x={isInput ? 0 : shape.props.width}
              y={y}
            />
            <Circle
              fill={getPortColorName(port.dataType) === 'green' ? '#22c55e' : '#facc15'}
              onPointerDown={onPortPointerDown ? (event) => onPortPointerDown(shape.id, port.id, event) : undefined}
              radius={5}
              stroke="#ffffff"
              strokeWidth={2}
              x={isInput ? 0 : shape.props.width}
              y={y}
            />
            <Text
              align={isInput ? 'left' : 'right'}
              fill="#64748b"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={9}
              height={12}
              text={port.label}
              width={72}
              x={isInput ? 12 : shape.props.width - 84}
              y={y - 6}
            />
          </Group>
        )
      })}
    </Group>
  )
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getFieldLines(fields: NodeCardField[], shape: CanvasNodeShape) {
  return fields
    .map((field) => {
      const value = getDisplayValue(shape.props.data[field.name])
      return value ? `${field.label}: ${value}` : `${field.label}: -`
    })
}

function getSummaryLines(shape: CanvasNodeShape, outputSummary: string) {
  const resultCount = Array.isArray(shape.props.runtimeSummary.resultAssetIds)
    ? shape.props.runtimeSummary.resultAssetIds.length
    : 0
  const lines = [`Output: ${outputSummary}`]
  if (shape.props.runtimeSummary.costHint) lines.push(`Run: ${shape.props.runtimeSummary.costHint}`)
  if (resultCount > 0) lines.push(`Results: ${resultCount} asset${resultCount === 1 ? '' : 's'}`)
  if (shape.props.runtimeSummary.error) lines.push(`Error: ${shape.props.runtimeSummary.error}`)
  if (shape.props.nodeType === 'image') lines.push(getImageNodeSummary(shape))
  return lines.filter(Boolean)
}

function getImageNodeSummary(shape: CanvasNodeShape) {
  const assetId = getStringValue(shape.props.data.assetId)
  const width = typeof shape.props.data.imageWidth === 'number' ? shape.props.data.imageWidth : null
  const height = typeof shape.props.data.imageHeight === 'number' ? shape.props.data.imageHeight : null
  return [`Asset: ${assetId ?? 'No asset'}`, width && height ? `Size: ${width} x ${height}` : null].filter(Boolean).join('\n')
}

function getDisplayValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed.toLowerCase().startsWith('data:') || trimmed.toLowerCase().startsWith('blob:')) return ''
    return trimmed.length > 58 ? `${trimmed.slice(0, 55)}...` : trimmed
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function getNodeAccent(type: CanvasNodeShape['props']['nodeType']) {
  if (type === 'image') return '#f97316'
  if (type === 'analysis') return '#16a34a'
  if (type === 'prompt') return '#8b5cf6'
  return '#2563eb'
}

function getStatusTone(status: string) {
  if (status === 'running') return { fill: '#eff6ff', stroke: '#bfdbfe', text: '#1d4ed8' }
  if (status === 'succeeded') return { fill: '#ecfdf5', stroke: '#bbf7d0', text: '#047857' }
  if (status === 'failed') return { fill: '#fef2f2', stroke: '#fecaca', text: '#b91c1c' }
  return { fill: '#f8fafc', stroke: '#e2e8f0', text: '#475569' }
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
