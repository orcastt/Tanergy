'use client'

import Image from 'next/image'
import { useRef, useState, type DragEvent, type SyntheticEvent } from 'react'
import type { Editor } from 'tldraw'
import type { NodeCardShape } from '@/types/nodeCardShape'
import type { JsonObject } from '@/types/nodeRuntime'
import { useCanvasPerformanceStore } from '@/features/canvas-performance/canvasPerformanceStore'
import type { RuntimeInputResolution } from '@/features/node-runtime/nodeDataFlow'
import { getImageAsset, importFileToImageNode } from '@/features/node-runtime/imageNodeAssets'

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

  const incomingImage = inputResolution.imageValues[0]
  const asset = getImageAsset(editor, String(data.assetId ?? incomingImage?.assetId ?? ''))
  const title = asset?.title ?? incomingImage?.title ?? String(data.title ?? 'Image')
  const shouldRenderImage = Boolean(asset?.src) && imagePreviewMode === 'full'

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
        {asset?.src && shouldRenderImage ? (
          <div className="node-card__image-media">
            <Image
              alt={title}
              className="node-card__image-element"
              draggable={false}
              fill
              onDragStart={preventNativeImageDrag}
              sizes="(max-width: 420px) 100vw, 320px"
              src={asset.src}
              unoptimized
            />
          </div>
        ) : asset?.src ? (
          <div className="node-card__image-lite" data-detail={imagePreviewMode}>
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
