'use client'

import { useCallback, useEffect, useRef } from 'react'
import type Konva from 'konva'
import type { CanvasCamera, CanvasDocument } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import {
  createGuardedKonvaBoardDocument,
  type KonvaBoardDocumentSerializationOptions,
  type KonvaBoardDocumentSerializationResult,
} from '@/features/boards/konvaBoardDocument'
import { captureKonvaBoardThumbnailUrl } from './konvaBoardThumbnailCapture'

type UseKonvaBoardDocumentPreparationArgs = {
  boardTitle: string
  camera: CanvasCamera
  document: CanvasDocument
  getPageEnvelope?: (document: CanvasDocument) => KonvaBoardDocumentSerializationOptions
  onPrepared?: (result: KonvaBoardDocumentSerializationResult) => void
  stage: Konva.Stage | null
  workspace?: TangentWorkspace
}

export function useKonvaBoardDocumentPreparation({
  boardTitle,
  camera,
  document,
  getPageEnvelope,
  onPrepared,
  stage,
  workspace,
}: UseKonvaBoardDocumentPreparationArgs) {
  const latestCameraRef = useRef(camera)
  const latestDocumentRef = useRef(document)
  const latestStageRef = useRef(stage)

  useEffect(() => {
    latestCameraRef.current = camera
    latestDocumentRef.current = document
    latestStageRef.current = stage
  }, [camera, document, stage])

  const getPreparedDocument = useCallback(() => ({
    ...latestDocumentRef.current,
    camera: latestCameraRef.current,
  }), [])

  const createGuardedDocument = useCallback((nextDocument: CanvasDocument) => (
    createGuardedKonvaBoardDocument(nextDocument, getPageEnvelope?.(nextDocument))
  ), [getPageEnvelope])

  const prepareDocument = useCallback(async () => {
    const nextResult = createGuardedDocument(getPreparedDocument())
    onPrepared?.(nextResult)
    return nextResult
  }, [createGuardedDocument, getPreparedDocument, onPrepared])

  const captureThumbnail = useCallback(async () => {
    const currentStage = latestStageRef.current
    if (!currentStage) return null
    return captureKonvaBoardThumbnailUrl(currentStage, getPreparedDocument(), boardTitle, workspace)
  }, [boardTitle, getPreparedDocument, workspace])

  return {
    captureThumbnail,
    createGuardedDocument,
    getPreparedDocument,
    prepareDocument,
  }
}
