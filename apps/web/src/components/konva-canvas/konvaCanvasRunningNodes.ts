import { withCanvasRuntimeEdges, withCanvasShapes, type CanvasDocument, type CanvasNodeShape } from '@/features/canvas-engine'

export function hasRunningKonvaNodes(document: CanvasDocument) {
  return document.shapes.some((shape) => (
    shape.type === 'node_card' && shape.props.runtimeSummary.status === 'running'
  ))
}

export function sanitizeKonvaHistoryDocument(document: CanvasDocument) {
  if (!hasRunningKonvaNodes(document)) return document
  return withCanvasRuntimeEdges(withCanvasShapes(document, document.shapes.map(sanitizeRunningShape)), document.runtimeEdges)
}

function sanitizeRunningShape(shape: CanvasDocument['shapes'][number]) {
  if (shape.type !== 'node_card' || shape.props.runtimeSummary.status !== 'running') return shape
  return {
    ...shape,
    props: {
      ...shape.props,
      runtimeSummary: sanitizeRuntimeSummary(shape),
    },
  }
}

function sanitizeRuntimeSummary(shape: CanvasNodeShape) {
  return {
    ...shape.props.runtimeSummary,
    costHint: null,
    error: null,
    lastRunId: null,
    progressEstimatedMs: null,
    progressStartedAt: null,
    serverRunId: null,
    status: 'idle' as const,
  }
}
