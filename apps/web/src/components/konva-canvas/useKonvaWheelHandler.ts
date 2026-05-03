import { useCallback } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { zoomCameraAtScreenPoint, type CanvasCamera } from '@/features/canvas-engine'
import { getStagePointer } from './konvaStageHelpers'

type UseKonvaWheelHandlerOptions = {
  applyCamera: (camera: CanvasCamera) => void
  cameraRef: { current: CanvasCamera }
  scheduleCameraCommit: () => void
  stageRef: { current: Konva.Stage | null }
}

export function useKonvaWheelHandler({
  applyCamera,
  cameraRef,
  scheduleCameraCommit,
  stageRef,
}: UseKonvaWheelHandlerOptions) {
  return useCallback((event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    const currentCamera = cameraRef.current
    const nextZoom = currentCamera.zoom * (event.evt.deltaY > 0 ? 0.9 : 1.1)
    applyCamera(zoomCameraAtScreenPoint(currentCamera, screenPoint, nextZoom, 0.2, 4))
    scheduleCameraCommit()
  }, [applyCamera, cameraRef, scheduleCameraCommit, stageRef])
}
