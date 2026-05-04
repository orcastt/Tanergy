import { useEffect, useMemo, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Rect, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { CanvasNodeShape } from '@/features/canvas-engine'
import type { JsonObject, NodeCardField, ResolvedNodePort } from '@/types/nodeRuntime'
import {
  getNodeDefinition,
  getPortColorName,
  getResolvedNodePorts,
} from '@/features/node-runtime/registry'
import {
  canRunNode,
  NodeCardFieldGrid,
  NodeCardImageSlots,
  NodeCardRunButton,
  NodeCardStatusBadge,
  NodeCardTextBox,
} from './KonvaNodeCardParts'

type KonvaNodeCardShapeProps = {
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onPortPointerDown?: (shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => void
  onRunToggle?: (shapeId: string) => void
  opacity: number
  shape: CanvasNodeShape
}

export function KonvaNodeCardShape({ onFieldChange, onPortPointerDown, onRunToggle, opacity, shape }: KonvaNodeCardShapeProps) {
  const [hoveredPort, setHoveredPort] = useState<ResolvedNodePort | null>(null)
  const [openFieldName, setOpenFieldName] = useState<string | null>(null)
  const definition = getNodeDefinition(shape.props.nodeType)
  const accent = definition.accentColor
  const title = getStringValue(shape.props.data.title) || definition.displayName
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const ports = getResolvedNodePorts(shape.props.nodeType, shape.props.data)
  const statusTone = getStatusTone(status)

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
      <Text
        fill="#0f172a"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={15}
        fontStyle="bold"
        height={22}
        text={title}
        width={shape.props.width - 116}
        x={14}
        y={16}
      />
      {canRunNode(shape) ? <NodeCardRunButton onRunToggle={onRunToggle} shape={shape} status={status} /> : <NodeCardStatusBadge shape={shape} status={status} tone={statusTone} />}
      <NodeBody
        accent={accent}
        fields={definition.cardFields}
        onFieldChange={onFieldChange}
        openFieldName={openFieldName}
        setOpenFieldName={setOpenFieldName}
        shape={shape}
      />
      {ports.map((port) => {
        const isInput = port.direction === 'in'
        const y = shape.props.height * port.anchorY
        return (
          <Group key={`${port.direction}:${port.id}`}>
            <Circle
              fill="rgba(255, 255, 255, 0.01)"
              onMouseEnter={() => setHoveredPort(port)}
              onMouseLeave={() => setHoveredPort(null)}
              onPointerDown={onPortPointerDown ? (event) => onPortPointerDown(shape.id, port.id, event) : undefined}
              radius={17}
              x={isInput ? 0 : shape.props.width}
              y={y}
            />
            <Circle
              fill={getPortColorName(port.dataType) === 'green' ? '#22c55e' : '#facc15'}
              onMouseEnter={() => setHoveredPort(port)}
              onMouseLeave={() => setHoveredPort(null)}
              onPointerDown={onPortPointerDown ? (event) => onPortPointerDown(shape.id, port.id, event) : undefined}
              radius={10}
              stroke="#ffffff"
              strokeWidth={2.5}
              x={isInput ? 0 : shape.props.width}
              y={y}
            />
          </Group>
        )
      })}
      {hoveredPort ? <PortTooltip port={hoveredPort} shape={shape} /> : null}
    </Group>
  )
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getStatusTone(status: string) {
  if (status === 'running') return { fill: '#eff6ff', stroke: '#bfdbfe', text: '#1d4ed8' }
  if (status === 'succeeded') return { fill: '#ecfdf5', stroke: '#bbf7d0', text: '#047857' }
  if (status === 'failed') return { fill: '#fef2f2', stroke: '#fecaca', text: '#b91c1c' }
  return { fill: '#f8fafc', stroke: '#e2e8f0', text: '#475569' }
}

function NodeBody({
  accent,
  fields,
  onFieldChange,
  openFieldName,
  setOpenFieldName,
  shape,
}: {
  accent: string
  fields: NodeCardField[]
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
}) {
  if (shape.props.nodeType === 'prompt') return <PromptBody shape={shape} />
  if (shape.props.nodeType === 'image') return <ImageBody accent={accent} shape={shape} />
  if (shape.props.nodeType === 'analysis') return <AnalysisBody shape={shape} />
  return <GenerationBody fields={fields} onFieldChange={onFieldChange} openFieldName={openFieldName} setOpenFieldName={setOpenFieldName} shape={shape} />
}

function PromptBody({ shape }: { shape: CanvasNodeShape }) {
  return <NodeCardTextBox height={shape.props.height - 78} text={getStringValue(shape.props.data.prompt) ?? ''} width={shape.props.width - 28} x={14} y={54} />
}

function AnalysisBody({ shape }: { shape: CanvasNodeShape }) {
  return (
    <>
      <NodeCardTextBox height={64} text={getStringValue(shape.props.data.analysisPrompt) ?? ''} width={shape.props.width - 28} x={14} y={58} />
      <Rect cornerRadius={10} fill="#f8fafc" height={shape.props.height - 142} width={shape.props.width - 28} x={14} y={132} />
      <Text fill="#94a3b8" fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text="Connect an image first." width={shape.props.width - 52} x={26} y={148} />
    </>
  )
}

function GenerationBody({ fields, onFieldChange, openFieldName, setOpenFieldName, shape }: {
  fields: NodeCardField[]
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
}) {
  const imageOutputs = shape.props.nodeType === 'image_gen_4' ? 4 : 1
  const slotY = 184
  const slotHeight = shape.props.nodeType === 'image_gen_4' ? 104 : 88
  return (
    <>
      <NodeCardImageSlots count={imageOutputs} height={slotHeight} shape={shape} y={slotY} />
      <Rect cornerRadius={8} fill="#fff1f2" height={28} width={shape.props.width - 28} x={14} y={shape.props.height - 44} />
      <Text fill="#a11222" fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text="Connect a prompt first." width={shape.props.width - 52} x={26} y={shape.props.height - 36} />
      <NodeCardFieldGrid fields={fields} onFieldChange={onFieldChange} openFieldName={openFieldName} setOpenFieldName={setOpenFieldName} shape={shape} y={54} />
    </>
  )
}

function ImageBody({ accent, shape }: { accent: string; shape: CanvasNodeShape }) {
  const bounds = { height: shape.props.height - 88, width: shape.props.width - 28, x: 14, y: 54 }
  const imageSource = getNodeImageSource(shape.props.data)
  return (
    <>
      <Rect cornerRadius={12} fill="#eef4fb" height={bounds.height} width={bounds.width} x={bounds.x} y={bounds.y} />
      <NodeImagePreview bounds={bounds} source={imageSource} />
      {imageSource ? null : (
        <>
          <Text align="center" fill="#ffffff" fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text="Image" width={70} x={shape.props.width / 2 - 35} y={bounds.y + bounds.height / 2 - 8} />
          <Text fill={accent} fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" text="Double-click / Drop" width={shape.props.width - 28} x={14} y={shape.props.height - 26} />
        </>
      )}
    </>
  )
}

function PortTooltip({ port, shape }: { port: ResolvedNodePort; shape: CanvasNodeShape }) {
  const text = port.dataType
  const width = text.length * 8 + 14
  const x = port.direction === 'in' ? 8 : shape.props.width - width - 8
  const y = shape.props.height * port.anchorY - 24
  return (
    <>
      <Rect cornerRadius={6} fill="#111827" height={22} width={width} x={x} y={y} />
      <Text align="center" fill="#ffffff" fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" height={22} text={text} verticalAlign="middle" width={width} x={x} y={y} />
    </>
  )
}

function NodeImagePreview({ bounds, source }: { bounds: { height: number; width: number; x: number; y: number }; source: string | null }) {
  const image = useLoadedNodeImage(source)
  const fit = useMemo(() => image ? getContainRect(image, bounds) : null, [bounds, image])
  return fit && image ? <KonvaImage image={image} {...fit} /> : null
}

function useLoadedNodeImage(src: string | null) {
  const [loadedImage, setLoadedImage] = useState<{ image: HTMLImageElement; src: string } | null>(null)
  useEffect(() => {
    if (!src) return
    let cancelled = false
    const nextImage = new window.Image()
    nextImage.decoding = 'async'
    if (src.startsWith('/') || src.startsWith(window.location.origin)) nextImage.crossOrigin = 'anonymous'
    nextImage.onload = () => { if (!cancelled) setLoadedImage({ image: nextImage, src }) }
    nextImage.onerror = () => { if (!cancelled) setLoadedImage(null) }
    nextImage.src = src
    return () => { cancelled = true }
  }, [src])
  return loadedImage?.src === src ? loadedImage.image : null
}

function getNodeImageSource(data: JsonObject) {
  return getStringValue(data.thumbnail512Url) ?? getStringValue(data.thumbnail1024Url) ?? getStringValue(data.originalUrl) ?? null
}

function getContainRect(image: HTMLImageElement, bounds: { height: number; width: number; x: number; y: number }) {
  const scale = Math.min(bounds.width / Math.max(1, image.naturalWidth), bounds.height / Math.max(1, image.naturalHeight))
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  return { height, width, x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2 }
}
