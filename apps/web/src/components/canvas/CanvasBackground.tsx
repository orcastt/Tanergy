'use client'

import type { CSSProperties } from 'react'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'

export function CanvasBackground() {
  const settings = useCanvasSettingsStore((state) => state.settings)
  const style: CSSProperties = { backgroundColor: settings.backgroundColor }

  return <div className="tl-background canvas-background-surface" style={style} />
}
