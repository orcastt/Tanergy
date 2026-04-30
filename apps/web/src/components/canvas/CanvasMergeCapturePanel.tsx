'use client'

import { useState, type SyntheticEvent } from 'react'
import Image from 'next/image'
import type { Editor } from 'tldraw'
import { useEditorRevision } from './useEditorRevision'

type CanvasMergeCapturePanelProps = {
  editor: Editor | null
}

type CapturePreview = {
  height: number
  url: string
  width: number
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasMergeCapturePanel({ editor }: CanvasMergeCapturePanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [preview, setPreview] = useState<CapturePreview | null>(null)
  useEditorRevision(editor, 'selection')

  const selectedIds = editor?.getSelectedShapeIds() ?? []
  if (!editor || selectedIds.length === 0) return null

  const captureSelected = async () => {
    setError(null)
    setIsCapturing(true)
    try {
      const result = await editor.toImageDataUrl(selectedIds, {
        background: false,
        format: 'png',
        padding: 0,
        pixelRatio: 1,
      })
      setPreview(result)
    } catch {
      setError('Capture failed. Try fewer objects or remove unsupported assets.')
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <aside
      aria-label="Merge capture test"
      className="merge-capture-panel"
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <div>
        <strong>Merge Capture</strong>
        <span>{selectedIds.length} selected · local preview only</span>
      </div>
      <button disabled={isCapturing} onClick={captureSelected} type="button">
        {isCapturing ? 'Capturing…' : 'Capture selected'}
      </button>
      {preview ? (
        <figure>
          <Image
            alt="Selected canvas objects export preview"
            height={preview.height}
            src={preview.url}
            unoptimized
            width={preview.width}
          />
          <figcaption>
            {preview.width}×{preview.height} · data URL not saved to document
          </figcaption>
        </figure>
      ) : null}
      {error ? <p>{error}</p> : null}
    </aside>
  )
}
