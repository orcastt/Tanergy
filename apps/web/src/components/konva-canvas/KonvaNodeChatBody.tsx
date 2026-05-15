import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { Group, Line, Path, Rect, Text } from 'react-konva'
import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import { getChatModelDisplayName, getChatModelSelectOptions } from '@/features/ai/mockAiContracts'
import { getCanvasThemePalette, useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import { resolveRuntimeGraphNodeInputs, type RuntimeGraphImageValue } from '@/features/node-runtime/runtimeGraphResolution'
import { getKonvaChatDraft, getKonvaChatMessages, getKonvaChatModelId, getKonvaChatReferenceFiles, getKonvaChatReferenceImages, konvaChatDraftPlaceholder } from './konvaChatNodeActions'
import { stopNodeCardControlEvent } from './KonvaNodeCardParts'
import { getGeneratedOutputSource, NodeImagePreview } from './KonvaNodeImagePreview'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'

type KonvaNodeChatBodyProps = {
  document: CanvasDocument
  editingFieldName?: KonvaNodeTextFieldName | null
  shape: CanvasNodeShape
  onChatModelChange?: (shapeId: string, modelId: string) => void
  onChatRegenerate?: (shapeId: string, messageId: string) => void
  onChatSend?: (shapeId: string, draftOverride?: string) => void
  onChatUpload?: (shapeId: string) => void
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  zoom: number
}

export function KonvaNodeChatBody({ document, editingFieldName = null, onChatModelChange, onChatRegenerate, onChatSend, onChatUpload, onTextEditStart, shape, zoom }: KonvaNodeChatBodyProps) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const messages = getKonvaChatMessages(shape.props.data)
  const references = getKonvaChatReferenceImages(shape.props.data)
  const files = getKonvaChatReferenceFiles(shape.props.data)
  const inputResolution = resolveRuntimeGraphNodeInputs(document, shape)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const copyResetTimerRef = useRef<number | null>(null)
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
  const modelId = getKonvaChatModelId(shape.props.data)
  const modelOptions = getChatModelSelectOptions()
  const modelLabel = getShortModelLabel(getChatModelDisplayName(modelId))
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

  useEffect(() => () => {
    if (copyResetTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(copyResetTimerRef.current)
    }
  }, [])

  const handleWheel = (event: Parameters<NonNullable<ComponentProps<typeof Group>['onWheel']>>[0]) => {
    if (maxScroll <= 0) return
    event.cancelBubble = true
    event.evt.preventDefault()
    setScrollState((current) => ({
      messageCount: messages.length,
      value: clamp((current.messageCount === messages.length ? current.value : maxScroll) + event.evt.deltaY, 0, maxScroll),
    }))
  }

  const handleCopyMessage = (messageId: string, text: string) => {
    if (!text.trim() || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedMessageId(messageId)
      if (copyResetTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(copyResetTimerRef.current)
      }
      if (typeof window !== 'undefined') {
        copyResetTimerRef.current = window.setTimeout(() => {
          setCopiedMessageId((current) => (current === messageId ? null : current))
          copyResetTimerRef.current = null
        }, 1400)
      }
    }).catch(() => {})
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
                  fill={isAssistant ? palette.fieldBg : palette.secondaryBg}
                  height={height}
                  stroke={isAssistant ? palette.fieldStroke : '#8b5cf6'}
                  strokeWidth={1}
                  width={width}
                />
                <Text
                  fill={palette.fieldText}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize={12}
                  height={height - (isAssistant ? 42 : 24)}
                  lineHeight={1.28}
                  text={message.text || (isAssistant ? 'Thinking...' : '')}
                  width={width - 20}
                  wrap="char"
                  x={10}
                  y={12}
                />
                {isAssistant ? (
                  <>
                    <MessageActionButton
                      ariaLabel="Copy reply"
                      onClick={() => handleCopyMessage(message.id, message.text)}
                      tone={copiedMessageId === message.id ? 'success' : 'default'}
                      x={10}
                      y={height - 26}
                    >
                      <CopyReplyIcon tone={copiedMessageId === message.id ? 'success' : 'default'} x={4} y={4} />
                    </MessageActionButton>
                    <MessageActionButton
                      ariaLabel="Regenerate reply"
                      onClick={() => onChatRegenerate?.(shape.id, message.id)}
                      x={36}
                      y={height - 26}
                    >
                      <RefreshReplyIcon x={4} y={4} />
                    </MessageActionButton>
                  </>
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
        onModelSelect={(nextModelId) => {
          onChatModelChange?.(shape.id, nextModelId)
          setModelMenuOpen(false)
        }}
        onModelToggle={() => setModelMenuOpen((current) => !current)}
        onSend={() => onChatSend?.(shape.id)}
        onUpload={() => onChatUpload?.(shape.id)}
        height={inputBoxHeight}
        modelLabel={modelLabel}
        modelMenuOpen={modelMenuOpen}
        modelOptions={modelOptions}
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
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const contentHeight = trackHeight + maxScroll
  const thumbHeight = Math.max(28, Math.min(trackHeight, trackHeight * trackHeight / Math.max(trackHeight, contentHeight)))
  const travel = Math.max(1, trackHeight - thumbHeight)
  const thumbY = y + travel * (scrollY / Math.max(1, maxScroll))
  return (
    <Group>
      <Rect
        cornerRadius={999}
        fill={palette.scrollbarTrack}
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
        fill={palette.scrollbar}
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
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
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
      <Rect cornerRadius={10} fill={palette.fieldBg} height={50} stroke={palette.fieldStroke} strokeWidth={1} width={width} x={x} y={y} />
      <Text fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text="Connected" width={74} x={x + 10} y={y + 7} />
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
        <Text align="center" fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" height={24} text={`+${overflow}`} verticalAlign="middle" width={30} x={Math.min(cursorX, x + width - 40)} y={y + 20} />
      ) : null}
    </Group>
  )
}

function ConnectedFileChip({ file, index, width, x, y }: { file: ChatReferenceFile; index: number; width: number; x: number; y: number }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  return (
    <Group>
      <Rect cornerRadius={8} fill={palette.secondaryBg} height={24} stroke="#ddd6fe" strokeWidth={1} width={width} x={x} y={y} />
      <Text fill="#6d28d9" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`file ${index + 1}`} width={40} x={x + 7} y={y + 4} />
      <Text ellipsis fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={8} height={9} text={file.name} width={width - 14} wrap="none" x={x + 7} y={y + 14} />
    </Group>
  )
}

function ConnectedPromptChip({ index, text, width, x, y }: { index: number; text: string; width: number; x: number; y: number }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  return (
    <Group>
      <Rect cornerRadius={8} fill={palette.secondaryBg} height={24} stroke="#fde68a" strokeWidth={1} width={width} x={x} y={y} />
      <Text fill="#b45309" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`prompt ${index + 1}`} width={52} x={x + 7} y={y + 4} />
      <Text ellipsis fill={palette.mutedText} fontFamily="Inter, system-ui, sans-serif" fontSize={9} height={10} text={text} width={width - 14} wrap="none" x={x + 7} y={y + 13} />
    </Group>
  )
}

function ConnectedImageChip({ image, index, width, x, y, zoom }: { image: RuntimeGraphImageValue; index: number; width: number; x: number; y: number; zoom: number }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const source = getGeneratedOutputSource(image, zoom)
  return (
    <Group>
      <Rect cornerRadius={8} fill={palette.secondaryBg} height={24} stroke="#bbf7d0" strokeWidth={1} width={width} x={x} y={y} />
      <Rect cornerRadius={5} fill={palette.imageSlotBg} height={18} width={24} x={x + 4} y={y + 3} />
      <NodeImagePreview bounds={{ height: 18, width: 24, x: x + 4, y: y + 3 }} crop={image.crop} source={source} />
      <Text fill="#047857" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`image ${index + 1}`} width={width - 34} x={x + 34} y={y + 5} />
      <Text ellipsis fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={8} height={9} text={image.title} width={width - 34} wrap="none" x={x + 34} y={y + 14} />
    </Group>
  )
}

function ReferenceStrip({ fileCount, imageCount, promptCount, width, x, y }: { fileCount: number; imageCount: number; promptCount: number; width: number; x: number; y: number }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const promptText = promptCount > 0 ? ` · ${promptCount} prompts` : ''
  return (
    <Group>
      <Text fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" text={`Refs ${imageCount} images · ${fileCount} PDFs${promptText}`} width={width} x={x} y={y} />
      <Line points={[x, y + 15, x + width, y + 15]} stroke={palette.fieldStroke} strokeWidth={1} />
    </Group>
  )
}

function ChatInputBox({
  draft,
  editing,
  height,
  onEdit,
  onModelSelect,
  onModelToggle,
  onSend,
  onUpload,
  modelLabel,
  modelMenuOpen,
  modelOptions,
  width,
  x,
  y,
}: {
  draft: string
  editing: boolean
  height: number
  onEdit: () => void
  onModelSelect: (modelId: string) => void
  onModelToggle: () => void
  onSend: () => void
  onUpload: () => void
  modelLabel: string
  modelMenuOpen: boolean
  modelOptions: Array<{ disabled?: boolean; label: string; value: string | number }>
  width: number
  x: number
  y: number
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const buttonWidth = 58
  const modelButtonWidth = 88
  const toolbarY = y + height - 31
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        onEdit()
      }}
      onPointerDown={stopNodeCardControlEvent}
    >
      <Rect cornerRadius={10} fill={palette.secondaryBg} height={height} stroke="#8b5cf6" strokeWidth={1.2} width={width} x={x} y={y} />
      {editing ? null : (
        <Text align="left" ellipsis fill="#8b5cf6" fontFamily="Inter, system-ui, sans-serif" fontSize={12} height={34} text={draft || konvaChatDraftPlaceholder} verticalAlign="middle" width={width - 30} wrap="none" x={x + 16} y={y + 9} />
      )}
      <IconButton label="+" onClick={onUpload} x={x + 12} y={toolbarY} />
      <IconButton label="image" onClick={onUpload} width={50} x={x + 40} y={toolbarY} />
      <IconButton label={modelLabel} onClick={onModelToggle} width={modelButtonWidth} x={x + 96} y={toolbarY} />
      {modelMenuOpen ? (
        <ChatModelMenu
          onSelect={onModelSelect}
          options={modelOptions}
          width={modelButtonWidth + 28}
          x={x + 96}
          y={toolbarY - 10 - (modelOptions.length * 30 + 8)}
        />
      ) : null}
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

function ChatModelMenu({
  onSelect,
  options,
  width,
  x,
  y,
}: {
  onSelect: (modelId: string) => void
  options: Array<{ disabled?: boolean; label: string; value: string | number }>
  width: number
  x: number
  y: number
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  return (
    <Group>
      <Rect cornerRadius={10} fill={palette.dropdownBg} height={options.length * 30 + 8} shadowBlur={14} shadowColor={palette.nodeShadow} shadowOffsetY={6} stroke={palette.fieldStroke} strokeWidth={1} width={width} x={x} y={y} />
      {options.map((option, index) => (
        <Group
          key={String(option.value)}
          onClick={option.disabled ? undefined : (event) => {
            event.cancelBubble = true
            onSelect(String(option.value))
          }}
          onDblClick={stopNodeCardControlEvent}
          onPointerDown={stopNodeCardControlEvent}
          opacity={option.disabled ? 0.45 : 1}
        >
          <Rect cornerRadius={7} fill={palette.dropdownBg} height={26} width={width - 8} x={x + 4} y={y + 4 + index * 30} />
          <Text fill={palette.fieldText} fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" height={26} text={option.label} verticalAlign="middle" width={width - 18} x={x + 10} y={y + 4 + index * 30} />
        </Group>
      ))}
    </Group>
  )
}

function IconButton({ label, onClick, width = 22, x, y }: { label: string; onClick?: () => void; width?: number; x: number; y: number }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        onClick?.()
      }}
      onDblClick={stopNodeCardControlEvent}
      onPointerDown={stopNodeCardControlEvent}
    >
      <Rect cornerRadius={999} fill={palette.fieldBg} height={22} stroke={palette.fieldStroke} strokeWidth={1} width={width} x={x} y={y} />
      <Text align="center" fill={palette.mutedText} fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" height={22} text={label} verticalAlign="middle" width={width} x={x} y={y} />
    </Group>
  )
}

function MessageActionButton({
  ariaLabel,
  children,
  onClick,
  tone = 'default',
  x,
  y,
}: {
  ariaLabel: string
  children: React.ReactNode
  onClick?: () => void
  tone?: 'default' | 'success'
  x: number
  y: number
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const fill = tone === 'success' ? '#ecfdf5' : palette.secondaryBg
  const stroke = tone === 'success' ? '#22c55e' : palette.fieldStroke
  return (
    <Group
      aria-label={ariaLabel}
      onClick={(event) => {
        event.cancelBubble = true
        onClick?.()
      }}
      onDblClick={stopNodeCardControlEvent}
      onPointerDown={stopNodeCardControlEvent}
    >
      <Rect cornerRadius={999} fill={fill} height={18} stroke={stroke} strokeWidth={1} width={18} x={x} y={y} />
      <Group x={x} y={y}>{children}</Group>
    </Group>
  )
}

function CopyReplyIcon({ tone = 'default', x, y }: { tone?: 'default' | 'success'; x: number; y: number }) {
  const stroke = tone === 'success' ? '#16a34a' : '#6b7280'
  return (
    <>
      <Rect cornerRadius={2} fillEnabled={false} height={7} stroke={stroke} strokeWidth={1.2} width={6} x={x + 3.5} y={y + 2} />
      <Rect cornerRadius={2} fillEnabled={false} height={7} stroke={stroke} strokeWidth={1.2} width={6} x={x + 5.5} y={y + 4} />
    </>
  )
}

function RefreshReplyIcon({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Path
        data={`M ${x + 10.5} ${y + 3.5} A 4.5 4.5 0 1 0 ${x + 11.8} ${y + 10.6}`}
        fillEnabled={false}
        stroke="#6b7280"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.2}
      />
      <Line points={[x + 10.4, y + 2.9, x + 13, y + 3, x + 12.8, y + 5.5]} stroke="#6b7280" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} />
    </>
  )
}

function getShortModelLabel(label: string) {
  return label.replace(/\s+Preview$/i, '').slice(0, 14) || 'Model'
}
