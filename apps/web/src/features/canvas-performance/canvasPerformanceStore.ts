import { create } from 'zustand'

export type ImagePreviewMode = 'full' | 'reduced' | 'thumbnail'
export type NodeRenderMode = 'full' | 'shell'

type CanvasPerformanceState = {
  imageLikeCount: number
  imagePreviewInteractionActive: boolean
  imagePreviewMode: ImagePreviewMode
  nodeCardCount: number
  nodeRenderMode: NodeRenderMode
  viewportWidth: number
  zoom: number
  setImagePreviewInteractionActive: (active: boolean) => void
  updateMetrics: (metrics: Partial<CanvasPerformanceMetrics>) => void
}

type CanvasPerformanceMetrics = {
  imageLikeCount: number
  imagePreviewInteractionActive: boolean
  nodeCardCount: number
  viewportWidth: number
  zoom: number
}

export const useCanvasPerformanceStore = create<CanvasPerformanceState>((set) => ({
  imageLikeCount: 0,
  imagePreviewInteractionActive: false,
  imagePreviewMode: 'full',
  nodeCardCount: 0,
  nodeRenderMode: 'full',
  viewportWidth: 1440,
  zoom: 1,
  setImagePreviewInteractionActive: (active) => set((state) => {
    if (state.imagePreviewInteractionActive === active) return state
    const nextMetrics = { ...state, imagePreviewInteractionActive: active }
    return {
      imagePreviewInteractionActive: active,
      imagePreviewMode: getImagePreviewMode(nextMetrics),
      nodeRenderMode: getNodeRenderMode(nextMetrics),
    }
  }),
  updateMetrics: (metrics) => set((state) => {
    const nextMetrics = {
      imageLikeCount: metrics.imageLikeCount ?? state.imageLikeCount,
      imagePreviewInteractionActive: metrics.imagePreviewInteractionActive ?? state.imagePreviewInteractionActive,
      nodeCardCount: metrics.nodeCardCount ?? state.nodeCardCount,
      viewportWidth: metrics.viewportWidth ?? state.viewportWidth,
      zoom: metrics.zoom ?? state.zoom,
    }
    const nextMode = getImagePreviewMode(nextMetrics)
    const nextNodeRenderMode = getNodeRenderMode(nextMetrics)
    if (
      state.imageLikeCount === nextMetrics.imageLikeCount &&
      state.imagePreviewInteractionActive === nextMetrics.imagePreviewInteractionActive &&
      state.imagePreviewMode === nextMode &&
      state.nodeCardCount === nextMetrics.nodeCardCount &&
      state.nodeRenderMode === nextNodeRenderMode &&
      state.viewportWidth === nextMetrics.viewportWidth &&
      Math.abs(state.zoom - nextMetrics.zoom) < 0.005
    ) {
      return state
    }

    return {
      imageLikeCount: nextMetrics.imageLikeCount,
      imagePreviewInteractionActive: nextMetrics.imagePreviewInteractionActive,
      imagePreviewMode: nextMode,
      nodeCardCount: nextMetrics.nodeCardCount,
      nodeRenderMode: nextNodeRenderMode,
      viewportWidth: nextMetrics.viewportWidth,
      zoom: nextMetrics.zoom,
    }
  }),
}))

function getImagePreviewMode(metrics: {
  imageLikeCount: number
  imagePreviewInteractionActive: boolean
  viewportWidth: number
  zoom: number
}): ImagePreviewMode {
  if (metrics.imagePreviewInteractionActive) {
    if (shouldReduceDuringInteraction(metrics)) return 'reduced'
    if (metrics.zoom <= getInteractionThumbnailThreshold(metrics.imageLikeCount)) return 'thumbnail'
  }
  if (metrics.zoom <= getImageOverviewThreshold(metrics.imageLikeCount)) return 'reduced'
  if (metrics.zoom <= getImageThumbnailThreshold(metrics.imageLikeCount)) return 'thumbnail'
  return 'full'
}

function shouldReduceDuringInteraction(metrics: {
  imageLikeCount: number
  zoom: number
}) {
  return metrics.zoom <= getImageOverviewThreshold(metrics.imageLikeCount)
}

function getImageOverviewThreshold(imageLikeCount: number) {
  if (imageLikeCount >= 80) return 0.3
  if (imageLikeCount >= 48) return 0.28
  if (imageLikeCount >= 24) return 0.25
  if (imageLikeCount >= 16) return 0.22
  if (imageLikeCount >= 10) return 0.18
  return 0.14
}

function getImageThumbnailThreshold(imageLikeCount: number) {
  if (imageLikeCount >= 80) return 1.2
  if (imageLikeCount >= 48) return 1.1
  if (imageLikeCount >= 32) return 0.95
  if (imageLikeCount >= 24) return 0.82
  if (imageLikeCount >= 16) return 0.64
  if (imageLikeCount >= 10) return 0.42
  return 0
}

function getInteractionThumbnailThreshold(imageLikeCount: number) {
  return getImageThumbnailThreshold(imageLikeCount)
}

function getNodeRenderMode(metrics: {
  imagePreviewInteractionActive: boolean
  nodeCardCount: number
  zoom: number
}): NodeRenderMode {
  if (metrics.nodeCardCount === 0) return 'full'
  if (
    metrics.imagePreviewInteractionActive &&
    metrics.zoom <= getNodeInteractionShellThreshold(metrics.nodeCardCount)
  ) {
    return 'shell'
  }
  return metrics.zoom <= getNodeShellThreshold(metrics.nodeCardCount) ? 'shell' : 'full'
}

function getNodeShellThreshold(nodeCardCount: number) {
  if (nodeCardCount >= 80) return 0.3
  if (nodeCardCount >= 48) return 0.28
  if (nodeCardCount >= 28) return 0.25
  if (nodeCardCount >= 16) return 0.22
  return 0.18
}

function getNodeInteractionShellThreshold(nodeCardCount: number) {
  if (nodeCardCount >= 80) return 0.64
  if (nodeCardCount >= 48) return 0.56
  if (nodeCardCount >= 32) return 0.46
  return getNodeShellThreshold(nodeCardCount)
}
