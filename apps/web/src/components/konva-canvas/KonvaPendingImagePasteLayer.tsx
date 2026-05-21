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
      {items.map((item) => {
        const previewInset = 12
        const progressInset = 16
        const progressY = item.height - 18
        const previewHeight = Math.max(56, progressY - previewInset - 14)
        const previewWidth = item.width - previewInset * 2
        const previewBottom = previewInset + previewHeight
        const metaPlateY = Math.max(previewInset + 18, previewBottom - 44)

        return (
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
              fillLinearGradientEndPoint={{ x: previewWidth, y: previewHeight }}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              height={previewHeight}
              opacity={0.92}
              width={previewWidth}
              x={previewInset}
              y={previewInset}
            />
            <Rect
              cornerRadius={10}
              fill="rgba(255, 255, 255, 0.18)"
              height={Math.max(28, previewHeight - 26)}
              opacity={0.36}
              width={Math.max(36, previewWidth - 24)}
              x={previewInset + 12}
              y={previewInset + 12}
            />
            <Rect
              cornerRadius={12}
              fill={item.status === 'failed' ? 'rgba(255, 241, 242, 0.82)' : 'rgba(255, 255, 255, 0.68)'}
              height={38}
              width={item.width - 32}
              x={16}
              y={metaPlateY}
            />
            <Text
              fill={item.status === 'failed' ? '#b91c1c' : '#0f172a'}
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={14}
              fontStyle="600"
              height={22}
              text={item.status === 'failed' ? 'Paste failed' : 'Pasting image'}
              width={item.width - 40}
              x={20}
              y={metaPlateY + 6}
            />
            <Text
              fill={item.status === 'failed' ? 'rgba(185, 28, 28, 0.74)' : 'rgba(71, 85, 105, 0.84)'}
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={11}
              height={16}
              text={item.detail ?? (item.status === 'failed' ? 'Please try again.' : `${Math.max(1, Math.round(clamp(item.progress, 0, 1) * 100))}%`)}
              width={item.width - 40}
              x={20}
              y={metaPlateY + 23}
            />
            <Rect
              cornerRadius={999}
              fill="rgba(148, 163, 184, 0.16)"
              height={8}
              width={item.width - progressInset * 2}
              x={progressInset}
              y={progressY}
            />
            <Rect
              cornerRadius={999}
              fill={item.status === 'failed' ? '#ef4444' : '#6b5cff'}
              height={8}
              width={Math.max(10, (item.width - progressInset * 2) * clamp(item.progress, 0, 1))}
              x={progressInset}
              y={progressY}
            />
          </Group>
        )
      })}
    </>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
