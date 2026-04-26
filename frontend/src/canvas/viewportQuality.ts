import type { Viewport } from "@xyflow/react"

const CRISP_ZOOMS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const EPSILON = 0.001

function snapToDevicePixel(value: number) {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  return Math.round(value * dpr) / dpr
}

export function getNearestCrispZoom(zoom: number) {
  return CRISP_ZOOMS.reduce((nearest, candidate) => (
    Math.abs(candidate - zoom) < Math.abs(nearest - zoom) ? candidate : nearest
  ), CRISP_ZOOMS[0])
}

export function getNextCrispZoom(zoom: number, direction: 1 | -1) {
  if (direction > 0) {
    return CRISP_ZOOMS.find((candidate) => candidate > zoom + EPSILON) ?? CRISP_ZOOMS[CRISP_ZOOMS.length - 1]
  }
  return [...CRISP_ZOOMS].reverse().find((candidate) => candidate < zoom - EPSILON) ?? CRISP_ZOOMS[0]
}

export function getCrispViewport(viewport: Viewport): Viewport {
  return {
    x: snapToDevicePixel(viewport.x),
    y: snapToDevicePixel(viewport.y),
    zoom: viewport.zoom,
  }
}

export function isSameViewport(a: Viewport, b: Viewport) {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.zoom - b.zoom) < EPSILON
  )
}
