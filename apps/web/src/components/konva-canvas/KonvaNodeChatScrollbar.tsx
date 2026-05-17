import { Group, Rect } from 'react-konva'
import { getCanvasThemePalette, useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import { stopNodeCardControlEvent } from './KonvaNodeCardParts'
import { clamp } from './konvaNodeChatBodyLayout'

type ChatScrollbarProps = {
  maxScroll: number
  onScroll: (scrollY: number) => void
  scrollY: number
  width?: number
  trackHeight: number
  x: number
  y: number
}

export function ChatScrollbar({
  maxScroll,
  onScroll,
  scrollY,
  width = 4,
  trackHeight,
  x,
  y,
}: ChatScrollbarProps) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const contentHeight = trackHeight + maxScroll
  const thumbHeight = Math.max(
    28,
    Math.min(trackHeight, (trackHeight * trackHeight) / Math.max(trackHeight, contentHeight)),
  )
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
