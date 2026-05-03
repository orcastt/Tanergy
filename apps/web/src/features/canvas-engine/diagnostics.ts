import type { CanvasDocument, CanvasShape } from './types'

export type CanvasFrameSample = {
  frameTimeMs: number
  recordedAt: number
}

export type CanvasFrameDiagnostics = {
  averageFrameTimeMs: number
  maxFrameTimeMs: number
  minFrameTimeMs: number
  sampleCount: number
}

export type CanvasObjectCounts = {
  arrowCount: number
  cloudCount: number
  diamondCount: number
  ellipseCount: number
  frameCount: number
  imageCount: number
  lineCount: number
  rectCount: number
  stickyCount: number
  shapeCount: number
  strokeCount: number
  textCount: number
  triangleCount: number
}

export type CanvasDiagnosticsSnapshot = CanvasFrameDiagnostics & CanvasObjectCounts

export function createFrameSample(frameStartMs: number, frameEndMs: number = performanceNow()): CanvasFrameSample {
  return {
    frameTimeMs: Math.max(0, frameEndMs - frameStartMs),
    recordedAt: frameEndMs,
  }
}

export function getFrameDiagnostics(samples: CanvasFrameSample[]): CanvasFrameDiagnostics {
  if (samples.length === 0) {
    return {
      averageFrameTimeMs: 0,
      maxFrameTimeMs: 0,
      minFrameTimeMs: 0,
      sampleCount: 0,
    }
  }

  let total = 0
  let max = -Infinity
  let min = Infinity

  for (const sample of samples) {
    total += sample.frameTimeMs
    max = Math.max(max, sample.frameTimeMs)
    min = Math.min(min, sample.frameTimeMs)
  }

  return {
    averageFrameTimeMs: total / samples.length,
    maxFrameTimeMs: max,
    minFrameTimeMs: min,
    sampleCount: samples.length,
  }
}

export function appendFrameSample(
  samples: CanvasFrameSample[],
  sample: CanvasFrameSample,
  maxSamples = 120
): CanvasFrameSample[] {
  const nextSamples = [...samples, sample]
  return nextSamples.slice(Math.max(0, nextSamples.length - maxSamples))
}

export function getCanvasObjectCounts(document: CanvasDocument): CanvasObjectCounts {
  return getShapeObjectCounts(document.shapes)
}

export function getShapeObjectCounts(shapes: CanvasShape[]): CanvasObjectCounts {
  return shapes.reduce<CanvasObjectCounts>((counts, shape) => {
    counts.shapeCount += 1
    if (shape.type === 'arrow') counts.arrowCount += 1
    if (shape.type === 'cloud') counts.cloudCount += 1
    if (shape.type === 'diamond') counts.diamondCount += 1
    if (shape.type === 'ellipse') counts.ellipseCount += 1
    if (shape.type === 'frame') counts.frameCount += 1
    if (shape.type === 'image') counts.imageCount += 1
    if (shape.type === 'line') counts.lineCount += 1
    if (shape.type === 'rect') counts.rectCount += 1
    if (shape.type === 'sticky') counts.stickyCount += 1
    if (shape.type === 'stroke') counts.strokeCount += 1
    if (shape.type === 'text') counts.textCount += 1
    if (shape.type === 'triangle') counts.triangleCount += 1
    return counts
  }, {
    arrowCount: 0,
    cloudCount: 0,
    diamondCount: 0,
    ellipseCount: 0,
    frameCount: 0,
    imageCount: 0,
    lineCount: 0,
    rectCount: 0,
    shapeCount: 0,
    stickyCount: 0,
    strokeCount: 0,
    textCount: 0,
    triangleCount: 0,
  })
}

export function getCanvasDiagnosticsSnapshot(
  document: CanvasDocument,
  frameSamples: CanvasFrameSample[] = []
): CanvasDiagnosticsSnapshot {
  return {
    ...getFrameDiagnostics(frameSamples),
    ...getCanvasObjectCounts(document),
  }
}

function performanceNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}
