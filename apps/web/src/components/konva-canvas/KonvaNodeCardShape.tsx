import { useMemo, useState } from 'react'
import { Circle, Group, Rect, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import type { NodeCardField, ResolvedNodePort } from '@/types/nodeRuntime'
import {
  getNodeDefinition,
  getPortColorName,
  getResolvedNodePorts,
} from '@/features/node-runtime/registry'
import { resolveRuntimeGraphNodeInputs } from '@/features/node-runtime/runtimeGraphResolution'
import { getRuntimeGraphGeneratedOutputRefs } from '@/features/node-runtime/runtimeGraphAssets'
import {
  canRunNode,
  NodeCardFieldGrid,
  NodeCardImageSlots,
  NodeCardRunButton,
  NodeCardStatusBadge,
  NodeCardTextBox,
  stopNodeCardControlEvent,
} from './KonvaNodeCardParts'
import { KonvaNodeChatBody } from './KonvaNodeChatBody'
import { getGeneratedOutputSource, getNodeImageCrop, getNodeImageSource, NodeImagePreview } from './KonvaNodeImagePreview'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'

type KonvaNodeCardShapeProps = {
  document: CanvasDocument
  editingFieldName?: KonvaNodeTextFieldName | null
  onChatClean?: (shapeId: string) => void
  onChatExportToggle?: (shapeId: string, messageId: string) => void
  onChatSend?: (shapeId: string, draftOverride?: string) => void
  onChatUpload?: (shapeId: string) => void
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onImageNodeToCanvas?: (shapeId: string) => void
  onPortPointerDown?: (shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => void
  onRunToggle?: (shapeId: string) => void
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  opacity: number
  previewMode?: boolean
  shape: CanvasNodeShape
  zoom: number
}

export function KonvaNodeCardShape({ document, editingFieldName = null, onChatClean, onChatExportToggle, onChatSend, onChatUpload, onFieldChange, onImageNodeToCanvas, onPortPointerDown, onRunToggle, onTextEditStart, opacity, previewMode = false, shape, zoom }: KonvaNodeCardShapeProps) {
  const [hoveredPort, setHoveredPort] = useState<ResolvedNodePort | null>(null)
  const [openFieldName, setOpenFieldName] = useState<string | null>(null)
  const definition = getNodeDefinition(shape.props.nodeType)
  const accent = definition.accentColor
  const title = shape.props.nodeType === 'image' ? 'Image' : getStringValue(shape.props.data.title) || definition.displayName
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const ports = getResolvedNodePorts(shape.props.nodeType, shape.props.data)
  if (previewMode || zoom <= 0.25) {
    return (
      <CompactNodeCard
        accent={accent}
        opacity={opacity}
        onPortPointerDown={onPortPointerDown}
        ports={ports}
        shape={shape}
        status={status}
        title={title}
      />
    )
  }
  const statusTone = getStatusTone(status)
  const contentScale = getNodeContentScale(shape, definition.defaultCardSize)
  const contentShape = getNodeContentShape(shape, contentScale)

  return (
    <Group opacity={opacity}>
      <Rect
        cornerRadius={12}
        fill="#ffffff"
        height={shape.props.height}
        perfectDrawEnabled={false}
        shadowBlur={zoom <= 0.5 ? 0 : 12}
        shadowColor="rgba(15, 23, 42, 0.14)"
        shadowOffsetY={4}
        stroke="rgba(15, 23, 42, 0.12)"
        strokeWidth={1}
        width={shape.props.width}
      />
      <Group clipHeight={shape.props.height} clipWidth={shape.props.width}>
        <Group scaleX={contentScale} scaleY={contentScale}>
          <Text
            fill="#0f172a"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={15}
            fontStyle="bold"
            height={22}
            text={title}
            width={contentShape.props.width - 116}
            x={14}
            y={16}
          />
          {contentShape.props.nodeType === 'image'
            ? <ImageNodeToCanvasButton onImageNodeToCanvas={onImageNodeToCanvas} shape={contentShape} />
            : contentShape.props.nodeType === 'chat'
              ? <ChatCleanButton onChatClean={onChatClean} shape={contentShape} />
            : canRunNode(contentShape)
              ? <NodeCardRunButton onRunToggle={onRunToggle} shape={contentShape} status={status} />
              : <NodeCardStatusBadge shape={contentShape} status={status} tone={statusTone} />}
          <NodeBody
            accent={accent}
            document={document}
            editingFieldName={editingFieldName}
            fields={definition.cardFields}
            onChatExportToggle={onChatExportToggle}
            onChatSend={onChatSend}
            onChatUpload={onChatUpload}
            onFieldChange={onFieldChange}
            onTextEditStart={onTextEditStart}
            openFieldName={openFieldName}
            setOpenFieldName={setOpenFieldName}
            shape={contentShape}
            zoom={zoom}
          />
        </Group>
      </Group>
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

function ChatCleanButton({ onChatClean, shape }: { onChatClean?: (shapeId: string) => void; shape: CanvasNodeShape }) {
  const width = 66
  const x = shape.props.width - width - 14
  const hasHistory = Array.isArray(shape.props.data.chatMessages) && shape.props.data.chatMessages.length > 0
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        if (hasHistory) onChatClean?.(shape.id)
      }}
      onDblClick={stopNodeCardControlEvent}
      onPointerDown={stopNodeCardControlEvent}
      opacity={hasHistory ? 1 : 0.42}
    >
      <Rect cornerRadius={8} fill="#f8fafc" height={24} stroke="#dce3ec" strokeWidth={1} width={width} x={x} y={12} />
      <Text align="center" fill="#475569" fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" height={24} text="Clean" verticalAlign="middle" width={width} x={x} y={12} />
    </Group>
  )
}

function CompactNodeCard({
  accent,
  opacity,
  onPortPointerDown,
  ports,
  shape,
  status,
  title,
}: {
  accent: string
  opacity: number
  onPortPointerDown?: (shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => void
  ports: ResolvedNodePort[]
  shape: CanvasNodeShape
  status: string
  title: string
}) {
  return (
    <Group opacity={opacity}>
      <Rect
        cornerRadius={10}
        fill="#ffffff"
        height={shape.props.height}
        perfectDrawEnabled={false}
        stroke="rgba(15, 23, 42, 0.16)"
        strokeWidth={1}
        width={shape.props.width}
      />
      <Rect cornerRadius={10} fill={accent} height={6} perfectDrawEnabled={false} width={shape.props.width} />
      <Text
        fill="#0f172a"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={Math.max(11, Math.min(15, shape.props.width / 18))}
        fontStyle="bold"
        height={24}
        text={title}
        width={Math.max(24, shape.props.width - 28)}
        x={14}
        y={16}
      />
      <Text
        fill="#64748b"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={10}
        fontStyle="bold"
        height={16}
        text={status.toUpperCase()}
        width={Math.max(24, shape.props.width - 28)}
        x={14}
        y={42}
      />
      {ports.map((port) => {
        const isInput = port.direction === 'in'
        const y = shape.props.height * port.anchorY
        return (
          <Circle
            fill={getPortColorName(port.dataType) === 'green' ? '#22c55e' : '#facc15'}
            key={`${port.direction}:${port.id}`}
            onPointerDown={onPortPointerDown ? (event) => onPortPointerDown(shape.id, port.id, event) : undefined}
            radius={8}
            stroke="#ffffff"
            strokeWidth={2}
            x={isInput ? 0 : shape.props.width}
            y={y}
          />
        )
      })}
    </Group>
  )
}

function getNodeContentScale(shape: CanvasNodeShape, defaultSize: { height: number; width: number }) {
  const scale = Math.min(
    1,
    shape.props.width / Math.max(1, defaultSize.width),
    shape.props.height / Math.max(1, defaultSize.height)
  )
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function getNodeContentShape(shape: CanvasNodeShape, scale: number): CanvasNodeShape {
  if (scale >= 1) return shape
  return {
    ...shape,
    props: {
      ...shape.props,
      height: shape.props.height / scale,
      width: shape.props.width / scale,
    },
  }
}

function ImageNodeToCanvasButton({ onImageNodeToCanvas, shape }: { onImageNodeToCanvas?: (shapeId: string) => void; shape: CanvasNodeShape }) {
  const width = 92
  const x = shape.props.width - width - 14
  const hasImage = typeof shape.props.data.assetId === 'string' && !shape.props.data.assetId.startsWith('input:')
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        if (hasImage) onImageNodeToCanvas?.(shape.id)
      }}
      onDblClick={stopNodeCardControlEvent}
      onPointerDown={stopNodeCardControlEvent}
      opacity={hasImage ? 1 : 0.42}
    >
      <Rect cornerRadius={10} fill="#111827" height={24} width={width} x={x} y={12} />
      <Text align="center" fill="#ffffff" fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" height={24} text="To Canvas" verticalAlign="middle" width={width} x={x} y={12} />
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
  document,
  editingFieldName,
  fields,
  onChatExportToggle,
  onChatSend,
  onChatUpload,
  onFieldChange,
  onTextEditStart,
  openFieldName,
  setOpenFieldName,
  shape,
  zoom,
}: {
  accent: string
  document: CanvasDocument
  editingFieldName?: KonvaNodeTextFieldName | null
  fields: NodeCardField[]
  onChatExportToggle?: (shapeId: string, messageId: string) => void
  onChatSend?: (shapeId: string, draftOverride?: string) => void
  onChatUpload?: (shapeId: string) => void
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
  zoom: number
}) {
  if (shape.props.nodeType === 'prompt') return <PromptBody document={document} editing={editingFieldName === 'prompt'} onTextEditStart={onTextEditStart} shape={shape} />
  if (shape.props.nodeType === 'chat') return <KonvaNodeChatBody document={document} editingFieldName={editingFieldName} onChatExportToggle={onChatExportToggle} onChatSend={onChatSend} onChatUpload={onChatUpload} onTextEditStart={onTextEditStart} shape={shape} zoom={zoom} />
  if (shape.props.nodeType === 'image') return <ImageBody accent={accent} shape={shape} zoom={zoom} />
  if (shape.props.nodeType === 'analysis') return <AnalysisBody editing={editingFieldName === 'analysisPrompt'} onTextEditStart={onTextEditStart} shape={shape} />
  return <GenerationBody fields={fields} onFieldChange={onFieldChange} openFieldName={openFieldName} setOpenFieldName={setOpenFieldName} shape={shape} zoom={zoom} />
}

function PromptBody({
  document,
  editing,
  onTextEditStart,
  shape,
}: {
  document: CanvasDocument
  editing: boolean
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  shape: CanvasNodeShape
}) {
  const inputResolution = useMemo(() => resolveRuntimeGraphNodeInputs(document, shape), [document, shape])
  const inheritedText = inputResolution.textValues.join('\n\n').trim()
  const localText = getStringValue(shape.props.data.prompt) ?? ''
  return <NodeCardTextBox height={shape.props.height - 78} onEdit={() => onTextEditStart?.(shape.id, 'prompt')} text={editing ? '' : inheritedText || localText} width={shape.props.width - 28} x={14} y={54} />
}

function AnalysisBody({ editing, onTextEditStart, shape }: { editing: boolean; onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void; shape: CanvasNodeShape }) {
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const error = getStringValue(shape.props.runtimeSummary.error)
  const textOutput = getStringValue(shape.props.runtimeSummary.textOutput)
  const outputText = status === 'succeeded' && textOutput
    ? textOutput
    : error ?? 'Connect an image first.'
  return (
    <>
      <NodeCardTextBox height={64} onEdit={() => onTextEditStart?.(shape.id, 'analysisPrompt')} text={editing ? '' : getStringValue(shape.props.data.analysisPrompt) ?? ''} width={shape.props.width - 28} x={14} y={58} />
      <NodeCardTextBox height={shape.props.height - 142} text={outputText} width={shape.props.width - 28} x={14} y={132} />
    </>
  )
}

function GenerationBody({ fields, onFieldChange, openFieldName, setOpenFieldName, shape, zoom }: {
  fields: NodeCardField[]
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
  zoom: number
}) {
  const imageOutputs = shape.props.nodeType === 'image_gen_4' ? 4 : 1
  const slotY = 184
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const error = getStringValue(shape.props.runtimeSummary.error)
  const footerReserve = status === 'succeeded' ? 24 : 64
  const slotHeight = Math.max(shape.props.nodeType === 'image_gen_4' ? 104 : 88, shape.props.height - slotY - footerReserve)
  return (
    <>
      <NodeCardImageSlots count={imageOutputs} height={slotHeight} shape={shape} y={slotY} />
      <GeneratedOutputPreviews count={imageOutputs} height={slotHeight} shape={shape} y={slotY} zoom={zoom} />
      {status === 'succeeded' ? null : (
        <>
          <Rect cornerRadius={8} fill={status === 'failed' ? '#fff1f2' : '#f8fafc'} height={28} width={shape.props.width - 28} x={14} y={shape.props.height - 44} />
          <Text fill={status === 'failed' ? '#a11222' : '#64748b'} fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text={error ?? 'Ready when prompt is connected.'} width={shape.props.width - 52} x={26} y={shape.props.height - 36} />
        </>
      )}
      <NodeCardFieldGrid fields={fields} onFieldChange={onFieldChange} openFieldName={openFieldName} setOpenFieldName={setOpenFieldName} shape={shape} y={54} />
    </>
  )
}

function ImageBody({ accent, shape, zoom }: { accent: string; shape: CanvasNodeShape; zoom: number }) {
  const bounds = { height: shape.props.height - 88, width: shape.props.width - 28, x: 14, y: 54 }
  const imageCrop = getNodeImageCrop(shape.props.data)
  const imageSource = getNodeImageSource(shape.props.data, zoom)
  return (
    <>
      <Rect cornerRadius={12} fill="#eef4fb" height={bounds.height} width={bounds.width} x={bounds.x} y={bounds.y} />
      <NodeImagePreview bounds={bounds} crop={imageCrop} source={imageSource} />
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

function GeneratedOutputPreviews({ count, height, shape, y, zoom }: { count: number; height: number; shape: CanvasNodeShape; y: number; zoom: number }) {
  const refs = getRuntimeGraphGeneratedOutputRefs(shape.props.data)
  const slotWidth = count === 4 ? (shape.props.width - 38) / 2 : shape.props.width - 28
  const slotHeight = count === 4 ? (height - 8) / 2 : height
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const ref = refs[index]
        const bounds = {
          height: slotHeight,
          width: slotWidth,
          x: 14 + (index % 2) * (slotWidth + 10),
          y: y + Math.floor(index / 2) * (slotHeight + 8),
        }
        return ref ? <NodeImagePreview bounds={bounds} key={index} source={getGeneratedOutputSource(ref, zoom)} /> : null
      })}
    </>
  )
}
