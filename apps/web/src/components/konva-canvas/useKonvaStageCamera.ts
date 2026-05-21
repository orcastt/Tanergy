import type Konva from 'konva'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { CanvasCamera } from '@/features/canvas-engine'

type UseKonvaStageCameraOptions = {
  camera: CanvasCamera
  stageRef: RefObject<Konva.Stage | null>
  onCameraCommit: (camera: CanvasCamera) => void
  onCameraPreview: (camera: CanvasCamera) => void
}

type PendingCameraPreview = {
  camera: CanvasCamera
  version: number
}

export function useKonvaStageCamera({
  camera,
  onCameraCommit,
  onCameraPreview,
  stageRef,
}: UseKonvaStageCameraOptions) {
  const cameraRef = useRef(camera)
  const localCameraVersionRef = useRef(0)
  const lastPublishedPreviewRef = useRef<PendingCameraPreview | null>(null)
  const previewTimerRef = useRef<number | null>(null)
  const commitTimerRef = useRef<number | null>(null)
  const pendingPreviewRef = useRef<PendingCameraPreview | null>(null)

  useEffect(() => {
    const preview = lastPublishedPreviewRef.current
    if (preview && preview.version < localCameraVersionRef.current && isSameCamera(camera, preview.camera)) {
      return
    }
    if (isSameCamera(cameraRef.current, camera)) return
    cameraRef.current = camera
    applyStageCamera(stageRef.current, camera)
  }, [camera, stageRef])

  useEffect(() => () => {
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current)
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current)
  }, [])

  const publishPreview = useCallback((nextCamera: CanvasCamera) => {
    pendingPreviewRef.current = {
      camera: nextCamera,
      version: localCameraVersionRef.current,
    }
    if (previewTimerRef.current !== null) return
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = null
      const pending = pendingPreviewRef.current
      pendingPreviewRef.current = null
      if (pending) {
        lastPublishedPreviewRef.current = pending
        onCameraPreview(pending.camera)
      }
    }, 90)
  }, [onCameraPreview])

  const commitCamera = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current)
      commitTimerRef.current = null
    }
    pendingPreviewRef.current = null
    onCameraCommit(cameraRef.current)
  }, [onCameraCommit])

  const applyCamera = useCallback((nextCamera: CanvasCamera, options: { preview?: boolean } = {}) => {
    if (!isSameCamera(cameraRef.current, nextCamera)) {
      localCameraVersionRef.current += 1
    }
    cameraRef.current = nextCamera
    applyStageCamera(stageRef.current, nextCamera)
    if (options.preview !== false) publishPreview(nextCamera)
  }, [publishPreview, stageRef])

  const scheduleCameraCommit = useCallback((delayMs = 160) => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current)
    commitTimerRef.current = window.setTimeout(commitCamera, delayMs)
  }, [commitCamera])

  return {
    applyCamera,
    cameraRef,
    commitCamera,
    scheduleCameraCommit,
  }
}

function applyStageCamera(stage: Konva.Stage | null, camera: CanvasCamera) {
  if (!stage) return
  stage.position({ x: camera.x, y: camera.y })
  stage.scale({ x: camera.zoom, y: camera.zoom })
  stage.batchDraw()
}

function isSameCamera(left: CanvasCamera, right: CanvasCamera) {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom
}
