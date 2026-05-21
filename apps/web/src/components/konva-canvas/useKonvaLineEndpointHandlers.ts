import { useCallback } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import type { KonvaLineEndpointHandle, KonvaLineRouteHandle, KonvaToolSession } from './konvaCanvasTypes'

type UseKonvaLineEndpointHandlersOptions = {
  documentRef: { current: CanvasDocument }
  onHistoryCheckpoint: (document: CanvasDocument) => void
  sessionRef: { current: KonvaToolSession | null }
}

export function useKonvaLineEndpointHandlers({
  documentRef,
  onHistoryCheckpoint,
  sessionRef,
}: UseKonvaLineEndpointHandlersOptions) {
  const handleLineEndpointStart = useCallback((shapeId: string, endpoint: KonvaLineEndpointHandle, event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true
    event.evt.preventDefault()
    const current = documentRef.current
    const shape = current.shapes.find((item): item is Extract<CanvasShape, { type: 'arrow' | 'line' }> => (
      item.id === shapeId && (item.type === 'line' || item.type === 'arrow')
    ))
    if (!shape || shape.isLocked) return
    onHistoryCheckpoint(current)
    sessionRef.current = { endpoint, originShape: shape, pointerId: event.evt.pointerId, shapeId, type: 'line-endpoint' }
  }, [documentRef, onHistoryCheckpoint, sessionRef])

  const handleLineRouteHandleStart = useCallback((shapeId: string, handle: KonvaLineRouteHandle, event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true
    event.evt.preventDefault()
    const current = documentRef.current
    const shape = current.shapes.find((item): item is Extract<CanvasShape, { type: 'arrow' | 'line' }> => (
      item.id === shapeId && (item.type === 'line' || item.type === 'arrow')
    ))
    if (!shape || shape.isLocked) return
    onHistoryCheckpoint(current)
    sessionRef.current = { handle, originShape: shape, pointerId: event.evt.pointerId, shapeId, type: 'line-route-handle' }
  }, [documentRef, onHistoryCheckpoint, sessionRef])

  return { handleLineEndpointStart, handleLineRouteHandleStart }
}
