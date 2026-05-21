import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  type CanvasCamera,
  type CanvasCloudShape,
  type CanvasDiamondShape,
  type CanvasEllipseShape,
  type CanvasFrameShape,
  type CanvasRectShape,
  type CanvasStickyShape,
  type CanvasTextShape,
  type CanvasTriangleShape,
} from '@/features/canvas-engine'
import { getStandaloneTextEditorMetrics } from './konvaTextAutoFit'

export type KonvaEditableTextShape =
  | CanvasCloudShape
  | CanvasDiamondShape
  | CanvasEllipseShape
  | CanvasFrameShape
  | CanvasRectShape
  | CanvasStickyShape
  | CanvasTextShape
  | CanvasTriangleShape

type KonvaTextEditorProps = {
  camera: CanvasCamera
  shape: KonvaEditableTextShape
  onCancel: () => void
  onCommit: (text: string) => void
}

export function KonvaTextEditor({ camera, onCancel, onCommit, shape }: KonvaTextEditorProps) {
  const [value, setValue] = useState(getEditableText(shape))
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const canceledRef = useRef(false)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    const end = textarea.value.length
    textarea.setSelectionRange(end, end)
  }, [])

  const commit = () => {
    if (!canceledRef.current) onCommit(getCommittedText(shape, value))
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
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          return
        }
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

function getEditableText(shape: KonvaEditableTextShape) {
  return shape.type === 'frame' ? shape.props.title ?? 'Frame' : shape.props.text ?? ''
}

function getCommittedText(shape: KonvaEditableTextShape, value: string) {
  const trimmed = value.trim()
  return isTextContainerShape(shape) ? trimmed : trimmed || getFallbackText(shape)
}

function getFallbackText(shape: KonvaEditableTextShape) {
  if (shape.type === 'frame') return 'Frame'
  if (shape.type === 'sticky') return 'Sticky'
  return 'Text'
}

function getEditorStyle(shape: KonvaEditableTextShape, camera: CanvasCamera): CSSProperties {
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
  const centered = shape.type === 'sticky' || isTextContainerShape(shape)
  const textMetrics = shape.type === 'text' ? getStandaloneTextEditorMetrics(shape) : null
  const fontSize = textMetrics?.fontSize ?? 18
  const lineHeight = textMetrics?.lineHeight ?? 24
  const height = shape.props.height * zoom
  const verticalPadding = centered ? Math.max(10, (height - lineHeight * zoom) / 2) : 2
  return {
    boxSizing: 'border-box',
    fontSize: `${fontSize * zoom}px`,
    height: `${height}px`,
    left: `${shape.x * zoom + camera.x}px`,
    lineHeight: `${lineHeight * zoom}px`,
    padding: `${verticalPadding}px ${centered ? 14 : 4}px 2px`,
    textAlign: centered ? 'center' : 'left',
    top: `${shape.y * zoom + camera.y}px`,
    transform: `rotate(${shape.rotation ?? 0}deg)`,
    width: `${shape.props.width * zoom}px`,
  }
}

export function isKonvaEditableTextShape(shape: { type: string }): shape is KonvaEditableTextShape {
  return shape.type === 'text' || shape.type === 'sticky' || shape.type === 'frame' || isTextContainerShape(shape)
}

function isTextContainerShape(shape: { type: string }): shape is CanvasCloudShape | CanvasDiamondShape | CanvasEllipseShape | CanvasRectShape | CanvasTriangleShape {
  return shape.type === 'rect' || shape.type === 'diamond' || shape.type === 'ellipse' || shape.type === 'triangle' || shape.type === 'cloud'
}
