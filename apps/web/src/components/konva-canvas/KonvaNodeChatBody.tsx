import { useEffect, useMemo, useState } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Group } from 'react-konva'
import { getChatModelDisplayName, getChatModelSelectOptions } from '@/features/ai/mockAiContracts'
import { resolveRuntimeGraphNodeInputs, type RuntimeGraphImageValue } from '@/features/node-runtime/runtimeGraphResolution'
import { getKonvaChatDraft, getKonvaChatMessages, getKonvaChatModelId, getKonvaChatReferenceFiles, getKonvaChatReferenceImages } from './konvaChatNodeActions'
import { KonvaInlineTooltip } from './KonvaInlineTooltip'
import { ConnectedContextStrip, ReferenceStrip } from './KonvaNodeChatReferences'
import { ChatInputBox } from './KonvaNodeChatInput'
import { ChatMessageBubble } from './KonvaNodeChatMessages'
import { ChatScrollbar } from './KonvaNodeChatScrollbar'
import { clamp, getChatMessageLayouts, getShortModelLabel } from './konvaNodeChatBodyLayout'
import type { ChatTooltipState, KonvaNodeChatBodyProps, SetChatTooltipState } from './konvaNodeChatBodyTypes'

type ScopedChatTooltip = null | {
  scope: string
  value: ChatTooltipState
}

export function KonvaNodeChatBody({
  document,
  editingFieldName = null,
  onChatModelChange,
  onChatRegenerate,
  onChatSend,
  onChatUpload,
  onFocusedEditRequest,
  onFocusedEditStateChange,
  onTextEditStart,
  shape,
  zoom,
}: KonvaNodeChatBodyProps) {
  const messages = getKonvaChatMessages(shape.props.data)
  const references = getKonvaChatReferenceImages(shape.props.data)
  const files = getKonvaChatReferenceFiles(shape.props.data)
  const inputResolution = resolveRuntimeGraphNodeInputs(document, shape)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [scopedTooltip, setScopedTooltip] = useState<ScopedChatTooltip>(null)
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
  const tooltipScope = `${editingFieldName ?? ''}:${shape.x}:${shape.y}:${shape.props.width}:${shape.props.height}:${zoom}`
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
  const messageLayouts = useMemo(
    () => getChatMessageLayouts(messages, contentWidth, messageGap),
    [contentWidth, messageGap, messages],
  )
  const maxScroll = Math.max(0, messageLayouts.totalHeight - bodyHeight)
  const [scrollState, setScrollState] = useState(() => ({ messageCount: messages.length, value: maxScroll }))
  const [messageTextScrolls, setMessageTextScrolls] = useState<Record<string, number>>({})
  const scrollY = scrollState.messageCount === messages.length ? scrollState.value : maxScroll
  const visibleScrollY = Math.min(scrollY, maxScroll)
  const visibleMessages = messageLayouts.items.filter(
    (item) =>
      item.y + item.height >= visibleScrollY - 40 &&
      item.y <= visibleScrollY + bodyHeight + 40,
  )
  const setTooltip: SetChatTooltipState = (next) => {
    setScopedTooltip((current) => {
      const currentValue = current?.value ?? null
      const value = typeof next === 'function' ? next(currentValue) : next
      return value ? { scope: tooltipScope, value } : null
    })
  }
  const tooltip = scopedTooltip?.scope === tooltipScope ? scopedTooltip.value : null

  useEffect(() => {
    onFocusedEditStateChange?.(shape.id, 'chat-model-menu', modelMenuOpen)
  }, [modelMenuOpen, onFocusedEditStateChange, shape.id])

  useEffect(() => {
    const hideTooltip = () => setScopedTooltip(null)
    globalThis.document?.addEventListener('pointerdown', hideTooltip, true)
    globalThis.document?.addEventListener('pointercancel', hideTooltip, true)
    globalThis.document?.addEventListener('keydown', hideTooltip, true)
    return () => {
      globalThis.document?.removeEventListener('pointerdown', hideTooltip, true)
      globalThis.document?.removeEventListener('pointercancel', hideTooltip, true)
      globalThis.document?.removeEventListener('keydown', hideTooltip, true)
    }
  }, [])

  useEffect(
    () => () => {
      onFocusedEditStateChange?.(shape.id, 'chat-model-menu', false)
    },
    [onFocusedEditStateChange, shape.id],
  )

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    if (maxScroll <= 0) return
    event.cancelBubble = true
    event.evt.preventDefault()
    setTooltip(null)
    setScrollState((current) => ({
      messageCount: messages.length,
      value: clamp(
        (current.messageCount === messages.length ? current.value : maxScroll) + event.evt.deltaY,
        0,
        maxScroll,
      ),
    }))
  }

  const handleCopyMessage = (text: string) => {
    if (!text.trim() || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
    void navigator.clipboard.writeText(text).catch(() => {})
  }
  const visibleModelMenuOpen = editingFieldName === 'chatDraft' ? false : modelMenuOpen

  return (
    <>
      <ReferenceStrip
        fileCount={files.length}
        imageCount={connectedImageCount}
        promptCount={connectedPromptCount}
        width={viewportWidth}
        x={14}
        y={50}
      />
      <Group clipHeight={bodyHeight} clipWidth={viewportWidth} onWheel={handleWheel} x={14} y={bodyTop}>
        <Group y={-visibleScrollY}>
          {visibleMessages.map((layout) => {
            const messageTextScroll = clamp(
              messageTextScrolls[layout.message.id] ?? 0,
              0,
              layout.textMaxScroll,
            )
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
        height={inputBoxHeight}
        modelLabel={modelLabel}
        modelMenuOpen={visibleModelMenuOpen}
        modelOptions={modelOptions}
        onEdit={() => {
          setModelMenuOpen(false)
          onTextEditStart?.(shape.id, 'chatDraft')
        }}
        onModelSelect={(nextModelId) => {
          onChatModelChange?.(shape.id, nextModelId)
          setModelMenuOpen(false)
          setTooltip(null)
        }}
        onModelToggle={() => {
          setTooltip(null)
          setModelMenuOpen((current) => {
            if (current) return false
            if (onFocusedEditRequest && !onFocusedEditRequest(shape.id, 'chat-model-menu')) return current
            return true
          })
        }}
        onSend={() => {
          setTooltip(null)
          onChatSend?.(shape.id)
        }}
        onTooltipChange={setTooltip}
        onUpload={() => onChatUpload?.(shape.id)}
        width={viewportWidth}
        x={14}
        y={inputY}
      />
      {tooltip ? (
        <KonvaInlineTooltip anchorX={tooltip.anchorX} anchorY={tooltip.anchorY} label={tooltip.label} />
      ) : null}
    </>
  )
}
