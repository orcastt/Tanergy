import { useMemo, useState } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Group, Line, Rect, Text } from 'react-konva'
import type { CanvasNodeShape } from '@/features/canvas-engine'
import { canRunNodeType } from '@/features/node-runtime/registry'
import type { JsonObject, NodeCardField } from '@/types/nodeRuntime'

export function NodeCardStatusBadge({ shape, status, tone }: { shape: CanvasNodeShape; status: string; tone: { fill: string; stroke: string; text: string } }) {
  return (
    <>
      <Rect cornerRadius={10} fill={tone.fill} height={20} stroke={tone.stroke} strokeWidth={1} width={82} x={shape.props.width - 96} y={14} />
      <Text align="center" fill={tone.text} fontFamily="Inter, system-ui, sans-serif" fontSize={10} fontStyle="bold" height={20} text={status.toUpperCase()} verticalAlign="middle" width={82} x={shape.props.width - 96} y={14} />
    </>
  )
}

export function NodeCardRunButton({ onRunToggle, shape, status }: { onRunToggle?: (shapeId: string) => void; shape: CanvasNodeShape; status: string }) {
  const running = status === 'running'
  const width = running ? 70 : 58
  const x = shape.props.width - width - 14
  return (
    <Group
      onClick={(event) => {
        event.cancelBubble = true
        onRunToggle?.(shape.id)
      }}
      onDblClick={stopNodeCardControlEvent}
      onPointerDown={stopNodeCardControlEvent}
    >
      <Rect cornerRadius={8} fill={running ? '#dc2626' : '#111827'} height={24} width={width} x={x} y={12} />
      {running ? <Rect fill="#ffffff" height={8} width={8} x={x + 10} y={20} /> : <Line closed fill="#ffffff" points={[x + 10, 18, x + 10, 28, x + 18, 23]} />}
      <Text fill="#ffffff" fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" height={24} text={running ? 'Stop' : 'Run'} verticalAlign="middle" width={width - 24} x={x + 24} y={12} />
    </Group>
  )
}

export function NodeCardFieldGrid({ fields, onFieldChange, openFieldName, setOpenFieldName, shape, y }: {
  fields: NodeCardField[]
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  openFieldName: string | null
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
  y: number
}) {
  const layouts = fields.map((field, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const gap = 14
    const width = (shape.props.width - 28 - gap) / 2
    const x = 14 + column * (width + gap)
    const top = y + row * 62
    return { field, open: openFieldName === field.name, top, width, x }
  })

  return (
    <>
      {layouts.map(({ field, open, top, width, x }) => {
        return (
          <Group key={field.name}>
            <Group
              onClick={field.options ? (event) => {
                event.cancelBubble = true
                setOpenFieldName(open ? null : field.name)
              } : undefined}
              onDblClick={stopNodeCardControlEvent}
              onPointerDown={stopNodeCardControlEvent}
            >
              <Text fill="#475569" fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" text={getFieldLabel(field)} width={width} x={x} y={top} />
              <Rect cornerRadius={10} fill="#f8fafc" height={34} stroke="#dce3ec" strokeWidth={1} width={width} x={x} y={top + 15} />
              <Text fill="#1f2937" fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text={getFieldDisplayValue(field, shape.props.data)} width={width - 24} x={x + 12} y={top + 25} />
              {field.options ? <Text align="right" fill="#475569" fontFamily="Inter, system-ui, sans-serif" fontSize={12} text="v" width={16} x={x + width - 24} y={top + 24} /> : null}
            </Group>
          </Group>
        )
      })}
      {layouts.map(({ field, open, top, width, x }) => (
        open && field.options ? (
          <NodeCardFieldDropdown field={field} key={`${field.name}:dropdown`} onFieldChange={onFieldChange} setOpenFieldName={setOpenFieldName} shape={shape} width={width} x={x} y={top + 54} />
        ) : null
      ))}
    </>
  )
}

export function NodeCardTextBox({
  height,
  onEdit,
  text,
  width,
  x,
  y,
}: {
  height: number
  onEdit?: () => void
  text: string
  width: number
  x: number
  y: number
}) {
  const viewport = useMemo(() => ({
    height: Math.max(0, height - 28),
    width: Math.max(0, width - 22),
    x: x + 11,
    y: y + 14,
  }), [height, width, x, y])
  const contentHeight = useMemo(() => estimateWrappedTextHeight(text, viewport.width), [text, viewport.width])
  const maxScroll = Math.max(0, contentHeight - viewport.height)
  const [scrollY, setScrollY] = useState(0)
  const visibleScrollY = Math.min(scrollY, maxScroll)
  const scrollbar = getTextBoxScrollbar({ contentHeight, maxScroll, scrollY: visibleScrollY, viewport, width, x, y })

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    if (maxScroll <= 0) return
    event.cancelBubble = true
    event.evt.preventDefault()
    setScrollY((current) => clamp(Math.min(current, maxScroll) + event.evt.deltaY, 0, maxScroll))
  }

  return (
    <>
      <Group
        onClick={onEdit ? (event) => {
          event.cancelBubble = true
          onEdit()
        } : undefined}
        onDblClick={onEdit ? stopNodeCardControlEvent : undefined}
        onPointerDown={onEdit ? stopNodeCardControlEvent : undefined}
      >
        <Rect cornerRadius={10} fill="#f8fafc" height={height} stroke="#dce3ec" strokeWidth={1} width={width} x={x} y={y} />
      </Group>
      <Group
        clipHeight={viewport.height}
        clipWidth={viewport.width}
        clipX={viewport.x}
        clipY={viewport.y}
        onClick={onEdit ? (event) => {
          event.cancelBubble = true
          onEdit()
        } : undefined}
        onPointerDown={onEdit ? stopNodeCardControlEvent : undefined}
        onWheel={handleWheel}
      >
        <Text fill="#1f2937" fontFamily="Inter, system-ui, sans-serif" fontSize={13} height={contentHeight} lineHeight={1.35} text={text} width={viewport.width} wrap="char" x={viewport.x} y={viewport.y - visibleScrollY} />
      </Group>
      {scrollbar ? (
        <>
          <Rect cornerRadius={999} fill="rgba(148, 163, 184, 0.22)" height={scrollbar.trackHeight} width={4} x={scrollbar.x} y={scrollbar.trackY} />
          <Rect cornerRadius={999} fill="#94a3b8" height={scrollbar.thumbHeight} width={4} x={scrollbar.x} y={scrollbar.thumbY} />
        </>
      ) : null}
    </>
  )
}

export function NodeCardImageSlots({ count, height, shape, y }: { count: number; height: number; shape: CanvasNodeShape; y: number }) {
  const slotWidth = count === 4 ? (shape.props.width - 38) / 2 : shape.props.width - 28
  const slotHeight = count === 4 ? (height - 8) / 2 : height
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Group key={index}>
          <Rect cornerRadius={10} fill="#e8eef5" height={slotHeight} width={slotWidth} x={14 + (index % 2) * (slotWidth + 10)} y={y + Math.floor(index / 2) * (slotHeight + 8)} />
          <Text align="center" fill="#64748b" fontFamily="Inter, system-ui, sans-serif" fontSize={12} fontStyle="bold" text={String(index + 1)} width={slotWidth} x={14 + (index % 2) * (slotWidth + 10)} y={y + Math.floor(index / 2) * (slotHeight + 8) + slotHeight / 2 - 6} />
        </Group>
      ))}
    </>
  )
}

export function canRunNode(shape: CanvasNodeShape) {
  return canRunNodeType(shape.props.nodeType)
}

function NodeCardFieldDropdown({
  field,
  onFieldChange,
  setOpenFieldName,
  shape,
  width,
  x,
  y,
}: {
  field: NodeCardField
  onFieldChange?: (shapeId: string, fieldName: string, value: string | number) => void
  setOpenFieldName: (fieldName: string | null) => void
  shape: CanvasNodeShape
  width: number
  x: number
  y: number
}) {
  const options = field.options ?? []
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === shape.props.data[field.name]))
  const maxVisibleOptions = 9
  const maxScrollIndex = Math.max(0, options.length - maxVisibleOptions)
  const [scrollIndex, setScrollIndex] = useState(() => clamp(selectedIndex - 2, 0, maxScrollIndex))
  const visibleOptions = options.slice(scrollIndex, scrollIndex + maxVisibleOptions)
  const dropdownHeight = visibleOptions.length * 30 + 8
  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    if (maxScrollIndex <= 0) return
    event.cancelBubble = true
    event.evt.preventDefault()
    const delta = event.evt.deltaY > 0 ? 1 : -1
    setScrollIndex((current) => clamp(current + delta, 0, maxScrollIndex))
  }
  return (
    <Group onWheel={handleWheel}>
      <Rect cornerRadius={10} fill="#ffffff" height={dropdownHeight} shadowBlur={14} shadowColor="rgba(15,23,42,0.18)" shadowOffsetY={6} stroke="#dce3ec" strokeWidth={1} width={width} x={x} y={y} />
      {visibleOptions.map((option, index) => {
        const selected = option.value === shape.props.data[field.name]
        return (
          <Group
            key={option.value}
            onClick={(event) => {
              event.cancelBubble = true
              onFieldChange?.(shape.id, field.name, option.value)
              setOpenFieldName(null)
            }}
            onDblClick={stopNodeCardControlEvent}
            onPointerDown={stopNodeCardControlEvent}
          >
            <Rect cornerRadius={7} fill={selected ? '#eef2ff' : '#ffffff'} height={26} width={width - 8} x={x + 4} y={y + 4 + index * 30} />
            <Text fill={selected ? '#4338ca' : '#1f2937'} fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontStyle="bold" height={26} text={option.label} verticalAlign="middle" width={width - 20} x={x + 12} y={y + 4 + index * 30} />
          </Group>
        )
      })}
      {maxScrollIndex > 0 ? (
        <>
          <Rect cornerRadius={999} fill="rgba(148,163,184,0.22)" height={dropdownHeight - 16} width={4} x={x + width - 10} y={y + 8} />
          <Rect cornerRadius={999} fill="#94a3b8" height={Math.max(22, (dropdownHeight - 16) * visibleOptions.length / options.length)} width={4} x={x + width - 10} y={y + 8 + ((dropdownHeight - 16) - Math.max(22, (dropdownHeight - 16) * visibleOptions.length / options.length)) * (scrollIndex / maxScrollIndex)} />
        </>
      ) : null}
    </Group>
  )
}

export function stopNodeCardControlEvent(event: KonvaEventObject<Event>) {
  event.cancelBubble = true
}

function getFieldDisplayValue(field: NodeCardField, data: JsonObject) {
  const value = data[field.name]
  const option = field.options?.find((item) => item.value === value)
  if (option) return option.label
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function getFieldLabel(field: NodeCardField) {
  if (field.name === 'aspectRatio') return 'Aspect'
  if (field.name === 'imageSize') return 'Image'
  return field.label
}

function estimateWrappedTextHeight(text: string, width: number) {
  const fontSize = 13
  const lineHeight = 1.35
  const lineWidthUnits = Math.max(1, width / fontSize)
  const lines = text.split('\n').reduce((total, line) => {
    const units = Math.max(1, getVisualTextUnits(line))
    return total + Math.max(1, Math.ceil(units / lineWidthUnits))
  }, 0)
  return Math.max(fontSize * lineHeight, lines * fontSize * lineHeight)
}

function getVisualTextUnits(text: string) {
  return Array.from(text).reduce((total, char) => {
    if (/\s/.test(char)) return total + 0.35
    if (/[\u3400-\u9fff\uff00-\uffef]/.test(char)) return total + 1
    if (/[A-Z0-9]/.test(char)) return total + 0.68
    return total + 0.56
  }, 0)
}

function getTextBoxScrollbar({
  contentHeight,
  maxScroll,
  scrollY,
  viewport,
  width,
  x,
  y,
}: {
  contentHeight: number
  maxScroll: number
  scrollY: number
  viewport: { height: number; width: number; x: number; y: number }
  width: number
  x: number
  y: number
}) {
  if (maxScroll <= 0 || viewport.height <= 0) return null
  const trackHeight = Math.max(18, viewport.height - 4)
  const thumbHeight = Math.max(18, trackHeight * viewport.height / Math.max(contentHeight, viewport.height))
  const travel = Math.max(1, trackHeight - thumbHeight)
  const ratio = maxScroll > 0 ? scrollY / maxScroll : 0
  return {
    thumbHeight,
    thumbY: y + 16 + travel * ratio,
    trackHeight,
    trackY: y + 16,
    x: x + width - 10,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
