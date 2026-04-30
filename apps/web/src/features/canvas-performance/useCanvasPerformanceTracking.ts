'use client'

import { useEffect } from 'react'
import type { Editor } from 'tldraw'
import {
  hasCanvasPerformanceStructureChange,
  updateCanvasImagePerformanceMetrics,
  updateCanvasViewPerformanceMetrics,
} from './editorPerformanceMetrics'
import { useCanvasPerformanceStore } from './canvasPerformanceStore'

const IMAGE_PREVIEW_IDLE_RECOVERY_MS = 160

export function useCanvasPerformanceTracking(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return
    let imageFrame = 0
    let viewFrame = 0
    const updateImageMetrics = () => {
      imageFrame = 0
      updateCanvasImagePerformanceMetrics(editor)
    }
    const updateViewMetrics = () => {
      viewFrame = 0
      updateCanvasViewPerformanceMetrics(editor)
    }
    const scheduleImageMetricsUpdate = () => {
      if (!imageFrame) imageFrame = window.requestAnimationFrame(updateImageMetrics)
    }
    const scheduleViewMetricsUpdate = () => {
      if (!viewFrame) viewFrame = window.requestAnimationFrame(updateViewMetrics)
    }

    updateImageMetrics()
    const stopStoreListen = editor.store.listen(({ changes }) => {
      if (hasCanvasPerformanceStructureChange(changes)) scheduleImageMetricsUpdate()
    }, { scope: 'document', source: 'all' })
    editor.on('event', scheduleViewMetricsUpdate)
    editor.on('resize', scheduleViewMetricsUpdate)
    window.addEventListener('resize', scheduleImageMetricsUpdate)

    return () => {
      if (imageFrame) window.cancelAnimationFrame(imageFrame)
      if (viewFrame) window.cancelAnimationFrame(viewFrame)
      stopStoreListen()
      editor.off('event', scheduleViewMetricsUpdate)
      editor.off('resize', scheduleViewMetricsUpdate)
      window.removeEventListener('resize', scheduleImageMetricsUpdate)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) {
      useCanvasPerformanceStore.getState().setImagePreviewInteractionActive(false)
      return
    }
    let frame = 0
    let idleTimeout = 0
    const syncInteractionPreviewMode = () => {
      frame = 0
      const active = isImagePreviewInteractionActive(editor)
      window.clearTimeout(idleTimeout)
      if (active) {
        useCanvasPerformanceStore.getState().setImagePreviewInteractionActive(true)
        return
      }
      idleTimeout = window.setTimeout(() => {
        useCanvasPerformanceStore.getState().setImagePreviewInteractionActive(false)
      }, IMAGE_PREVIEW_IDLE_RECOVERY_MS)
    }
    const scheduleSync = () => {
      if (!frame) frame = window.requestAnimationFrame(syncInteractionPreviewMode)
    }

    scheduleSync()
    const stopSessionListen = editor.store.listen(scheduleSync, { scope: 'session', source: 'all' })
    editor.on('event', scheduleSync)
    editor.on('resize', scheduleSync)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.clearTimeout(idleTimeout)
      stopSessionListen()
      editor.off('event', scheduleSync)
      editor.off('resize', scheduleSync)
      useCanvasPerformanceStore.getState().setImagePreviewInteractionActive(false)
    }
  }, [editor])
}

function isImagePreviewInteractionActive(editor: Editor) {
  return (
    editor.getCameraState() === 'moving' ||
    editor.inputs.getIsDragging() ||
    editor.inputs.getIsPanning()
  )
}
