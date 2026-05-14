import { Group, Rect, Text } from 'react-konva'
import type { CanvasPoint } from '@/features/canvas-engine'

export type KonvaPendingImagePaste = {
  center: CanvasPoint
  detail?: string
  height: number
  id: string
  pageId: string
  progress: number
  status: 'failed' | 'pending'
  width: number
}

type KonvaPendingImagePasteLayerProps = {
  items: readonly KonvaPendingImagePaste[]
}

export function KonvaPendingImagePasteLayer({ items }: KonvaPendingImagePasteLayerProps) {
  if (items.length === 0) return null
  return (
    <>
      {items.map((item) => (
        <Group key={item.id} listening={false} x={item.center.x - item.width / 2} y={item.center.y - item.height / 2}>
          <Rect
            cornerRadius={16}
            fill="rgba(241, 245, 249, 0.96)"
            height={item.height}
            shadowBlur={14}
            shadowColor="rgba(15, 23, 42, 0.16)"
            shadowOffsetY={5}
            stroke={item.status === 'failed' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(100, 116, 139, 0.24)'}
            strokeWidth={1}
            width={item.width}
          />
          <Rect
            cornerRadius={12}
            fillLinearGradientColorStops={item.status === 'failed'
              ? [0, 'rgba(248, 113, 113, 0.24)', 0.5, 'rgba(251, 191, 36, 0.18)', 1, 'rgba(251, 191, 36, 0.08)']
              : [0, 'rgba(107, 92, 255, 0.22)', 0.48, 'rgba(255, 122, 89, 0.20)', 1, 'rgba(168, 216, 196, 0.22)']
            }
            fillLinearGradientEndPoint={{ x: item.width, y: item.height * 0.56 }}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            height={item.height * 0.58}
            opacity={0.92}
            width={item.width - 24}
            x={12}
            y={12}
          />
          <Rect
            cornerRadius={10}
            fill="rgba(255, 255, 255, 0.18)"
            height={item.height * 0.58 - 20}
            opacity={0.36}
            width={item.width - 52}
            x={26}
            y={22}
          />
          <Text
            fill={item.status === 'failed' ? '#b91c1c' : '#0f172a'}
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={14}
            fontStyle="600"
            height={22}
            text={item.status === 'failed' ? 'Paste failed' : 'Pasting image'}
            width={item.width - 32}
            x={16}
            y={item.height * 0.58 + 10}
          />
          <Text
            fill={item.status === 'failed' ? 'rgba(185, 28, 28, 0.74)' : 'rgba(71, 85, 105, 0.84)'}
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={11}
            height={16}
            text={item.detail ?? (item.status === 'failed' ? 'Please try again.' : `${Math.max(1, Math.round(clamp(item.progress, 0, 1) * 100))}%`)}
            width={item.width - 32}
            x={16}
            y={item.height * 0.58 + 29}
          />
          <Rect
            cornerRadius={999}
            fill="rgba(148, 163, 184, 0.16)"
            height={8}
            width={item.width - 32}
            x={16}
            y={item.height - 18}
          />
          <Rect
            cornerRadius={999}
            fill={item.status === 'failed' ? '#ef4444' : '#6b5cff'}
            height={8}
            width={Math.max(10, (item.width - 32) * clamp(item.progress, 0, 1))}
            x={16}
            y={item.height - 18}
          />
        </Group>
      ))}
    </>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
