import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { type CanvasCamera, type CanvasFrameShape, type CanvasStickyShape, type CanvasTextShape } from '@/features/canvas-engine'

type KonvaTextEditorProps = {
  camera: CanvasCamera
  shape: CanvasFrameShape | CanvasStickyShape | CanvasTextShape
  onCancel: () => void
  onCommit: (text: string) => void
}

export function KonvaTextEditor({ camera, onCancel, onCommit, shape }: KonvaTextEditorProps) {
  const [value, setValue] = useState(getEditableText(shape))
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const canceledRef = useRef(false)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  const commit = () => {
    if (!canceledRef.current) onCommit(value.trim() || getFallbackText(shape))
  }
  return (
    <textarea
      aria-label="Edit text"
      className="konva-canvas-text-editor"
      onBlur={commit}
      onChange={(event) => setValue(event.currentTarget.value)}
      onContextMenu={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          canceledRef.current = true
          onCancel()
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      ref={textareaRef}
      style={getEditorStyle(shape, camera)}
      value={value}
    />
  )
}

function getEditableText(shape: CanvasFrameShape | CanvasStickyShape | CanvasTextShape) {
  return shape.type === 'frame' ? shape.props.title ?? 'Frame' : shape.props.text
}

function getFallbackText(shape: CanvasFrameShape | CanvasStickyShape | CanvasTextShape) {
  if (shape.type === 'frame') return 'Frame'
  if (shape.type === 'sticky') return 'Sticky'
  return 'Text'
}

function getEditorStyle(shape: CanvasFrameShape | CanvasStickyShape | CanvasTextShape, camera: CanvasCamera): CSSProperties {
  const zoom = camera.zoom
  if (shape.type === 'frame') {
    return {
      fontSize: `${14 * zoom}px`,
      height: `${24 * zoom}px`,
      left: `${shape.x * zoom + camera.x}px`,
      lineHeight: `${20 * zoom}px`,
      top: `${(shape.y - 26) * zoom + camera.y}px`,
      width: `${Math.max(90, shape.props.width) * zoom}px`,
    }
  }
  return {
    fontSize: `${18 * zoom}px`,
    height: `${shape.props.height * zoom}px`,
    left: `${shape.x * zoom + camera.x}px`,
    lineHeight: `${24 * zoom}px`,
    textAlign: shape.type === 'sticky' ? 'center' : 'left',
    top: `${shape.y * zoom + camera.y}px`,
    transform: `rotate(${shape.rotation ?? 0}deg)`,
    width: `${shape.props.width * zoom}px`,
  }
}
