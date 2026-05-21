import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { CanvasBounds } from '@/features/canvas-engine'
import type { BoardCollaborationTransformKind } from '@/features/boards/boardCollaborationTypes'

export type TransformPreviewState = { bounds: CanvasBounds; kind: BoardCollaborationTransformKind } | null

export function useKonvaTransformPreviewState() {
  const [transformPreview, setTransformPreview] = useState<TransformPreviewState>(null)
  const transformPreviewFrameRef = useRef<number | null>(null)
  const pendingTransformPreviewRef = useRef<TransformPreviewState>(null)

  const setTransformPreviewThrottled = useCallback<Dispatch<SetStateAction<TransformPreviewState>>>((update) => {
    if (typeof update === 'function') {
      setTransformPreview(update)
      return
    }
    pendingTransformPreviewRef.current = update
    if (update === null) {
      if (transformPreviewFrameRef.current !== null) {
        window.cancelAnimationFrame(transformPreviewFrameRef.current)
        transformPreviewFrameRef.current = null
      }
      setTransformPreview((current) => (current === null ? current : null))
      return
    }
    if (transformPreviewFrameRef.current !== null) return
    transformPreviewFrameRef.current = window.requestAnimationFrame(() => {
      transformPreviewFrameRef.current = null
      const next = pendingTransformPreviewRef.current
      pendingTransformPreviewRef.current = null
      setTransformPreview((current) => (isSameTransformPreview(current, next) ? current : next))
    })
  }, [])

  useEffect(() => () => {
    if (transformPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(transformPreviewFrameRef.current)
      transformPreviewFrameRef.current = null
    }
  }, [])

  return { setTransformPreview, setTransformPreviewThrottled, transformPreview }
}

function isSameTransformPreview(left: TransformPreviewState, right: TransformPreviewState) {
  if (!left || !right) return left === right
  return left.kind === right.kind
    && left.bounds.maxX === right.bounds.maxX
    && left.bounds.maxY === right.bounds.maxY
    && left.bounds.minX === right.bounds.minX
    && left.bounds.minY === right.bounds.minY
}
