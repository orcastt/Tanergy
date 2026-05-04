export type BoardCanvasEngine = 'konva' | 'tldraw'

export function detectBoardCanvasEngine(document: unknown): BoardCanvasEngine | null {
  if (!document || typeof document !== 'object') return null
  const candidate = document as {
    camera?: unknown
    canvasDocument?: unknown
    renderer?: unknown
    runtimeEdges?: unknown
    shapes?: unknown
    version?: unknown
  }
  if (
    candidate.version === 2 &&
    candidate.renderer === 'konva' &&
    candidate.canvasDocument &&
    typeof candidate.canvasDocument === 'object'
  ) {
    return 'konva'
  }
  if (
    candidate.version === 1 &&
    Array.isArray(candidate.shapes) &&
    Array.isArray(candidate.runtimeEdges) &&
    candidate.camera &&
    typeof candidate.camera === 'object'
  ) {
    return 'tldraw'
  }
  return null
}

export function parseBoardCanvasEngine(value: string | null): BoardCanvasEngine | null {
  return value === 'konva' || value === 'tldraw' ? value : null
}

export function getDefaultBoardCanvasEngine(): BoardCanvasEngine {
  return process.env.NEXT_PUBLIC_BOARD_CANVAS_ENGINE === 'tldraw' ? 'tldraw' : 'konva'
}
