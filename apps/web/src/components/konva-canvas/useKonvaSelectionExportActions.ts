import type Konva from 'konva'
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { uploadImageDataUrlAsset } from '@/features/assets/assetUploadClient'
import type { CanvasDocument } from '@/features/canvas-engine'
import { createKonvaImageNodeFromAssetRecord } from './konvaImageNodeConversion'
import {
  captureKonvaSelectionPng,
  copyKonvaPngDataUrlToClipboard,
  copyKonvaSvgToClipboard,
  downloadKonvaBlob,
  downloadKonvaDataUrl,
} from './konvaSelectionExport'
import { createKonvaSelectionSvgBlob, exportKonvaSelectionToSvg } from './konvaSelectionSvgExport'

type KonvaCanvasHistory = {
  checkpoint: (document?: CanvasDocument) => void
}

type UseKonvaSelectionExportActionsOptions = {
  document: CanvasDocument
  history: KonvaCanvasHistory
  selectedIds: string[]
  onActionError?: (message: string | null) => void
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaSelectionExportActions({
  document,
  history,
  onActionError,
  onDocumentChange,
  onSelectionChange,
  selectedIds,
}: UseKonvaSelectionExportActionsOptions) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const [isCapturingSelection, setIsCapturingSelection] = useState(false)

  const captureSelectionPng = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) throw new Error('Canvas stage is not ready.')
    return captureKonvaSelectionPng({ document, selectedIds, stage })
  }, [document, selectedIds])

  const handleCaptureSelectionToImageNode = useCallback(async () => {
    if (selectedIds.length === 0 || isCapturingSelection) return
    setIsCapturingSelection(true)
    onActionError?.(null)
    try {
      const capture = await captureSelectionPng()
      const asset = await uploadImageDataUrlAsset({
        dataUrl: capture.dataUrl,
        fileName: `selection-capture-${Date.now().toString(36)}.png`,
        height: capture.height,
        origin: 'merge_capture',
        title: 'Selection capture',
        width: capture.width,
      })
      history.checkpoint(document)
      const result = createKonvaImageNodeFromAssetRecord(document, asset, {
        x: capture.bounds.minX,
        y: capture.bounds.maxY + 48,
      }, { source: 'merge_capture', title: 'Image' })
      onDocumentChange(result.document)
      onSelectionChange(result.selectedIds)
    } catch (error) {
      reportActionError(error, 'Selection capture failed.', onActionError)
    } finally {
      setIsCapturingSelection(false)
    }
  }, [captureSelectionPng, document, history, isCapturingSelection, onActionError, onDocumentChange, onSelectionChange, selectedIds.length])

  const handleCopySelectionPng = useCallback(async () => {
    if (selectedIds.length === 0) return
    onActionError?.(null)
    try {
      const capture = await captureSelectionPng()
      await copyKonvaPngDataUrlToClipboard(capture.dataUrl)
    } catch (error) {
      reportActionError(error, 'Copy as PNG failed.', onActionError)
    }
  }, [captureSelectionPng, onActionError, selectedIds.length])

  const handleExportSelectionPng = useCallback(async () => {
    if (selectedIds.length === 0) return
    onActionError?.(null)
    try {
      const capture = await captureSelectionPng()
      downloadKonvaDataUrl(capture.dataUrl, getSelectionExportFileName(document, 'png'))
    } catch (error) {
      reportActionError(error, 'Export as PNG failed.', onActionError)
    }
  }, [captureSelectionPng, document, onActionError, selectedIds.length])

  const handleCopySelectionSvg = useCallback(async () => {
    if (selectedIds.length === 0) return
    onActionError?.(null)
    try {
      const result = exportKonvaSelectionToSvg(document, selectedIds)
      await copyKonvaSvgToClipboard(result.svg)
    } catch (error) {
      reportActionError(error, 'Copy as SVG failed.', onActionError)
    }
  }, [document, onActionError, selectedIds])

  const handleExportSelectionSvg = useCallback(() => {
    if (selectedIds.length === 0) return
    onActionError?.(null)
    try {
      const result = exportKonvaSelectionToSvg(document, selectedIds)
      downloadKonvaBlob(createKonvaSelectionSvgBlob(result.svg), getSelectionExportFileName(document, 'svg'))
    } catch (error) {
      reportActionError(error, 'Export as SVG failed.', onActionError)
    }
  }, [document, onActionError, selectedIds])

  const handleStageReady = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage
  }, [])

  return {
    canCaptureSelection: selectedIds.length > 0,
    captureMode: false,
    handleCaptureSelectionToImageNode,
    handleCopySelectionPng,
    handleCopySelectionSvg,
    handleExportSelectionPng,
    handleExportSelectionSvg,
    handleStageReady,
    isCapturingSelection,
  }
}

function reportActionError(error: unknown, fallback: string, onActionError?: (message: string | null) => void) {
  const message = error instanceof Error && error.message ? error.message : fallback
  console.warn(message)
  onActionError?.(message)
}

function getSelectionExportFileName(document: CanvasDocument, extension: 'png' | 'svg') {
  const base = (document.metadata.name ?? document.id ?? 'selection')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'selection'
  return `${base}-selection.${extension}`
}
