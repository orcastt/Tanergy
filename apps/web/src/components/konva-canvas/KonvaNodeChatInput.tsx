import { Group, Path, Rect, Text } from 'react-konva'
import { getCanvasThemePalette, useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import { konvaChatDraftPlaceholder } from './konvaChatNodeActions'
import { stopNodeCardControlEvent } from './KonvaNodeCardParts'
import type { SetChatTooltipState } from './konvaNodeChatBodyTypes'

type ChatInputBoxProps = {
  draft: string
  editing: boolean
  height: number
  modelLabel: string
  modelMenuOpen: boolean
  modelOptions: Array<{ disabled?: boolean; label: string; value: string | number }>
  onEdit: () => void
  onModelSelect: (modelId: string) => void
  onModelToggle: () => void
  onSend: () => void
  onTooltipChange: SetChatTooltipState
  onUpload: () => void
  width: number
  x: number
  y: number
}

export function ChatInputBox({
  draft,
  editing,
  height,
  modelLabel,
  modelMenuOpen,
  modelOptions,
  onEdit,
  onModelSelect,
  onModelToggle,
  onSend,
  onTooltipChange,
  onUpload,
  width,
  x,
  y,
}: ChatInputBoxProps) {
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
        onDblClick={stopNodeCardControlEvent}
        onMouseEnter={() =>
          onTooltipChange({
            anchorX: x + width - buttonWidth / 2 - 12,
            anchorY: toolbarY,
            id: 'chat-send',
            label: 'Send message',
          })
        }
        onMouseLeave={() =>
          onTooltipChange((current) => (current && current.id === 'chat-send' ? null : current))
        }
        onPointerDown={stopNodeCardControlEvent}
      >
        <Rect
          cornerRadius={999}
          fill="#dcfce7"
          height={22}
          stroke="#22c55e"
          strokeWidth={1}
          width={buttonWidth}
          x={x + width - buttonWidth - 12}
          y={toolbarY}
        />
        <SendMessageIcon x={x + width - buttonWidth - 4} y={toolbarY + 4} />
      </Group>
    </Group>
  )
}

type ChatModelMenuProps = {
  onSelect: (modelId: string) => void
  options: Array<{ disabled?: boolean; label: string; value: string | number }>
  width: number
  x: number
  y: number
}

function ChatModelMenu({ onSelect, options, width, x, y }: ChatModelMenuProps) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  return (
    <Group>
      <Rect
        cornerRadius={10}
        fill={palette.dropdownBg}
        height={options.length * 30 + 8}
        shadowBlur={14}
        shadowColor={palette.nodeShadow}
        shadowOffsetY={6}
        stroke={palette.fieldStroke}
        strokeWidth={1}
        width={width}
        x={x}
        y={y}
      />
      {options.map((option, index) => (
        <Group
          key={String(option.value)}
          onClick={
            option.disabled
              ? undefined
              : (event) => {
                  event.cancelBubble = true
                  onSelect(String(option.value))
                }
          }
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
