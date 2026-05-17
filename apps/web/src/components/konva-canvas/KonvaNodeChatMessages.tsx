import { useState, type ReactNode } from 'react'
import { Group, Path, Rect, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { getCanvasThemePalette, useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import { ChatScrollbar } from './KonvaNodeChatScrollbar'
import { clamp, type ChatMessageLayout } from './konvaNodeChatBodyLayout'
import type { SetChatTooltipState } from './konvaNodeChatBodyTypes'
import { stopNodeCardControlEvent } from './KonvaNodeCardParts'

type ChatMessageBubbleProps = {
  bodyTop: number
  layout: ChatMessageLayout
  onCopyMessage: (text: string) => void
  onRegenerate?: (shapeId: string, messageId: string) => void
  onTextScroll: (scrollY: number) => void
  onTooltipChange: SetChatTooltipState
  scrollY: number
  shapeId: string
  visibleScrollY: number
}

export function ChatMessageBubble({
  bodyTop,
  layout,
  onCopyMessage,
  onRegenerate,
  onTextScroll,
  onTooltipChange,
  scrollY,
  shapeId,
  visibleScrollY,
}: ChatMessageBubbleProps) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const hasOverflow = layout.textMaxScroll > 0
  const textClipWidth = hasOverflow ? layout.textViewportWidth - 6 : layout.textViewportWidth

  const handleTextWheel = (event: KonvaEventObject<WheelEvent>) => {
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
      <Group
        clipHeight={layout.textViewportHeight}
        clipWidth={textClipWidth}
        clipX={10}
        clipY={12}
        onWheel={handleTextWheel}
      >
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
            tooltipAnchor={{
              x: 14 + layout.x + 18,
              y: bodyTop + layout.y - visibleScrollY + layout.height - 30,
            }}
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
            tooltipAnchor={{
              x: 14 + layout.x + 44,
              y: bodyTop + layout.y - visibleScrollY + layout.height - 30,
            }}
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

type MessageActionButtonProps = {
  actionId: string
  ariaLabel: string
  children: (tone: 'active' | 'default') => ReactNode
  onClick?: () => void
  onTooltipChange: SetChatTooltipState
  tooltipAnchor: { x: number; y: number }
  tooltipLabel: string
  x: number
  y: number
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
}: MessageActionButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  return (
    <Group
      aria-label={ariaLabel}
      onClick={(event) => {
        event.cancelBubble = true
        onClick?.()
      }}
      onDblClick={stopNodeCardControlEvent}
      onMouseEnter={() =>
        onTooltipChange({
          anchorX: tooltipAnchor.x,
          anchorY: tooltipAnchor.y,
          id: actionId,
          label: tooltipLabel,
        })
      }
      onMouseLeave={() => {
        setIsPressed(false)
        onTooltipChange((current) => (current && current.id === actionId ? null : current))
      }}
      onPointerDown={(event) => {
        event.cancelBubble = true
        setIsPressed(true)
      }}
      onPointerUp={() => setIsPressed(false)}
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
      <Rect
        cornerRadius={1.8}
        fillEnabled={false}
        height={7.2}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={1.35}
        width={6.2}
        x={x + 3.2}
        y={y + 3}
      />
      <Rect
        cornerRadius={1.8}
        fillEnabled={false}
        height={7.2}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={1.35}
        width={6.2}
        x={x + 6}
        y={y + 5.2}
      />
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
