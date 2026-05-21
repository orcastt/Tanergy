export type BoardCanvasEngine = 'konva'

export function detectBoardCanvasEngine(document: unknown): BoardCanvasEngine | null {
  if (!document || typeof document !== 'object') return null
  const candidate = document as {
    canvasDocument?: unknown
    renderer?: unknown
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
  return null
}

export function parseBoardCanvasEngine(value: string | null): BoardCanvasEngine | null {
  return value === 'konva' ? value : null
}

export function getDefaultBoardCanvasEngine(): BoardCanvasEngine {
  return 'konva'
}
