'use client'

import { useEffect } from 'react'
import {
  HTMLContainer,
  ImageShapeUtil,
  getUncroppedSize,
  type Editor,
  type TLImageShape,
} from 'tldraw'
import {
  primeEditorAssetPreviewThumbnails,
  useAssetPreview,
  type AssetPreviewMode,
} from '@/features/assets/assetPreviewResolver'
import { useCanvasPerformanceStore, type ImagePreviewMode } from '@/features/canvas-performance/canvasPerformanceStore'

export class CanvasImageShapeUtil extends ImageShapeUtil {
  static override type = 'image' as const

  override component(shape: TLImageShape) {
    return <CanvasImageShape editor={this.editor} shape={shape} />
  }
}

function CanvasImageShape({ editor, shape }: { editor: Editor; shape: TLImageShape }) {
  const imagePreviewMode = useCanvasPerformanceStore((state) => state.imagePreviewMode)
  const zoom = useCanvasPerformanceStore((state) => state.zoom)
  const { h, w } = getUncroppedSize(shape.props, shape.props.crop)
  const previewMode = getCanvasImagePreviewMode(imagePreviewMode)
  const preview = useAssetPreview(editor, {
    assetId: shape.props.assetId ? String(shape.props.assetId) : null,
    mode: previewMode,
    screenHeight: shape.props.h * zoom,
    screenWidth: shape.props.w * zoom,
  })

  useEffect(() => {
    primeEditorAssetPreviewThumbnails(editor, shape.props.assetId ? String(shape.props.assetId) : null)
  }, [editor, shape.props.assetId])

  return (
    <HTMLContainer
      id={shape.id}
      style={{
        borderRadius: shape.props.crop?.isCircle ? '50%' : undefined,
        height: shape.props.h,
        overflow: 'hidden',
        width: shape.props.w,
      }}
    >
      <div className="tl-image-container" style={getCroppedContainerStyle(shape, w, h)}>
        {preview.src ? (
          // tldraw shape rendering needs a raw img so crop / flip styles match the default ImageShapeUtil.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={shape.props.altText}
            className="tl-image"
            draggable={false}
            referrerPolicy="strict-origin-when-cross-origin"
            src={preview.src}
            style={getFlipStyle(shape)}
          />
        ) : (
          <div
            aria-label={shape.props.altText || preview.title}
            className="canvas-image-lod-placeholder"
            role="img"
          />
        )}
      </div>
    </HTMLContainer>
  )
}

function getCanvasImagePreviewMode(imagePreviewMode: ImagePreviewMode): AssetPreviewMode {
  return imagePreviewMode === 'full' ? 'full' : 'thumbnail'
}

function getCroppedContainerStyle(shape: TLImageShape, width: number, height: number) {
  const topLeft = shape.props.crop?.topLeft
  if (!topLeft) return { height: shape.props.h, width: shape.props.w }
  return {
    height,
    transform: `translate(${-topLeft.x * width}px, ${-topLeft.y * height}px)`,
    width,
  }
}

function getFlipStyle(shape: TLImageShape) {
  const { flipX, flipY } = shape.props
  if (!flipX && !flipY) return undefined
  return {
    transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
    transformOrigin: 'center center',
  }
}
