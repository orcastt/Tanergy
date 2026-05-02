'use client'

import { useId } from 'react'
import type { TLGridProps } from 'tldraw'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'

export function CanvasGrid({ size, x, y, z }: TLGridProps) {
  const id = useId().replace(/:/g, '')
  const { backgroundStyle, gridColor } = useCanvasSettingsStore((state) => state.settings)
  if (backgroundStyle === 'solid') return null

  const step = Math.max(4, size * z)
  const offsetX = getOffset(x * z, step)
  const offsetY = getOffset(y * z, step)
  const opacity = backgroundStyle === 'dots'
    ? Math.min(0.36, Math.max(0.14, z * 0.18))
    : Math.min(0.46, Math.max(0.16, z * 0.28))
  const dotRadius = Math.min(0.62, Math.max(0.38, z * 0.48))

  return (
    <svg className="canvas-grid" aria-hidden>
      <defs>
        <pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
          {backgroundStyle === 'grid' ? (
            <path d={`M ${offsetX} 0 V ${step} M 0 ${offsetY} H ${step}`} stroke={gridColor} strokeWidth={1} />
          ) : (
            <circle cx={offsetX} cy={offsetY} fill={gridColor} r={dotRadius} />
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
