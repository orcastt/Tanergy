import { Circle, Line, Rect } from 'react-konva'
import type { CanvasCamera } from '@/features/canvas-engine'
import { defaultCanvasSettings, useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import { getCanvasThemePalette, useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'

type KonvaCanvasBackgroundProps = {
  camera: CanvasCamera
  height: number
  width: number
}

export function KonvaCanvasBackground({ camera, height, width }: KonvaCanvasBackgroundProps) {
  const settings = useCanvasSettingsStore((state) => state.settings)
  const themeMode = useResolvedCanvasThemeMode()
  const palette = getCanvasThemePalette(themeMode)
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1
  const minX = -camera.x / zoom
  const minY = -camera.y / zoom
  const maxX = minX + width / zoom
  const maxY = minY + height / zoom
  const gridStep = getGridStep(settings.gridUnit, zoom, settings.backgroundStyle === 'dots' ? 18 : 12)

  return (
    <>
      <Rect fill={getBackgroundColor(settings.backgroundColor, themeMode, palette.canvasBackground)} height={maxY - minY} width={maxX - minX} x={minX} y={minY} />
      {settings.backgroundStyle === 'grid' ? renderGridLines(minX, minY, maxX, maxY, gridStep, zoom, palette.gridLine) : null}
      {settings.backgroundStyle === 'dots' ? renderGridDots(minX, minY, maxX, maxY, gridStep, zoom, palette.gridDot) : null}
    </>
  )
}

function getGridStep(gridUnit: number, zoom: number, minScreenStep: number) {
  const baseStep = Math.max(8, gridUnit)
  const multiplier = Math.max(1, Math.ceil(minScreenStep / Math.max(1, baseStep * zoom)))
  return baseStep * multiplier
}

function renderGridLines(minX: number, minY: number, maxX: number, maxY: number, step: number, zoom: number, stroke: string) {
  const lines = []
  const strokeWidth = 1 / zoom
  for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
    lines.push(<Line key={`x:${x}`} listening={false} points={[x, minY, x, maxY]} stroke={stroke} strokeWidth={strokeWidth} />)
  }
  for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
    lines.push(<Line key={`y:${y}`} listening={false} points={[minX, y, maxX, y]} stroke={stroke} strokeWidth={strokeWidth} />)
  }
  return lines
}

function renderGridDots(minX: number, minY: number, maxX: number, maxY: number, initialStep: number, zoom: number, fill: string) {
  let step = initialStep
  while (((maxX - minX) / step) * ((maxY - minY) / step) > 6000) step *= 2

  const dots = []
  const radius = 0.85 / zoom
  for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
    for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
      dots.push(<Circle key={`${x}:${y}`} fill={fill} listening={false} radius={radius} x={x} y={y} />)
    }
  }
  return dots
}

function getBackgroundColor(value: string, themeMode: string, darkFallback: string) {
  if (themeMode === 'dark' && value === defaultCanvasSettings.backgroundColor) return darkFallback
  return value
}
