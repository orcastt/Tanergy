import { create } from 'zustand'

export type ImagePreviewMode = 'full' | 'reduced'

type CanvasPerformanceState = {
  imageLikeCount: number
  imagePreviewMode: ImagePreviewMode
  viewportWidth: number
  zoom: number
  updateMetrics: (metrics: Partial<CanvasPerformanceMetrics>) => void
}

type CanvasPerformanceMetrics = {
  imageLikeCount: number
  viewportWidth: number
  zoom: number
}

export const useCanvasPerformanceStore = create<CanvasPerformanceState>((set) => ({
  imageLikeCount: 0,
  imagePreviewMode: 'full',
  viewportWidth: 1440,
  zoom: 1,
  updateMetrics: (metrics) => set((state) => {
    const nextMetrics = {
      imageLikeCount: metrics.imageLikeCount ?? state.imageLikeCount,
      viewportWidth: metrics.viewportWidth ?? state.viewportWidth,
      zoom: metrics.zoom ?? state.zoom,
    }
    const nextMode = getImagePreviewMode(nextMetrics)
    if (
      state.imageLikeCount === nextMetrics.imageLikeCount &&
      state.imagePreviewMode === nextMode &&
      state.viewportWidth === nextMetrics.viewportWidth &&
      Math.abs(state.zoom - nextMetrics.zoom) < 0.005
    ) {
      return state
    }

    return {
      imageLikeCount: nextMetrics.imageLikeCount,
      imagePreviewMode: nextMode,
      viewportWidth: nextMetrics.viewportWidth,
      zoom: nextMetrics.zoom,
    }
  }),
}))

function getImagePreviewMode(metrics: { imageLikeCount: number; viewportWidth: number; zoom: number }): ImagePreviewMode {
  const widthThreshold = metrics.viewportWidth < 1200 ? 0.18 : metrics.viewportWidth < 1800 ? 0.16 : 0.14
  const densityBoost = metrics.imageLikeCount >= 24 ? 0.1 : metrics.imageLikeCount >= 16 ? 0.07 : metrics.imageLikeCount >= 10 ? 0.04 : 0
  return metrics.zoom <= widthThreshold + densityBoost ? 'reduced' : 'full'
}
