import { useCallback } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { zoomCameraAtScreenPoint, type CanvasCamera } from '@/features/canvas-engine'
import { useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import { getStagePointer } from './konvaStageHelpers'
import { konvaMaxZoom, konvaMinZoom } from './konvaZoomLimits'

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
  const zoomSensitivity = useCanvasSettingsStore((state) => state.settings.zoomSensitivity)
  return useCallback((event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const screenPoint = getStagePointer(stageRef.current)
    if (!screenPoint) return
    const currentCamera = cameraRef.current
    const factor = event.evt.deltaY > 0 ? Math.pow(0.9, zoomSensitivity) : Math.pow(1.1, zoomSensitivity)
    const nextZoom = currentCamera.zoom * factor
    applyCamera(zoomCameraAtScreenPoint(currentCamera, screenPoint, nextZoom, konvaMinZoom, konvaMaxZoom))
    scheduleCameraCommit()
  }, [applyCamera, cameraRef, scheduleCameraCommit, stageRef, zoomSensitivity])
}
