import { useMemo, useState, type ComponentProps } from 'react'
import { Group, Line, Rect, Text } from 'react-konva'
import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import { resolveRuntimeGraphNodeInputs, type RuntimeGraphImageValue } from '@/features/node-runtime/runtimeGraphResolution'
import { getKonvaChatDraft, getKonvaChatExportedMessageIds, getKonvaChatMessages, getKonvaChatReferenceFiles, getKonvaChatReferenceImages, konvaChatDraftPlaceholder } from './konvaChatNodeActions'
import { stopNodeCardControlEvent } from './KonvaNodeCardParts'
import { getGeneratedOutputSource, NodeImagePreview } from './KonvaNodeImagePreview'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'

type KonvaNodeChatBodyProps = {
  document: CanvasDocument
  editingFieldName?: KonvaNodeTextFieldName | null
  shape: CanvasNodeShape
  onChatExportToggle?: (shapeId: string, messageId: string) => void
  onChatSend?: (shapeId: string, draftOverride?: string) => void
  onChatUpload?: (shapeId: string) => void
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  zoom: number
}

export function KonvaNodeChatBody({ document, editingFieldName = null, onChatExportToggle, onChatSend, onChatUpload, onTextEditStart, shape, zoom }: KonvaNodeChatBodyProps) {
  const messages = getKonvaChatMessages(shape.props.data)
  const exported = new Set(getKonvaChatExportedMessageIds(shape.props.data))
  const references = getKonvaChatReferenceImages(shape.props.data)
  const files = getKonvaChatReferenceFiles(shape.props.data)
  const inputResolution = resolveRuntimeGraphNodeInputs(document, shape)
  const localImageValues = references.map((reference, index): RuntimeGraphImageValue => ({
    assetId: reference.assetId,
    originalUrl: reference.originalUrl,
    sourceNodeId: shape.props.nodeId,
    thumbnail256Url: reference.thumbnail256Url,
    title: reference.title ?? `Reference image ${index + 1}`,
  }))
  const allImageValues = [...inputResolution.imageValues, ...localImageValues]
  const connectedPromptCount = inputResolution.textValues.length
  const connectedImageCount = allImageValues.length
  const draft = getKonvaChatDraft(shape.props.data)
  const bodyTop = 82
  const inputBoxHeight = 78
  const inputBottom = 16
  const inputY = shape.props.height - inputBoxHeight - inputBottom
  const contextStripHeight = connectedPromptCount > 0 || connectedImageCount > 0 || files.length > 0 ? 58 : 0
  const contextStripGap = contextStripHeight > 0 ? 8 : 0
  const contextY = inputY - contextStripHeight - contextStripGap
  const bodyHeight = Math.max(56, (contextStripHeight > 0 ? contextY : inputY) - bodyTop - 12)
  const messageGap = 10
  const viewportWidth = shape.props.width - 28
  const contentWidth = viewportWidth - 12
  const messageLayouts = useMemo(() => getChatMessageLayouts(messages, contentWidth, messageGap), [contentWidth, messageGap, messages])
  const maxScroll = Math.max(0, messageLayouts.totalHeight - bodyHeight)
  const [scrollState, setScrollState] = useState(() => ({ messageCount: messages.length, value: maxScroll }))
  const scrollY = scrollState.messageCount === messages.length ? scrollState.value : maxScroll
  const visibleScrollY = Math.min(scrollY, maxScroll)
  const visibleMessages = messageLayouts.items.filter((item) => item.y + item.height >= visibleScrollY - 40 && item.y <= visibleScrollY + bodyHeight + 40)

  const handleWheel = (event: Parameters<NonNullable<ComponentProps<typeof Group>['onWheel']>>[0]) => {
    if (maxScroll <= 0) return
    event.cancelBubble = true
    event.evt.preventDefault()
    setScrollState((current) => ({
      messageCount: messages.length,
      value: clamp((current.messageCount === messages.length ? current.value : maxScroll) + event.evt.deltaY, 0, maxScroll),
    }))
  }

  return (
    <>
      <ReferenceStrip fileCount={files.length} imageCount={connectedImageCount} promptCount={connectedPromptCount} width={viewportWidth} x={14} y={50} />
      <Group clipHeight={bodyHeight} clipWidth={viewportWidth} onWheel={handleWheel} x={14} y={bodyTop}>
        <Group y={-visibleScrollY}>
          {visibleMessages.map(({ height, isAssistant, message, width, x, y }) => {
            return (
              <Group key={message.id} x={x} y={y}>
                <Rect
                  cornerRadius={10}
                  fill={isAssistant ? '#f8fafc' : '#ffffff'}
                  height={height}
                  stroke={isAssistant ? '#cfd8e3' : '#8b5cf6'}
                  strokeWidth={1}
                  width={width}
                />
                <Text
                  fill="#1f2937"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize={12}
                  height={height - (isAssistant ? 42 : 24)}
                  lineHeight={1.28}
                  text={message.text}
                  width={width - 20}
                  wrap="char"
                  x={10}
                  y={12}
                />
                {isAssistant ? (
                  <ExportButton
                    exported={exported.has(message.id)}
                    onClick={() => onChatExportToggle?.(shape.id, message.id)}
                    x={width - 68}
                    y={height - 25}
                  />
                ) : null}
              </Group>
            )
          })}
        </Group>
      </Group>
      {maxScroll > 0 ? (
        <ChatScrollbar
          maxScroll={maxScroll}
          onScroll={(value) => setScrollState({ messageCount: messages.length, value })}
          scrollY={visibleScrollY}
          trackHeight={bodyHeight - 8}
          x={shape.props.width - 20}
          y={bodyTop + 4}
        />
      ) : null}
      {contextStripHeight > 0 ? (
        <ConnectedContextStrip
          files={files}
          images={allImageValues}
          prompts={inputResolution.textValues}
          width={viewportWidth}
          x={14}
          y={contextY}
          zoom={zoom}
        />
      ) : null}
      <ChatInputBox
        draft={draft}
        editing={editingFieldName === 'chatDraft'}
        onEdit={() => onTextEditStart?.(shape.id, 'chatDraft')}
        onSend={() => onChatSend?.(shape.id)}
        onUpload={() => onChatUpload?.(shape.id)}
        height={inputBoxHeight}
        width={viewportWidth}
        x={14}
        y={inputY}
      />
    </>
  )
}

type ChatMessage = ReturnType<typeof getKonvaChatMessages>[number]
type ChatReferenceFile = ReturnType<typeof getKonvaChatReferenceFiles>[number]

type ChatMessageLayout = {
  height: number
  isAssistant: boolean
  message: ChatMessage
  width: number
  x: number
  y: number
}

function getChatMessageLayouts(messages: ChatMessage[], contentWidth: number, gap: number) {
  let y = 0
  const items: ChatMessageLayout[] = messages.map((message) => {
    const isAssistant = message.role === 'assistant'
    const width = isAssistant ? contentWidth : Math.max(128, contentWidth - 92)
    const height = estimateMessageHeight(message.text, width, isAssistant)
    const layout = {
      height,
      isAssistant,
      message,
      width,
      x: isAssistant ? 0 : contentWidth - width,
      y,
    }
    y += height + gap
    return layout
  })
  return { items, totalHeight: Math.max(0, y - gap) }
}

function estimateMessageHeight(text: string, width: number, isAssistant: boolean) {
  const textWidth = Math.max(80, width - 20)
  const lines = text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(getVisualTextUnits(line) / Math.max(1, textWidth / 12))), 0)
  const textHeight = lines * 15.5
  return clamp((isAssistant ? 42 : 24) + textHeight, 54, isAssistant ? 172 : 148)
}

function getVisualTextUnits(text: string) {
  return Array.from(text).reduce((total, char) => {
    if (/\s/.test(char)) return total + 0.35
    if (/[\u3400-\u9fff\uff00-\uffef]/.test(char)) return total + 1
    if (/[A-Z0-9]/.test(char)) return total + 0.68
    return total + 0.56
  }, 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function ChatScrollbar({
  maxScroll,
  onScroll,
  scrollY,
  trackHeight,
  x,
  y,
}: {
  maxScroll: number
  onScroll: (scrollY: number) => void
  scrollY: number
  trackHeight: number
  x: number
  y: number
}) {
  const contentHeight = trackHeight + maxScroll
  const thumbHeight = Math.max(28, Math.min(trackHeight, trackHeight * trackHeight / Math.max(trackHeight, contentHeight)))
  const travel = Math.max(1, trackHeight - thumbHeight)
  const thumbY = y + travel * (scrollY / Math.max(1, maxScroll))
  return (
    <Group>
      <Rect
        cornerRadius={999}
        fill="rgba(148, 163, 184, 0.18)"
        height={trackHeight}
        onClick={(event) => {
          event.cancelBubble = true
          const pointer = event.target.getStage()?.getPointerPosition()
          if (!pointer) return
          const local = event.target.getAbsoluteTransform().copy().invert().point(pointer)
          onScroll(clamp(((local.y - thumbHeight / 2) / travel) * maxScroll, 0, maxScroll))
        }}
        onPointerDown={stopNodeCardControlEvent}
        width={4}
        x={x}
        y={y}
      />
      <Rect
        cornerRadius={999}
        draggable
        fill="#94a3b8"
        height={thumbHeight}
        onDragMove={(event) => {
          event.cancelBubble = true
          const nextY = clamp(event.target.y(), y, y + travel)
          event.target.y(nextY)
          event.target.x(x)
          onScroll(clamp(((nextY - y) / travel) * maxScroll, 0, maxScroll))
        }}
        onPointerDown={stopNodeCardControlEvent}
        width={4}
        x={x}
        y={thumbY}
      />
    </Group>
  )
}

function ConnectedContextStrip({
  files,
  images,
  prompts,
  width,
  x,
  y,
  zoom,
}: {
  files: ChatReferenceFile[]
  images: RuntimeGraphImageValue[]
  prompts: string[]
  width: number
  x: number
  y: number
  zoom: number
}) {
  const maxItems = Math.max(1, Math.min(4, Math.floor((width - 52) / 90)))
  const allItems: Array<
    | { index: number; kind: 'file'; value: ChatReferenceFile }
    | { index: number; kind: 'image'; value: RuntimeGraphImageValue }
    | { index: number; kind: 'prompt'; value: string }
  > = [
    ...prompts.map((value, index) => ({ index, kind: 'prompt' as const, value })),
    ...images.map((value, index) => ({ index, kind: 'image' as const, value })),
    ...files.map((value, index) => ({ index, kind: 'file' as const, value })),
  ]
  const items = allItems.slice(0, maxItems)
  const overflow = allItems.length - items.length
  let cursorX = x + 10
  return (
    <Group>
      <Rect cornerRadius={10} fill="#f8fafc" height={50} stroke="#dce3ec" strokeWidth={1} width={width} x={x} y={y} />
      <Text fill="#64748b" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text="Connected" width={74} x={x + 10} y={y + 7} />
      {items.map((item) => {
        const chip = item.kind === 'image'
          ? <ConnectedImageChip image={item.value} index={item.index} key={`image-${item.index}`} width={76} x={cursorX} y={y + 20} zoom={zoom} />
          : item.kind === 'file'
            ? <ConnectedFileChip file={item.value} index={item.index} key={`file-${item.index}`} width={82} x={cursorX} y={y + 20} />
            : <ConnectedPromptChip index={item.index} key={`prompt-${item.index}`} text={item.value} width={92} x={cursorX} y={y + 20} />
        cursorX += item.kind === 'prompt' ? 98 : item.kind === 'file' ? 88 : 82
        return chip
      })}
      {overflow > 0 ? (
        <Text align="center" fill="#64748b" fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" height={24} text={`+${overflow}`} verticalAlign="middle" width={30} x={Math.min(cursorX, x + width - 40)} y={y + 20} />
      ) : null}
    </Group>
  )
}

function ConnectedFileChip({ file, index, width, x, y }: { file: ChatReferenceFile; index: number; width: number; x: number; y: number }) {
  return (
    <Group>
      <Rect cornerRadius={8} fill="#ffffff" height={24} stroke="#ddd6fe" strokeWidth={1} width={width} x={x} y={y} />
      <Text fill="#6d28d9" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`file ${index + 1}`} width={40} x={x + 7} y={y + 4} />
      <Text ellipsis fill="#64748b" fontFamily="Inter, system-ui, sans-serif" fontSize={8} height={9} text={file.name} width={width - 14} wrap="none" x={x + 7} y={y + 14} />
    </Group>
  )
}

function ConnectedPromptChip({ index, text, width, x, y }: { index: number; text: string; width: number; x: number; y: number }) {
  return (
    <Group>
      <Rect cornerRadius={8} fill="#ffffff" height={24} stroke="#fde68a" strokeWidth={1} width={width} x={x} y={y} />
      <Text fill="#b45309" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`prompt ${index + 1}`} width={52} x={x + 7} y={y + 4} />
      <Text ellipsis fill="#475569" fontFamily="Inter, system-ui, sans-serif" fontSize={9} height={10} text={text} width={width - 14} wrap="none" x={x + 7} y={y + 13} />
    </Group>
  )
}

function ConnectedImageChip({ image, index, width, x, y, zoom }: { image: RuntimeGraphImageValue; index: number; width: number; x: number; y: number; zoom: number }) {
  const source = getGeneratedOutputSource(image, zoom)
  return (
    <Group>
      <Rect cornerRadius={8} fill="#ffffff" height={24} stroke="#bbf7d0" strokeWidth={1} width={width} x={x} y={y} />
      <Rect cornerRadius={5} fill="#e2e8f0" height={18} width={24} x={x + 4} y={y + 3} />
      <NodeImagePreview bounds={{ height: 18, width: 24, x: x + 4, y: y + 3 }} crop={image.crop} source={source} />
      <Text fill="#047857" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`image ${index + 1}`} width={width - 34} x={x + 34} y={y + 5} />
      <Text ellipsis fill="#64748b" fontFamily="Inter, system-ui, sans-serif" fontSize={8} height={9} text={image.title} width={width - 34} wrap="none" x={x + 34} y={y + 14} />
    </Group>
  )
}

function ReferenceStrip({ fileCount, imageCount, promptCount, width, x, y }: { fileCount: number; imageCount: number; promptCount: number; width: number; x: number; y: number }) {
  const promptText = promptCount > 0 ? ` · ${promptCount} prompts` : ''
  return (
    <Group>
      <Text fill="#64748b" fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" text={`Refs ${imageCount} images · ${fileCount} PDFs${promptText}`} width={width} x={x} y={y} />
      <Line points={[x, y + 15, x + width, y + 15]} stroke="#e2e8f0" strokeWidth={1} />
    </Group>
  )
}

function ChatInputBox({
  draft,
  editing,
  height,
  onEdit,
  onSend,
  onUpload,
  width,
  x,
  y,
}: {
  draft: string
  editing: boolean
  height: number
  onEdit: () => void
  onSend: () => void
  onUpload: () => void
  width: number
  x: number
  y: number
}) {
  const buttonWidth = 58
  const toolbarY = y + height - 31
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        onEdit()
      }}
      onPointerDown={stopNodeCardControlEvent}
    >
      <Rect cornerRadius={10} fill="#ffffff" height={height} stroke="#8b5cf6" strokeWidth={1.2} width={width} x={x} y={y} />
      {editing ? null : (
        <Text align="left" ellipsis fill="#8b5cf6" fontFamily="Inter, system-ui, sans-serif" fontSize={12} height={34} text={draft || konvaChatDraftPlaceholder} verticalAlign="middle" width={width - 30} wrap="none" x={x + 16} y={y + 9} />
      )}
      <IconButton label="+" onClick={onUpload} x={x + 12} y={toolbarY} />
      <IconButton label="image" onClick={onUpload} width={50} x={x + 40} y={toolbarY} />
      <IconButton label="model" width={54} x={x + 96} y={toolbarY} />
      <Group
        onClick={(event) => {
          event.cancelBubble = true
          onSend()
        }}
        onDblClick={stopNodeCardControlEvent}
        onPointerDown={stopNodeCardControlEvent}
      >
        <Rect cornerRadius={999} fill="#dcfce7" height={22} stroke="#22c55e" strokeWidth={1} width={buttonWidth} x={x + width - buttonWidth - 12} y={toolbarY} />
        <Text align="center" fill="#16a34a" fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" height={22} text="send" verticalAlign="middle" width={buttonWidth} x={x + width - buttonWidth - 12} y={toolbarY} />
      </Group>
    </Group>
  )
}

function IconButton({ label, onClick, width = 22, x, y }: { label: string; onClick?: () => void; width?: number; x: number; y: number }) {
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        onClick?.()
      }}
      onDblClick={stopNodeCardControlEvent}
      onPointerDown={stopNodeCardControlEvent}
    >
      <Rect cornerRadius={999} fill="#f8fafc" height={22} stroke="#dce3ec" strokeWidth={1} width={width} x={x} y={y} />
      <Text align="center" fill="#475569" fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" height={22} text={label} verticalAlign="middle" width={width} x={x} y={y} />
    </Group>
  )
}

function ExportButton({ exported, onClick, x, y }: { exported: boolean; onClick: () => void; x: number; y: number }) {
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        onClick()
      }}
      onDblClick={stopNodeCardControlEvent}
      onPointerDown={stopNodeCardControlEvent}
    >
      <Rect cornerRadius={999} fill={exported ? '#fef2f2' : '#dcfce7'} height={20} stroke={exported ? '#ef4444' : '#22c55e'} strokeWidth={1} width={58} x={x} y={y} />
      <Text align="center" fill={exported ? '#dc2626' : '#16a34a'} fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" height={20} text={exported ? 'unexport' : 'export'} verticalAlign="middle" width={58} x={x} y={y} />
    </Group>
  )
}
