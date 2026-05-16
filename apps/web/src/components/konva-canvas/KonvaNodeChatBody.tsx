import { useEffect, useMemo, useState, type ComponentProps, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Group, Line, Path, Rect, Text } from 'react-konva'
import type { CanvasDocument, CanvasNodeShape } from '@/features/canvas-engine'
import { getChatModelDisplayName, getChatModelSelectOptions } from '@/features/ai/mockAiContracts'
import { getCanvasThemePalette, useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import { resolveRuntimeGraphNodeInputs, type RuntimeGraphImageValue } from '@/features/node-runtime/runtimeGraphResolution'
import { getKonvaChatDraft, getKonvaChatMessages, getKonvaChatModelId, getKonvaChatReferenceFiles, getKonvaChatReferenceImages, konvaChatDraftPlaceholder } from './konvaChatNodeActions'
import { KonvaInlineTooltip } from './KonvaInlineTooltip'
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
  onFocusedEditRequest?: (shapeId: string, source: 'chat-model-menu' | 'field-dropdown') => boolean
  onFocusedEditStateChange?: (
    shapeId: string,
    source: 'chat-model-menu' | 'field-dropdown',
    active: boolean,
  ) => void
  onTextEditStart?: (shapeId: string, fieldName: KonvaNodeTextFieldName) => void
  zoom: number
}

type ChatTooltipState = null | {
  anchorX: number
  anchorY: number
  id: string
  label: string
}

type KonvaGroupWheelEvent = Parameters<NonNullable<ComponentProps<typeof Group>['onWheel']>>[0]

export function KonvaNodeChatBody({ document, editingFieldName = null, onChatModelChange, onChatRegenerate, onChatSend, onChatUpload, onFocusedEditRequest, onFocusedEditStateChange, onTextEditStart, shape, zoom }: KonvaNodeChatBodyProps) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const messages = getKonvaChatMessages(shape.props.data)
  const references = getKonvaChatReferenceImages(shape.props.data)
  const files = getKonvaChatReferenceFiles(shape.props.data)
  const inputResolution = resolveRuntimeGraphNodeInputs(document, shape)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [tooltip, setTooltip] = useState<ChatTooltipState>(null)
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
  const inputBoxHeight = 96
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
  const [messageTextScrolls, setMessageTextScrolls] = useState<Record<string, number>>({})
  const scrollY = scrollState.messageCount === messages.length ? scrollState.value : maxScroll
  const visibleScrollY = Math.min(scrollY, maxScroll)
  const visibleMessages = messageLayouts.items.filter((item) => item.y + item.height >= visibleScrollY - 40 && item.y <= visibleScrollY + bodyHeight + 40)

  useEffect(() => {
    onFocusedEditStateChange?.(shape.id, 'chat-model-menu', modelMenuOpen)
  }, [modelMenuOpen, onFocusedEditStateChange, shape.id])
  useEffect(() => () => {
    onFocusedEditStateChange?.(shape.id, 'chat-model-menu', false)
  }, [onFocusedEditStateChange, shape.id])

  const handleWheel = (event: KonvaGroupWheelEvent) => {
    if (maxScroll <= 0) return
    event.cancelBubble = true
    event.evt.preventDefault()
    setTooltip(null)
    setScrollState((current) => ({
      messageCount: messages.length,
      value: clamp((current.messageCount === messages.length ? current.value : maxScroll) + event.evt.deltaY, 0, maxScroll),
    }))
  }

  const handleCopyMessage = (text: string) => {
    if (!text.trim() || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
    void navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <>
      <ReferenceStrip fileCount={files.length} imageCount={connectedImageCount} promptCount={connectedPromptCount} width={viewportWidth} x={14} y={50} />
      <Group clipHeight={bodyHeight} clipWidth={viewportWidth} onWheel={handleWheel} x={14} y={bodyTop}>
        <Group y={-visibleScrollY}>
          {visibleMessages.map((layout) => {
            const messageTextScroll = clamp(messageTextScrolls[layout.message.id] ?? 0, 0, layout.textMaxScroll)
            return (
              <ChatMessageBubble
                key={layout.message.id}
                bodyTop={bodyTop}
                layout={layout}
                onCopyMessage={handleCopyMessage}
                onRegenerate={onChatRegenerate}
                onTextScroll={(value) => {
                  setMessageTextScrolls((current) => {
                    const nextValue = clamp(value, 0, layout.textMaxScroll)
                    const previousValue = current[layout.message.id] ?? 0
                    if (previousValue === nextValue) return current
                    if (nextValue <= 0) {
                      if (!Object.prototype.hasOwnProperty.call(current, layout.message.id)) return current
                      const next = { ...current }
                      delete next[layout.message.id]
                      return next
                    }
                    return { ...current, [layout.message.id]: nextValue }
                  })
                }}
                onTooltipChange={setTooltip}
                palette={palette}
                scrollY={messageTextScroll}
                shapeId={shape.id}
                visibleScrollY={visibleScrollY}
              />
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
        onModelToggle={() => {
          setModelMenuOpen((current) => {
            if (current) return false
            if (onFocusedEditRequest && !onFocusedEditRequest(shape.id, 'chat-model-menu')) return current
            return true
          })
        }}
        onSend={() => onChatSend?.(shape.id)}
        onUpload={() => onChatUpload?.(shape.id)}
        height={inputBoxHeight}
        modelLabel={modelLabel}
        modelMenuOpen={modelMenuOpen}
        modelOptions={modelOptions}
        onTooltipChange={setTooltip}
        width={viewportWidth}
        x={14}
        y={inputY}
      />
      {tooltip ? <KonvaInlineTooltip anchorX={tooltip.anchorX} anchorY={tooltip.anchorY} label={tooltip.label} /> : null}
    </>
  )
}

type ChatMessage = ReturnType<typeof getKonvaChatMessages>[number]
type ChatReferenceFile = ReturnType<typeof getKonvaChatReferenceFiles>[number]

type ChatMessageLayout = {
  displayText: string
  height: number
  isAssistant: boolean
  message: ChatMessage
  textContentHeight: number
  textMaxScroll: number
  textViewportHeight: number
  textViewportWidth: number
  width: number
  x: number
  y: number
}

function getChatMessageLayouts(messages: ChatMessage[], contentWidth: number, gap: number) {
  let y = 0
  const items: ChatMessageLayout[] = messages.map((message) => {
    const isAssistant = message.role === 'assistant'
    const width = isAssistant ? contentWidth : Math.max(128, contentWidth - 92)
    const displayText = message.text || (isAssistant ? 'Thinking...' : '')
    const textMetrics = getMessageTextMetrics(displayText, width, isAssistant)
    const layout = {
      displayText,
      height: textMetrics.height,
      isAssistant,
      message,
      textContentHeight: textMetrics.contentHeight,
      textMaxScroll: textMetrics.maxScroll,
      textViewportHeight: textMetrics.viewportHeight,
      textViewportWidth: textMetrics.viewportWidth,
      width,
      x: isAssistant ? 0 : contentWidth - width,
      y,
    }
    y += textMetrics.height + gap
    return layout
  })
  return { items, totalHeight: Math.max(0, y - gap) }
}

function getMessageTextMetrics(text: string, width: number, isAssistant: boolean) {
  const footerHeight = isAssistant ? 42 : 24
  const viewportWidth = Math.max(80, width - 30)
  const contentHeight = estimateWrappedTextHeight(text, viewportWidth)
  const height = clamp(footerHeight + 12 + contentHeight, 54, isAssistant ? 172 : 148)
  const viewportHeight = Math.max(18, height - footerHeight - 12)
  return {
    contentHeight,
    height,
    maxScroll: Math.max(0, contentHeight - viewportHeight),
    viewportHeight,
    viewportWidth,
  }
}

function estimateWrappedTextHeight(text: string, width: number) {
  const lines = text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(getVisualTextUnits(line) / Math.max(1, width / 12))), 0)
  return lines * 15.5
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

function ChatMessageBubble({
  bodyTop,
  layout,
  onCopyMessage,
  onRegenerate,
  onTextScroll,
  onTooltipChange,
  palette,
  scrollY,
  shapeId,
  visibleScrollY,
}: {
  bodyTop: number
  layout: ChatMessageLayout
  onCopyMessage: (text: string) => void
  onRegenerate?: (shapeId: string, messageId: string) => void
  onTextScroll: (scrollY: number) => void
  onTooltipChange: Dispatch<SetStateAction<ChatTooltipState>>
  palette: ReturnType<typeof getCanvasThemePalette>
  scrollY: number
  shapeId: string
  visibleScrollY: number
}) {
  const hasOverflow = layout.textMaxScroll > 0
  const textClipWidth = hasOverflow ? layout.textViewportWidth - 6 : layout.textViewportWidth
  const handleTextWheel = (event: KonvaGroupWheelEvent) => {
    if (!hasOverflow) return
    event.cancelBubble = true
    event.evt.preventDefault()
    onTooltipChange(null)
    onTextScroll(clamp(scrollY + event.evt.deltaY, 0, layout.textMaxScroll))
  }

  return (
    <Group x={layout.x} y={layout.y}>
      <Rect
        cornerRadius={10}
        fill={layout.isAssistant ? palette.fieldBg : palette.secondaryBg}
        height={layout.height}
        stroke={palette.fieldStroke}
        strokeWidth={1}
        width={layout.width}
      />
      <Group clipHeight={layout.textViewportHeight} clipWidth={textClipWidth} clipX={10} clipY={12} onWheel={handleTextWheel}>
        <Text
          fill={palette.fieldText}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={12}
          height={layout.textContentHeight}
          lineHeight={1.28}
          text={layout.displayText}
          width={layout.textViewportWidth}
          wrap="char"
          x={10}
          y={12 - scrollY}
        />
      </Group>
      {hasOverflow ? (
        <ChatScrollbar
          maxScroll={layout.textMaxScroll}
          onScroll={onTextScroll}
          scrollY={scrollY}
          trackHeight={Math.max(18, layout.textViewportHeight - 4)}
          width={3}
          x={layout.width - 8}
          y={14}
        />
      ) : null}
      {layout.isAssistant ? (
        <>
          <MessageActionButton
            actionId={`copy-${layout.message.id}`}
            ariaLabel="Copy reply"
            onClick={() => onCopyMessage(layout.message.text)}
            onTooltipChange={onTooltipChange}
            tooltipAnchor={{ x: 14 + layout.x + 18, y: bodyTop + layout.y - visibleScrollY + layout.height - 30 }}
            tooltipLabel="Copy reply"
            x={10}
            y={layout.height - 26}
          >
            {(tone) => <CopyReplyIcon tone={tone} x={4} y={4} />}
          </MessageActionButton>
          <MessageActionButton
            actionId={`redo-${layout.message.id}`}
            ariaLabel="Regenerate reply"
            onClick={() => onRegenerate?.(shapeId, layout.message.id)}
            onTooltipChange={onTooltipChange}
            tooltipAnchor={{ x: 14 + layout.x + 44, y: bodyTop + layout.y - visibleScrollY + layout.height - 30 }}
            tooltipLabel="Regenerate reply"
            x={36}
            y={layout.height - 26}
          >
            {(tone) => <RefreshReplyIcon tone={tone} x={4} y={4} />}
          </MessageActionButton>
        </>
      ) : null}
    </Group>
  )
}

function ChatScrollbar({
  maxScroll,
  onScroll,
  scrollY,
  width = 4,
  trackHeight,
  x,
  y,
}: {
  maxScroll: number
  onScroll: (scrollY: number) => void
  scrollY: number
  width?: number
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
        width={width}
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
        width={width}
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
  onTooltipChange,
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
  onTooltipChange: Dispatch<SetStateAction<ChatTooltipState>>
  modelLabel: string
  modelMenuOpen: boolean
  modelOptions: Array<{ disabled?: boolean; label: string; value: string | number }>
  width: number
  x: number
  y: number
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const buttonWidth = 30
  const modelButtonWidth = 96
  const toolbarY = y + height - 31
  const textViewport = {
    height: Math.max(0, height - 46),
    width: Math.max(0, width - 20),
    x: x + 10,
    y: y + 10,
  }
  const displayText = draft || konvaChatDraftPlaceholder
  const textColor = draft ? palette.fieldText : palette.softText
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        onEdit()
      }}
      onPointerDown={stopNodeCardControlEvent}
    >
      <Rect cornerRadius={10} fill={palette.fieldBg} height={height} stroke={palette.fieldStroke} strokeWidth={1} width={width} x={x} y={y} />
      {editing ? null : (
        <Group clipHeight={textViewport.height} clipWidth={textViewport.width} clipX={textViewport.x} clipY={textViewport.y}>
          <Text
            fill={textColor}
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={13}
            height={Math.max(18, textViewport.height)}
            lineHeight={1.35}
            text={displayText}
            width={textViewport.width}
            wrap="char"
            x={textViewport.x}
            y={textViewport.y}
          />
        </Group>
      )}
      <IconButton label="+" onClick={onUpload} x={x + 12} y={toolbarY} />
      <IconButton label={modelLabel} onClick={onModelToggle} width={modelButtonWidth} x={x + 40} y={toolbarY} />
      {modelMenuOpen ? (
        <ChatModelMenu
          onSelect={onModelSelect}
          options={modelOptions}
          width={modelButtonWidth + 28}
          x={x + 40}
          y={toolbarY - 10 - (modelOptions.length * 30 + 8)}
        />
      ) : null}
      <Group
        onClick={(event) => {
          event.cancelBubble = true
          onSend()
        }}
        onMouseEnter={() => onTooltipChange({ anchorX: x + width - buttonWidth / 2 - 12, anchorY: toolbarY, id: 'chat-send', label: 'Send message' })}
        onMouseLeave={() => onTooltipChange((current) => (current && current.id === 'chat-send' ? null : current))}
        onDblClick={stopNodeCardControlEvent}
        onPointerDown={stopNodeCardControlEvent}
      >
        <Rect cornerRadius={999} fill="#dcfce7" height={22} stroke="#22c55e" strokeWidth={1} width={buttonWidth} x={x + width - buttonWidth - 12} y={toolbarY} />
        <SendMessageIcon x={x + width - buttonWidth - 12 + 8} y={toolbarY + 4} />
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
  actionId,
  ariaLabel,
  children,
  onClick,
  onTooltipChange,
  tooltipAnchor,
  tooltipLabel,
  x,
  y,
}: {
  actionId: string
  ariaLabel: string
  children: (tone: 'active' | 'default') => ReactNode
  onClick?: () => void
  onTooltipChange: Dispatch<SetStateAction<ChatTooltipState>>
  tooltipAnchor: { x: number; y: number }
  tooltipLabel: string
  x: number
  y: number
}) {
  const [isPressed, setIsPressed] = useState(false)
  return (
    <Group
      aria-label={ariaLabel}
      onClick={(event) => {
        event.cancelBubble = true
        onClick?.()
      }}
      onMouseEnter={() => onTooltipChange({ anchorX: tooltipAnchor.x, anchorY: tooltipAnchor.y, id: actionId, label: tooltipLabel })}
      onMouseLeave={() => {
        setIsPressed(false)
        onTooltipChange((current) => (current && current.id === actionId ? null : current))
      }}
      onPointerDown={(event) => {
        event.cancelBubble = true
        setIsPressed(true)
      }}
      onPointerUp={() => setIsPressed(false)}
      onDblClick={stopNodeCardControlEvent}
    >
      <Rect fill="rgba(0,0,0,0.001)" height={18} width={18} x={x} y={y} />
      <Group x={x} y={y}>{children(isPressed ? 'active' : 'default')}</Group>
    </Group>
  )
}

function CopyReplyIcon({ tone = 'default', x, y }: { tone?: 'default' | 'active'; x: number; y: number }) {
  const stroke = tone === 'active' ? '#16a34a' : '#64748b'
  return (
    <>
      <Rect cornerRadius={1.8} fillEnabled={false} height={7.2} stroke={stroke} strokeLinejoin="round" strokeWidth={1.35} width={6.2} x={x + 3.2} y={y + 3} />
      <Rect cornerRadius={1.8} fillEnabled={false} height={7.2} stroke={stroke} strokeLinejoin="round" strokeWidth={1.35} width={6.2} x={x + 6} y={y + 5.2} />
    </>
  )
}

function RefreshReplyIcon({ tone = 'default', x, y }: { tone?: 'default' | 'active'; x: number; y: number }) {
  const stroke = tone === 'active' ? '#16a34a' : '#64748b'
  return (
    <>
      <Path
        data={`M ${x + 12.8} ${y + 4.8} A 5 5 0 1 0 ${x + 13.2} ${y + 10.1}`}
        fillEnabled={false}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.35}
      />
      <Path
        data={`M ${x + 10.9} ${y + 2.9} L ${x + 13.4} ${y + 3.1} L ${x + 12.1} ${y + 5.4}`}
        fillEnabled={false}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.35}
      />
    </>
  )
}

function SendMessageIcon({ x, y }: { x: number; y: number }) {
  return (
    <Path
      data={`M ${x} ${y + 3.8} L ${x + 12.6} ${y} L ${x + 8.4} ${y + 11.3} L ${x + 6.2} ${y + 6.8} L ${x} ${y + 3.8} Z`}
      fill="#16a34a"
      stroke="#16a34a"
      strokeLinejoin="round"
      strokeWidth={0.8}
    />
  )
}

function getShortModelLabel(label: string) {
  return label.replace(/\s+Preview$/i, '').slice(0, 14) || 'Model'
}
