import { useEffect, useRef, useState } from 'react'
import { type CanvasCamera, type CanvasStickyShape, type CanvasTextShape } from '@/features/canvas-engine'

type KonvaTextEditorProps = {
  camera: CanvasCamera
  shape: CanvasTextShape | CanvasStickyShape
  onCancel: () => void
  onCommit: (text: string) => void
}

export function KonvaTextEditor({ camera, onCancel, onCommit, shape }: KonvaTextEditorProps) {
  const [value, setValue] = useState(shape.props.text)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const canceledRef = useRef(false)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  const commit = () => {
    if (!canceledRef.current) onCommit(value.trim() || (shape.type === 'sticky' ? 'Sticky' : 'Text'))
  }
  const zoom = camera.zoom
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
      style={{
        fontSize: `${18 * zoom}px`,
        height: `${shape.props.height * zoom}px`,
        left: `${shape.x * zoom + camera.x}px`,
        lineHeight: `${24 * zoom}px`,
        top: `${shape.y * zoom + camera.y}px`,
        transform: `rotate(${shape.rotation ?? 0}deg)`,
        width: `${shape.props.width * zoom}px`,
      }}
      value={value}
    />
  )
}
