'use client'

import Image from 'next/image'
import { useRef, useState, type DragEvent, type SyntheticEvent } from 'react'
import type { Editor } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject } from '@/types/nodeRuntime'
import { useAssetPreview, type AssetPreviewMode } from '@/features/assets/assetPreviewResolver'
import { useCanvasPerformanceStore } from '@/features/canvas-performance/canvasPerformanceStore'
import type { RuntimeInputResolution } from '@/features/node-runtime/nodeDataFlow'
import { importFileToImageNode } from '@/features/node-runtime/imageNodeAssets'

type ImageNodePreviewProps = {
  data: JsonObject
  editor: Editor
  inputResolution: RuntimeInputResolution
  shape: NodeCardShape
}

function stopNodeControlEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

function preventNativeImageDrag(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function ImageNodePreview({ data, editor, inputResolution, shape }: ImageNodePreviewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const imagePreviewMode = useCanvasPerformanceStore((state) => state.imagePreviewMode)
  const zoom = useCanvasPerformanceStore((state) => state.zoom)

  const incomingImage = inputResolution.imageValues[0]
  const assetId = String(data.assetId ?? incomingImage?.assetId ?? '')
  const previewSize = getPreviewScreenSize(shape, zoom)
  const assetPreviewMode = getAssetPreviewMode(imagePreviewMode, previewSize.isReadable)
  const preview = useAssetPreview(editor, {
    assetId,
    mode: assetPreviewMode,
    screenHeight: previewSize.height,
    screenWidth: previewSize.width,
  })
  const fallbackTitle = incomingImage?.title ?? String(data.title ?? 'Image')
  const title = preview.title === 'Image' ? fallbackTitle : preview.title
  const shouldRenderImage = Boolean(preview.src)

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setError(null)
    setIsImporting(true)
    try {
      await importFileToImageNode(editor, shape, file)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Image import failed.')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    await handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="node-card__image-preview">
      <div
        className="node-card__image-frame"
        data-dragging={isDragging ? 'true' : undefined}
        onDoubleClick={() => fileInputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          setIsDragging(false)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!isDragging) setIsDragging(true)
        }}
        onDrop={handleDrop}
        onPointerDown={stopNodeControlEvent}
        onWheel={stopNodeControlEvent}
      >
        {shouldRenderImage ? (
          <div className="node-card__image-media">
            <Image
              alt={title}
              className="node-card__image-element"
              draggable={false}
              fill
              onDragStart={preventNativeImageDrag}
              sizes="(max-width: 420px) 100vw, 320px"
              src={preview.src ?? ''}
              unoptimized
            />
          </div>
        ) : assetId ? (
          <div className="node-card__image-lite" data-detail={preview.quality}>
            <span>{title}</span>
          </div>
        ) : (
          <span>{isImporting ? 'Importing image…' : title}</span>
        )}
        <input
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => void handleFiles(event.currentTarget.files)}
          ref={fileInputRef}
          type="file"
        />
      </div>
      <small>{error ?? incomingImage?.assetId ?? String(data.assetId ?? 'Double-click or drop an image')}</small>
    </div>
  )
}

function getPreviewScreenSize(shape: NodeCardShape, zoom: number) {
  const frameWidth = Math.max(0, shape.props.w - 20) * zoom
  const frameHeight = Math.max(0, shape.props.h - 86) * zoom
  return {
    height: frameHeight,
    isReadable: frameWidth >= 180 && frameHeight >= 120,
    width: frameWidth,
  }
}

function getAssetPreviewMode(imagePreviewMode: 'full' | 'reduced' | 'thumbnail', isReadable: boolean): AssetPreviewMode {
  if (imagePreviewMode === 'full') return 'full'
  if (imagePreviewMode === 'thumbnail' || isReadable) return 'thumbnail'
  return 'placeholder'
}
