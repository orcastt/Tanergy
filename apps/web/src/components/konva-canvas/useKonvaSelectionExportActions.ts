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
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaSelectionExportActions({
  document,
  history,
  onDocumentChange,
  onSelectionChange,
  selectedIds,
}: UseKonvaSelectionExportActionsOptions) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const [captureMode, setCaptureMode] = useState(false)
  const [isCapturingSelection, setIsCapturingSelection] = useState(false)

  const runWithCaptureMode = useCallback(async <T,>(task: () => Promise<T>) => {
    setCaptureMode(true)
    await waitForCapturePaint()
    try {
      return await task()
    } finally {
      setCaptureMode(false)
    }
  }, [])

  const captureSelectionPng = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) throw new Error('Canvas stage is not ready.')
    return runWithCaptureMode(() => captureKonvaSelectionPng({ document, selectedIds, stage }))
  }, [document, runWithCaptureMode, selectedIds])

  const handleCaptureSelectionToImageNode = useCallback(async () => {
    if (selectedIds.length === 0 || isCapturingSelection) return
    setIsCapturingSelection(true)
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
      console.warn(error instanceof Error ? error.message : 'Selection capture failed.')
    } finally {
      setIsCapturingSelection(false)
    }
  }, [captureSelectionPng, document, history, isCapturingSelection, onDocumentChange, onSelectionChange, selectedIds.length])

  const handleCopySelectionPng = useCallback(async () => {
    if (selectedIds.length === 0) return
    try {
      const capture = await captureSelectionPng()
      await copyKonvaPngDataUrlToClipboard(capture.dataUrl)
    } catch (error) {
      console.warn(error instanceof Error ? error.message : 'Copy as PNG failed.')
    }
  }, [captureSelectionPng, selectedIds.length])

  const handleExportSelectionPng = useCallback(async () => {
    if (selectedIds.length === 0) return
    try {
      const capture = await captureSelectionPng()
      downloadKonvaDataUrl(capture.dataUrl, getSelectionExportFileName(document, 'png'))
    } catch (error) {
      console.warn(error instanceof Error ? error.message : 'Export as PNG failed.')
    }
  }, [captureSelectionPng, document, selectedIds.length])

  const handleCopySelectionSvg = useCallback(async () => {
    if (selectedIds.length === 0) return
    try {
      const result = exportKonvaSelectionToSvg(document, selectedIds)
      await copyKonvaSvgToClipboard(result.svg)
    } catch (error) {
      console.warn(error instanceof Error ? error.message : 'Copy as SVG failed.')
    }
  }, [document, selectedIds])

  const handleExportSelectionSvg = useCallback(() => {
    if (selectedIds.length === 0) return
    try {
      const result = exportKonvaSelectionToSvg(document, selectedIds)
      downloadKonvaBlob(createKonvaSelectionSvgBlob(result.svg), getSelectionExportFileName(document, 'svg'))
    } catch (error) {
      console.warn(error instanceof Error ? error.message : 'Export as SVG failed.')
    }
  }, [document, selectedIds])

  const handleStageReady = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage
  }, [])

  return {
    canCaptureSelection: selectedIds.length > 0,
    captureMode,
    handleCaptureSelectionToImageNode,
    handleCopySelectionPng,
    handleCopySelectionSvg,
    handleExportSelectionPng,
    handleExportSelectionSvg,
    handleStageReady,
    isCapturingSelection,
  }
}

async function waitForCapturePaint() {
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
}

function getSelectionExportFileName(document: CanvasDocument, extension: 'png' | 'svg') {
  const base = (document.metadata.name ?? document.id ?? 'selection')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'selection'
  return `${base}-selection.${extension}`
}
