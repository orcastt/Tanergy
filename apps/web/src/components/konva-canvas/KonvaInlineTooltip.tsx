'use client'

import { Group, Rect, Text } from 'react-konva'

type KonvaInlineTooltipProps = {
  anchorX: number
  anchorY: number
  label: string
}

const tooltipHeight = 24
const tooltipHorizontalPadding = 9
const tooltipRadius = 6

export function KonvaInlineTooltip({ anchorX, anchorY, label }: KonvaInlineTooltipProps) {
  const width = getTooltipWidth(label)
  const x = anchorX - width / 2
  const y = anchorY - tooltipHeight - 8

  return (
    <Group listening={false}>
      <Rect
        cornerRadius={tooltipRadius}
        fill="#111827"
        height={tooltipHeight}
        opacity={0.98}
        shadowBlur={12}
        shadowColor="rgba(15, 23, 42, 0.18)"
        shadowOffsetY={5}
        width={width}
        x={x}
        y={y}
      />
      <Text
        align="center"
        fill="#ffffff"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={12}
        fontStyle="bold"
        height={tooltipHeight}
        text={label}
        verticalAlign="middle"
        width={width}
        x={x}
        y={y}
      />
    </Group>
  )
}

function getTooltipWidth(label: string) {
  const units = Array.from(label).reduce((total, char) => total + (/[\u3400-\u9fff\uff00-\uffef]/.test(char) ? 1.7 : 0.95), 0)
  return Math.max(48, Math.min(240, Math.round(units * 6.2 + tooltipHorizontalPadding * 2)))
}
