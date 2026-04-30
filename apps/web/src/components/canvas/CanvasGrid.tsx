'use client'

import { useId } from 'react'
import type { TLGridProps } from 'tldraw'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'

export function CanvasGrid({ size, x, y, z }: TLGridProps) {
  const id = useId().replace(/:/g, '')
  const { gridColor, gridStyle } = useCanvasSettingsStore((state) => state.settings)
  const step = Math.max(4, size * z)
  const offsetX = getOffset(x * z, step)
  const offsetY = getOffset(y * z, step)
  const opacity = Math.min(0.75, Math.max(0.18, z * 0.45))

  return (
    <svg className="canvas-grid" aria-hidden>
      <defs>
        <pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
          {gridStyle === 'solid' ? (
            <path d={`M ${offsetX} 0 V ${step} M 0 ${offsetY} H ${step}`} stroke={gridColor} strokeWidth={1} />
          ) : (
            <circle cx={offsetX} cy={offsetY} fill={gridColor} r={1.25} />
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </svg>
  )
}

function getOffset(value: number, step: number) {
  const offset = 0.5 + value
  return offset > 0 ? offset % step : step + (offset % step)
}
