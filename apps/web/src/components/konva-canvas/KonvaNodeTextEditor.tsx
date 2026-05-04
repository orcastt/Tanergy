import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { CanvasCamera, CanvasNodeShape } from '@/features/canvas-engine'

export type KonvaNodeTextFieldName = 'analysisPrompt' | 'prompt'

type KonvaNodeTextEditorProps = {
  camera: CanvasCamera
  fieldName: KonvaNodeTextFieldName
  shape: CanvasNodeShape
  onCancel: () => void
  onCommit: (value: string) => void
}

export function KonvaNodeTextEditor({ camera, fieldName, onCancel, onCommit, shape }: KonvaNodeTextEditorProps) {
  const [value, setValue] = useState(getKonvaNodeFieldText(shape, fieldName))
  const committedRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  const finish = (nextValue = value) => {
    if (committedRef.current) return
    committedRef.current = true
    onCommit(nextValue.trim())
  }
  const cancel = () => {
    committedRef.current = true
    onCancel()
  }

  return (
    <textarea
      aria-label={fieldName === 'prompt' ? 'Edit prompt' : 'Edit analysis prompt'}
      className="konva-canvas-text-editor konva-canvas-node-text-editor"
      onBlur={() => finish()}
      onChange={(event) => setValue(event.currentTarget.value)}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
          return
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          finish()
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      ref={textareaRef}
      spellCheck
      style={getNodeEditorStyle(shape, fieldName, camera)}
      value={value}
      wrap="soft"
    />
  )
}

export function getEditableKonvaNodeTextField(shape: CanvasNodeShape): KonvaNodeTextFieldName | null {
  if (shape.props.nodeType === 'prompt') return 'prompt'
  if (shape.props.nodeType === 'analysis') return 'analysisPrompt'
  return null
}

export function getKonvaNodeFieldText(shape: CanvasNodeShape, fieldName: KonvaNodeTextFieldName) {
  const value = shape.props.data[fieldName]
  return typeof value === 'string' ? value : ''
}

function getNodeEditorStyle(shape: CanvasNodeShape, fieldName: KonvaNodeTextFieldName, camera: CanvasCamera): CSSProperties {
  const rect = getKonvaNodeFieldRect(shape, fieldName)
  const zoom = camera.zoom
  return {
    boxSizing: 'border-box',
    fontSize: `${13 * zoom}px`,
    height: `${rect.height * zoom}px`,
    left: `${(shape.x + rect.x) * zoom + camera.x}px`,
    lineHeight: `${18 * zoom}px`,
    overflowWrap: 'anywhere',
    overflowX: 'hidden',
    overflowY: 'auto',
    padding: `${12 * zoom}px`,
    textAlign: 'left',
    top: `${(shape.y + rect.y) * zoom + camera.y}px`,
    whiteSpace: 'pre-wrap',
    width: `${rect.width * zoom}px`,
  }
}

export function getKonvaNodeFieldRect(shape: CanvasNodeShape, fieldName: KonvaNodeTextFieldName) {
  if (fieldName === 'analysisPrompt') {
    return { height: 64, width: shape.props.width - 28, x: 14, y: 58 }
  }
  return { height: shape.props.height - 78, width: shape.props.width - 28, x: 14, y: 54 }
}
