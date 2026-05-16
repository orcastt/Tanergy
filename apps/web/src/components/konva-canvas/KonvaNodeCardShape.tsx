import { useEffect, useMemo, useState } from 'react'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import { getCanvasThemePalette, useResolvedCanvasThemeMode, type ResolvedCanvasTheme } from '@/features/canvas-settings/canvasTheme'
import type { NodeCardField, ResolvedNodePort } from '@/types/nodeRuntime'
import {
  getNodeDefinition,
  getNodeCardFields,
  getNormalizedNodeData,
  getPortColorName,
  getResolvedNodePorts,
} from '@/features/node-runtime/registry'
import { resolveRuntimeGraphNodeInputs } from '@/features/node-runtime/runtimeGraphResolution'
import {
  getRuntimeGraphGeneratedOutputBatches,
  getRuntimeGraphGeneratedOutputRefs,
  getRuntimeGraphImageAssetRef,
  type RuntimeGraphImageAssetRef,
} from '@/features/node-runtime/runtimeGraphAssets'
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
import { getNodeCardImageSlotBounds } from './konvaNodeCardImageLayout'

type KonvaNodeCardShapeProps = {
  document: CanvasDocument
  editingFieldName?: KonvaNodeTextFieldName | null
  onChatClean?: (shapeId: string) => void
  onChatModelChange?: (shapeId: string, modelId: string) => void
  onChatRegenerate?: (shapeId: string, messageId: string) => void
  onChatSend?: (shapeId: string, draftOverride?: string) => void
  onChatUpload?: (shapeId: string) => void
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onFocusedEditRequest?: (shapeId: string, source: 'chat-model-menu' | 'field-dropdown') => boolean
  onFocusedEditStateChange?: (
    shapeId: string,
    source: 'chat-model-menu' | 'field-dropdown',
    active: boolean,
  ) => void
  onGeneratedImageToCanvas?: (input: { ref: RuntimeGraphImageAssetRef; shapeId: string }) => void
  onImageNodeToCanvas?: (shapeId: string) => void
  onImagePreviewOpen?: (input: { batches: RuntimeGraphImageAssetRef[][]; selectedBatchIndex?: number; selectedIndex?: number; title: string }) => void
  onPortPointerDown?: (shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => void
  onRunToggle?: (shapeId: string) => void
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  opacity: number
  previewMode?: boolean
  shape: CanvasNodeShape
  zoom: number
}

export function KonvaNodeCardShape({ document, editingFieldName = null, onChatClean, onChatModelChange, onChatRegenerate, onChatSend, onChatUpload, onFieldChange, onFocusedEditRequest, onFocusedEditStateChange, onGeneratedImageToCanvas, onImageNodeToCanvas, onImagePreviewOpen, onPortPointerDown, onRunToggle, onTextEditStart, opacity, previewMode = false, shape, zoom }: KonvaNodeCardShapeProps) {
  const [hoveredPort, setHoveredPort] = useState<ResolvedNodePort | null>(null)
  const [openFieldName, setOpenFieldName] = useState<string | null>(null)
  const definition = getNodeDefinition(shape.props.nodeType)
  const themeMode = useResolvedCanvasThemeMode()
  const palette = getCanvasThemePalette(themeMode)
  const nodeStrokeWidth = themeMode === 'dark' ? 1.25 : 1
  const accent = definition.accentColor
  const normalizedData = getNormalizedNodeData(shape.props.nodeType, shape.props.data)
  const cardFields = getNodeCardFields(shape.props.nodeType, normalizedData)
  const title = shape.props.nodeType === 'image' ? 'Image' : getStringValue(shape.props.data.title) || definition.displayName
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const ports = getResolvedNodePorts(shape.props.nodeType, shape.props.data)

  useEffect(() => {
    onFocusedEditStateChange?.(shape.id, 'field-dropdown', openFieldName !== null)
  }, [onFocusedEditStateChange, openFieldName, shape.id])
  useEffect(() => () => {
    onFocusedEditStateChange?.(shape.id, 'field-dropdown', false)
  }, [onFocusedEditStateChange, shape.id])

  if (previewMode || zoom <= 0.25) {
    return (
      <CompactNodeCard
        accent={accent}
        opacity={opacity}
        onPortPointerDown={onPortPointerDown}
        ports={ports}
        shape={shape}
        status={status}
        themeMode={themeMode}
        title={title}
      />
    )
  }
  const statusTone = getStatusTone(status, themeMode)
  const contentScale = getNodeContentScale(shape, definition.defaultCardSize)
  const contentShape = getNodeContentShape(shape, contentScale)

  return (
    <Group opacity={opacity}>
      <Rect
        cornerRadius={12}
        fill={palette.nodeBg}
        height={shape.props.height}
        perfectDrawEnabled={false}
        shadowBlur={zoom <= 0.5 ? 0 : 12}
        shadowColor={palette.nodeShadow}
        shadowOffsetY={4}
        stroke={palette.nodeStroke}
        strokeWidth={nodeStrokeWidth}
        width={shape.props.width}
      />
      <Group>
        <Group scaleX={contentScale} scaleY={contentScale}>
          <Text
            fill={palette.nodeTitle}
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
            : contentShape.props.nodeType === 'prompt'
              ? null
            : canRunNode(contentShape)
              ? <NodeCardRunButton onRunToggle={onRunToggle} shape={contentShape} status={status} />
              : <NodeCardStatusBadge shape={contentShape} status={status} tone={statusTone} />}
          <NodeBody
            accent={accent}
            document={document}
            editingFieldName={editingFieldName}
            fields={cardFields}
            normalizedData={normalizedData}
            onChatModelChange={onChatModelChange}
            onChatRegenerate={onChatRegenerate}
            onChatSend={onChatSend}
            onChatUpload={onChatUpload}
            onFieldChange={onFieldChange}
            onFocusedEditRequest={onFocusedEditRequest}
            onFocusedEditStateChange={onFocusedEditStateChange}
            onGeneratedImageToCanvas={onGeneratedImageToCanvas}
            onImagePreviewOpen={onImagePreviewOpen}
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
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
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
      <Rect cornerRadius={8} fill={palette.fieldBg} height={24} stroke={palette.fieldStroke} strokeWidth={1} width={width} x={x} y={12} />
      <Text align="center" fill={palette.mutedText} fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" height={24} text="Clean" verticalAlign="middle" width={width} x={x} y={12} />
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
  themeMode,
  title,
}: {
  accent: string
  opacity: number
  onPortPointerDown?: (shapeId: string, portId: string, event: KonvaEventObject<PointerEvent>) => void
  ports: ResolvedNodePort[]
  shape: CanvasNodeShape
  status: string
  themeMode: ResolvedCanvasTheme
  title: string
}) {
  const palette = getCanvasThemePalette(themeMode)
  const nodeStrokeWidth = themeMode === 'dark' ? 1.25 : 1
  return (
    <Group opacity={opacity}>
      <Rect
        cornerRadius={10}
        fill={palette.nodeBg}
        height={shape.props.height}
        perfectDrawEnabled={false}
        stroke={palette.nodeStroke}
        strokeWidth={nodeStrokeWidth}
        width={shape.props.width}
      />
      <Rect cornerRadius={10} fill={accent} height={6} perfectDrawEnabled={false} width={shape.props.width} />
      <Text
        fill={palette.nodeTitle}
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
        fill={palette.compactStatus}
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
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
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
      <Rect cornerRadius={10} fill={palette.actionBg} height={24} width={width} x={x} y={12} />
      <Text align="center" fill={palette.actionText} fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" height={24} text="To Canvas" verticalAlign="middle" width={width} x={x} y={12} />
    </Group>
  )
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getStatusTone(status: string, themeMode: ResolvedCanvasTheme) {
  if (status === 'running') return { fill: '#eff6ff', stroke: '#bfdbfe', text: '#1d4ed8' }
  if (status === 'succeeded') return { fill: '#ecfdf5', stroke: '#bbf7d0', text: '#047857' }
  if (status === 'failed') return { fill: '#fef2f2', stroke: '#fecaca', text: '#b91c1c' }
  if (themeMode === 'dark') return { fill: '#172031', stroke: 'rgba(148, 163, 184, 0.28)', text: '#cbd5e1' }
  return { fill: '#f8fafc', stroke: '#e2e8f0', text: '#475569' }
}

function NodeBody({
  accent,
  document,
  editingFieldName,
  fields,
  normalizedData,
  onChatModelChange,
  onChatRegenerate,
  onChatSend,
  onChatUpload,
  onFieldChange,
  onFocusedEditRequest,
  onFocusedEditStateChange,
  onGeneratedImageToCanvas,
  onImagePreviewOpen,
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
  normalizedData: CanvasNodeShape['props']['data']
  onChatModelChange?: (shapeId: string, modelId: string) => void
  onChatRegenerate?: (shapeId: string, messageId: string) => void
  onChatSend?: (shapeId: string, draftOverride?: string) => void
  onChatUpload?: (shapeId: string) => void
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onFocusedEditRequest?: (shapeId: string, source: 'chat-model-menu' | 'field-dropdown') => boolean
  onFocusedEditStateChange?: (
    shapeId: string,
    source: 'chat-model-menu' | 'field-dropdown',
    active: boolean,
  ) => void
  onGeneratedImageToCanvas?: (input: { ref: RuntimeGraphImageAssetRef; shapeId: string }) => void
  onImagePreviewOpen?: (input: { batches: RuntimeGraphImageAssetRef[][]; selectedBatchIndex?: number; selectedIndex?: number; title: string }) => void
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
  zoom: number
}) {
  if (shape.props.nodeType === 'prompt') return <PromptBody document={document} editing={editingFieldName === 'prompt'} onTextEditStart={onTextEditStart} shape={shape} />
  if (shape.props.nodeType === 'prompt_optimizer') {
    return (
      <PromptOptimizerBody
        document={document}
        fields={fields}
        normalizedData={normalizedData}
        onFieldChange={onFieldChange}
        onFieldOpenRequest={onFocusedEditRequest ? () => onFocusedEditRequest(shape.id, 'field-dropdown') : undefined}
        openFieldName={openFieldName}
        setOpenFieldName={setOpenFieldName}
        shape={shape}
      />
    )
  }
  if (shape.props.nodeType === 'chat') return <KonvaNodeChatBody document={document} editingFieldName={editingFieldName} onChatModelChange={onChatModelChange} onChatRegenerate={onChatRegenerate} onChatSend={onChatSend} onChatUpload={onChatUpload} onFocusedEditRequest={onFocusedEditRequest} onFocusedEditStateChange={onFocusedEditStateChange} onTextEditStart={onTextEditStart} shape={shape} zoom={zoom} />
  if (shape.props.nodeType === 'image') return <ImageBody accent={accent} onImagePreviewOpen={onImagePreviewOpen} shape={shape} zoom={zoom} />
  if (shape.props.nodeType === 'analysis') {
    return (
      <AnalysisBody
        editing={editingFieldName === 'analysisPrompt'}
        fields={fields}
        normalizedData={normalizedData}
        onFieldChange={onFieldChange}
        onFieldOpenRequest={onFocusedEditRequest ? () => onFocusedEditRequest(shape.id, 'field-dropdown') : undefined}
        onTextEditStart={onTextEditStart}
        openFieldName={openFieldName}
        setOpenFieldName={setOpenFieldName}
        shape={shape}
      />
    )
  }
  return <GenerationBody fields={fields} normalizedData={normalizedData} onFieldChange={onFieldChange} onFieldOpenRequest={onFocusedEditRequest ? () => onFocusedEditRequest(shape.id, 'field-dropdown') : undefined} onGeneratedImageToCanvas={onGeneratedImageToCanvas} onImagePreviewOpen={onImagePreviewOpen} openFieldName={openFieldName} setOpenFieldName={setOpenFieldName} shape={shape} zoom={zoom} />
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

function PromptOptimizerBody({
  document,
  fields,
  normalizedData,
  onFieldChange,
  onFieldOpenRequest,
  openFieldName,
  setOpenFieldName,
  shape,
}: {
  document: CanvasDocument
  fields: NodeCardField[]
  normalizedData: CanvasNodeShape['props']['data']
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onFieldOpenRequest?: () => boolean
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const displayShape = shape.props.data === normalizedData
    ? shape
    : {
        ...shape,
        props: {
          ...shape.props,
          data: normalizedData,
        },
      }
  const inputResolution = useMemo(() => resolveRuntimeGraphNodeInputs(document, shape), [document, shape])
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const error = getStringValue(shape.props.runtimeSummary.error)
  const optimizedPrompt = getStringValue(shape.props.runtimeSummary.textOutput) || getStringValue(shape.props.data.optimizedPrompt) || ''
  const previewText = optimizedPrompt || (status === 'running'
    ? 'Generating...'
    : error ?? (inputResolution.canRun ? 'Ready to optimize.' : inputResolution.missingReasons[0] ?? 'Connect a prompt first.'))
  return (
    <>
      <Text fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={13} fontStyle="bold" text="Optimized preview" width={shape.props.width - 28} x={14} y={116} />
      <NodeCardTextBox height={shape.props.height - 156} text={previewText} width={shape.props.width - 28} x={14} y={142} />
      <NodeCardFieldGrid fields={fields} onFieldChange={onFieldChange} onFieldOpenRequest={onFieldOpenRequest} openFieldName={openFieldName} setOpenFieldName={setOpenFieldName} shape={displayShape} y={54} />
    </>
  )
}

function AnalysisBody({
  editing,
  fields,
  normalizedData,
  onFieldChange,
  onFieldOpenRequest,
  onTextEditStart,
  openFieldName,
  setOpenFieldName,
  shape,
}: {
  editing: boolean
  fields: NodeCardField[]
  normalizedData: CanvasNodeShape['props']['data']
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onFieldOpenRequest?: () => boolean
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
}) {
  const displayShape = shape.props.data === normalizedData
    ? shape
    : {
        ...shape,
        props: {
          ...shape.props,
          data: normalizedData,
        },
      }
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const error = getStringValue(shape.props.runtimeSummary.error)
  const textOutput = getStringValue(shape.props.runtimeSummary.textOutput)
  const outputText = status === 'succeeded' && textOutput
    ? textOutput
    : error ?? 'Connect an image first.'
  return (
    <>
      <NodeCardTextBox height={64} onEdit={() => onTextEditStart?.(shape.id, 'analysisPrompt')} text={editing ? '' : getStringValue(displayShape.props.data.analysisPrompt) ?? ''} width={shape.props.width - 28} x={14} y={116} />
      <NodeCardTextBox height={shape.props.height - 208} text={outputText} width={shape.props.width - 28} x={14} y={190} />
      <NodeCardFieldGrid fields={fields} onFieldChange={onFieldChange} onFieldOpenRequest={onFieldOpenRequest} openFieldName={openFieldName} setOpenFieldName={setOpenFieldName} shape={displayShape} y={54} />
    </>
  )
}

function GenerationBody({ fields, normalizedData, onFieldChange, onFieldOpenRequest, onGeneratedImageToCanvas, onImagePreviewOpen, openFieldName, setOpenFieldName, shape, zoom }: {
  fields: NodeCardField[]
  normalizedData: CanvasNodeShape['props']['data']
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  onFieldOpenRequest?: () => boolean
  onGeneratedImageToCanvas?: (input: { ref: RuntimeGraphImageAssetRef; shapeId: string }) => void
  onImagePreviewOpen?: (input: { batches: RuntimeGraphImageAssetRef[][]; selectedBatchIndex?: number; selectedIndex?: number; title: string }) => void
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
  zoom: number
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const displayShape = shape.props.data === normalizedData
    ? shape
    : {
        ...shape,
        props: {
          ...shape.props,
          data: normalizedData,
        },
      }
  const imageOutputs = shape.props.nodeType === 'image_gen_4' ? 4 : 1
  const slotY = 184
  const status = getStringValue(shape.props.runtimeSummary.status) || 'idle'
  const error = getStringValue(shape.props.runtimeSummary.error)
  const progress = useEstimatedGenerationProgress(shape.props.runtimeSummary)
  const footerReserve = status === 'running' ? 74 : status === 'succeeded' ? 24 : 64
  const warningFooter = status === 'succeeded' && error ? 48 : 0
  const resolvedFooterReserve = footerReserve + warningFooter
  const slotHeight = Math.max(shape.props.nodeType === 'image_gen_4' ? 104 : 88, shape.props.height - slotY - resolvedFooterReserve)
  const outputRefs = getRuntimeGraphGeneratedOutputRefs(shape.props.data)
  const slotBounds = useMemo(() => (
    Array.from({ length: imageOutputs }, (_, index) => getNodeCardImageSlotBounds({
      count: imageOutputs,
      height: slotHeight,
      imageRef: outputRefs[index] ?? null,
      shape,
      slotIndex: index,
      y: slotY,
    }))
  ), [imageOutputs, outputRefs, shape, slotHeight, slotY])
  return (
    <>
      <NodeCardImageSlots slotBounds={slotBounds} />
      <GeneratedOutputPreviews onGeneratedImageToCanvas={onGeneratedImageToCanvas} onImagePreviewOpen={onImagePreviewOpen} refs={outputRefs} shape={shape} slotBounds={slotBounds} zoom={zoom} />
      {status === 'succeeded' ? error ? (
        <>
          <Rect cornerRadius={8} fill="#fffbeb" height={28} width={shape.props.width - 28} x={14} y={shape.props.height - 44} />
          <Text fill="#b45309" fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text={error} width={shape.props.width - 52} x={26} y={shape.props.height - 36} />
        </>
      ) : null : status === 'running' ? (
        <GenerationProgressFooter progress={progress} shape={shape} />
      ) : (
        <>
          <Rect cornerRadius={8} fill={status === 'failed' ? '#fff1f2' : palette.fieldBg} height={28} width={shape.props.width - 28} x={14} y={shape.props.height - 44} />
          <Text fill={status === 'failed' ? '#a11222' : palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text={error ?? 'Ready when prompt is connected.'} width={shape.props.width - 52} x={26} y={shape.props.height - 36} />
        </>
      )}
      <NodeCardFieldGrid fields={fields} onFieldChange={onFieldChange} onFieldOpenRequest={onFieldOpenRequest} openFieldName={openFieldName} setOpenFieldName={setOpenFieldName} shape={displayShape} y={54} />
    </>
  )
}

function ImageBody({ accent, onImagePreviewOpen, shape, zoom }: { accent: string; onImagePreviewOpen?: (input: { batches: RuntimeGraphImageAssetRef[][]; selectedBatchIndex?: number; selectedIndex?: number; title: string }) => void; shape: CanvasNodeShape; zoom: number }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const bounds = { height: shape.props.height - 88, width: shape.props.width - 28, x: 14, y: 54 }
  const imageCrop = getNodeImageCrop(shape.props.data)
  const imageSource = getNodeImageSource(shape.props.data, zoom)
  const imageRef = getRuntimeGraphImageAssetRef(shape.props.data)
  const canUpload = !hasUpstreamImageInput(shape)
  return (
    <>
      <Rect cornerRadius={12} fill={palette.imageEmptyBg} height={bounds.height} width={bounds.width} x={bounds.x} y={bounds.y} />
      <NodeImagePreview
        bounds={bounds}
        crop={imageCrop}
        onDoubleClick={imageRef ? () => onImagePreviewOpen?.({ batches: [[imageRef]], selectedBatchIndex: 0, selectedIndex: 0, title: getStringValue(shape.props.data.title) || 'Image' }) : undefined}
        source={imageSource}
      />
      {imageSource ? null : (
        <>
          <Text align="center" fill="#ffffff" fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text="Image" width={70} x={shape.props.width / 2 - 35} y={bounds.y + bounds.height / 2 - 8} />
          {canUpload ? (
            <Text fill={accent} fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" text="Double-click / Drop" width={shape.props.width - 28} x={14} y={shape.props.height - 26} />
          ) : null}
        </>
      )}
    </>
  )
}

function hasUpstreamImageInput(shape: CanvasNodeShape) {
  return typeof shape.props.data.inputSourceEdgeId === 'string' && shape.props.data.inputSourceEdgeId.length > 0
}

function PortTooltip({ port, shape }: { port: ResolvedNodePort; shape: CanvasNodeShape }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const text = port.dataType
  const width = text.length * 8 + 14
  const x = port.direction === 'in' ? 8 : shape.props.width - width - 8
  const y = shape.props.height * port.anchorY - 24
  return (
    <>
      <Rect cornerRadius={6} fill={palette.actionBg} height={22} width={width} x={x} y={y} />
      <Text align="center" fill={palette.actionText} fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" height={22} text={text} verticalAlign="middle" width={width} x={x} y={y} />
    </>
  )
}

function GeneratedOutputPreviews({
  onGeneratedImageToCanvas,
  onImagePreviewOpen,
  refs,
  shape,
  slotBounds,
  zoom,
}: {
  onGeneratedImageToCanvas?: (input: { ref: RuntimeGraphImageAssetRef; shapeId: string }) => void
  onImagePreviewOpen?: (input: { batches: RuntimeGraphImageAssetRef[][]; selectedBatchIndex?: number; selectedIndex?: number; title: string }) => void
  refs: ReturnType<typeof getRuntimeGraphGeneratedOutputRefs>
  shape: CanvasNodeShape
  slotBounds: ReturnType<typeof getNodeCardImageSlotBounds>[]
  zoom: number
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const slotCount = shape.props.nodeType === 'image_gen_4' ? 4 : 1
  const batches = getRuntimeGraphGeneratedOutputBatches(shape.props.data, slotCount)
  const openPreview = (ref: RuntimeGraphImageAssetRef, index: number) => {
    const currentBatch = batches[0] ?? [ref]
    const selectedIndex = Math.max(0, currentBatch.findIndex((item) => item.assetId === ref.assetId))
    onImagePreviewOpen?.({
      batches: batches.length > 0 ? batches : [currentBatch],
      selectedBatchIndex: 0,
      selectedIndex,
      title: shape.props.nodeType === 'image_gen_4' ? 'Generated outputs' : `Output ${index + 1}`,
    })
  }
  return (
    <>
      {slotBounds.map((bounds, index) => {
        const ref = refs[index]
        const showCanvasButton = hoveredIndex === index && Boolean(onGeneratedImageToCanvas)
        return ref ? (
          <Group
            key={index}
            onDblClick={(event) => {
              event.cancelBubble = true
              openPreview(ref, index)
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex((current) => (current === index ? null : current))}
          >
            <NodeImagePreview
              bounds={bounds}
              source={getGeneratedOutputSource(ref, zoom)}
            />
            <Rect
              fill="rgba(255,255,255,0.001)"
              height={bounds.height}
              width={bounds.width}
              x={bounds.x}
              y={bounds.y}
            />
            {showCanvasButton ? (
              <Group
                onClick={(event) => {
                  event.cancelBubble = true
                  onGeneratedImageToCanvas?.({ ref, shapeId: shape.id })
                }}
                onDblClick={stopNodeCardControlEvent}
                onPointerDown={stopNodeCardControlEvent}
              >
                <Rect
                  cornerRadius={8}
                  fill={palette.actionBg}
                  height={24}
                  opacity={0.96}
                  shadowBlur={8}
                  shadowColor="rgba(15, 23, 42, 0.16)"
                  stroke="rgba(255,255,255,0.72)"
                  strokeWidth={0.75}
                  width={24}
                  x={bounds.x + bounds.width - 32}
                  y={bounds.y + 8}
                />
                <Line
                  lineCap="round"
                  lineJoin="round"
                  points={[
                    bounds.x + bounds.width - 24, bounds.y + 24,
                    bounds.x + bounds.width - 16, bounds.y + 16,
                    bounds.x + bounds.width - 16, bounds.y + 20,
                    bounds.x + bounds.width - 12, bounds.y + 20,
                    bounds.x + bounds.width - 12, bounds.y + 12,
                    bounds.x + bounds.width - 20, bounds.y + 12,
                    bounds.x + bounds.width - 20, bounds.y + 16,
                  ]}
                  stroke={palette.actionText}
                  strokeWidth={1.7}
                />
              </Group>
            ) : null}
          </Group>
        ) : null
      })}
    </>
  )
}

function GenerationProgressFooter({
  progress,
  shape,
}: {
  progress: { label: string; percent: number }
  shape: CanvasNodeShape
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const trackX = 14
  const trackY = shape.props.height - 32
  const trackWidth = shape.props.width - 28
  const fillWidth = Math.max(10, Math.round(trackWidth * progress.percent))
  return (
    <>
      <Text fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" text={progress.label} width={trackWidth - 42} x={trackX} y={shape.props.height - 50} />
      <Text align="right" fill={palette.mutedText} fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" text={`${Math.round(progress.percent * 100)}%`} width={42} x={shape.props.width - 56} y={shape.props.height - 50} />
      <Rect cornerRadius={999} fill={palette.scrollbarTrack} height={8} width={trackWidth} x={trackX} y={trackY} />
      <Rect cornerRadius={999} fill="#2563eb" height={8} width={fillWidth} x={trackX} y={trackY} />
    </>
  )
}

function useEstimatedGenerationProgress(summary: CanvasNodeShape['props']['runtimeSummary']) {
  const status = getStringValue(summary.status) || 'idle'
  const startedAt = getNumberValue(summary.progressStartedAt)
  const estimatedMs = getNumberValue(summary.progressEstimatedMs)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'running' || !startedAt || !estimatedMs) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [estimatedMs, startedAt, status])

  if (status !== 'running' || !startedAt || !estimatedMs) {
    return { label: 'Preparing…', percent: 0.08 }
  }

  const elapsedMs = Math.max(0, now - startedAt)
  const raw = Math.min(elapsedMs / Math.max(estimatedMs, 1), 1.4)
  const percent = raw < 0.08
    ? 0.08
    : raw < 0.92
      ? raw
      : Math.min(0.98, 0.92 + (raw - 0.92) * 0.12)

  if (elapsedMs < 2000) {
    return { label: 'Submitting…', percent: Math.min(percent, 0.12) }
  }
  if (percent < 0.88) {
    return { label: 'Generating…', percent }
  }
  return { label: 'Finishing…', percent }
}
