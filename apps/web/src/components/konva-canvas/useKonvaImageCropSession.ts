import type { MutableRefObject } from 'react'
import { useCallback } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  withCanvasShapes,
  type CanvasDocument,
  type CanvasImageShape,
  type CanvasPoint,
} from '@/features/canvas-engine'
import { updateKonvaImageCropFromHandle, type KonvaImageCropHandle } from './konvaImageCropCommands'
import type { KonvaToolSession } from './konvaCanvasTypes'

type UseKonvaImageCropSessionOptions = {
  documentRef: { current: CanvasDocument }
  onHistoryCheckpoint: (document: CanvasDocument) => void
  previewDocument: (document: CanvasDocument) => void
  sessionRef: MutableRefObject<KonvaToolSession | null>
}

export function useKonvaImageCropSession({
  documentRef,
  onHistoryCheckpoint,
  previewDocument,
  sessionRef,
}: UseKonvaImageCropSessionOptions) {
  const handleImageCropStart = useCallback((shapeId: string, handle: KonvaImageCropHandle, event: KonvaEventObject<PointerEvent>) => {
    const originShape = documentRef.current.shapes.find((shape): shape is CanvasImageShape => shape.id === shapeId && shape.type === 'image')
    if (!originShape) return
    event.cancelBubble = true
    event.evt.preventDefault()
    onHistoryCheckpoint(documentRef.current)
    sessionRef.current = { handle, originShape, pointerId: event.evt.pointerId, shapeId, type: 'image-crop' }
  }, [documentRef, onHistoryCheckpoint, sessionRef])

  const updateImageCropPreview = useCallback((session: Extract<KonvaToolSession, { type: 'image-crop' }>, worldPoint: CanvasPoint) => {
    const nextShape = updateKonvaImageCropFromHandle(session.originShape, session.handle, worldPoint)
    previewDocument(withCanvasShapes(documentRef.current, documentRef.current.shapes.map((shape) => (
      shape.id === session.shapeId ? nextShape : shape
    ))))
  }, [documentRef, previewDocument])

  return { handleImageCropStart, updateImageCropPreview }
}
