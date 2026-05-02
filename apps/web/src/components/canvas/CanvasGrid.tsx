'use client'

import { useId } from 'react'
import type { TLGridProps } from 'tldraw'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'

export function CanvasGrid({ size, x, y, z }: TLGridProps) {
  const patternId = useSafeSvgId('canvas-grid')
  const backgroundStyle = useCanvasSettingsStore((state) => state.settings.backgroundStyle)

  if (backgroundStyle === 'solid') return null

  const step = Math.max(6, size * z)
  const offsetX = modulo(0.5 + x * z, step)
  const offsetY = modulo(0.5 + y * z, step)

  return (
    <svg className="tl-grid canvas-grid-surface" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id={patternId} width={step} height={step} patternUnits="userSpaceOnUse">
          {backgroundStyle === 'dots' ? (
            <circle cx={offsetX} cy={offsetY} r={0.85} fill="rgba(88, 98, 112, 0.16)" />
          ) : (
            <>
              <path d={`M ${offsetX} 0 V ${step}`} stroke="rgba(88, 98, 112, 0.08)" strokeWidth="1" />
              <path d={`M 0 ${offsetY} H ${step}`} stroke="rgba(88, 98, 112, 0.08)" strokeWidth="1" />
            </>
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

function useSafeSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`
}

function modulo(value: number, step: number) {
  const remainder = value % step
  return remainder >= 0 ? remainder : remainder + step
}
