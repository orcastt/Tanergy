import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { CanvasCamera, CanvasNodeShape } from '@/features/canvas-engine'
import { getKonvaChatDraft } from './konvaChatNodeActions'

export type KonvaNodeTextFieldName = 'analysisPrompt' | 'chatDraft' | 'prompt'

type KonvaNodeTextEditorProps = {
  camera: CanvasCamera
  fieldName: KonvaNodeTextFieldName
  shape: CanvasNodeShape
  onCancel: () => void
  onCommit: (value: string) => void
  onSubmit?: (value: string) => void
}

export function KonvaNodeTextEditor({ camera, fieldName, onCancel, onCommit, onSubmit, shape }: KonvaNodeTextEditorProps) {
  const [value, setValue] = useState(getKonvaNodeFieldText(shape, fieldName))
  const committedRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    const end = textarea.value.length
    textarea.setSelectionRange(end, end)
  }, [])

  const finish = (nextValue = value) => {
    if (committedRef.current) return
    committedRef.current = true
    onCommit(nextValue.trim())
  }
  const submit = (nextValue = value) => {
    if (!onSubmit || committedRef.current) return
    committedRef.current = true
    onSubmit(nextValue.trim())
  }
  const cancel = () => {
    committedRef.current = true
    onCancel()
  }

  const editorStyle = getNodeEditorStyle(shape, fieldName, camera)
  return (
    <>
      <textarea
        aria-label={fieldName === 'prompt' ? 'Edit prompt' : fieldName === 'chatDraft' ? 'Edit chat message' : 'Edit analysis prompt'}
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
            if (onSubmit) submit()
            else finish()
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        ref={textareaRef}
        spellCheck
        style={editorStyle}
        value={value}
        wrap="soft"
      />
      {fieldName === 'chatDraft' && onSubmit ? (
        <button
          className="konva-canvas-chat-send-overlay"
          onClick={(event) => {
            event.stopPropagation()
            submit()
          }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          style={getChatSendButtonStyle(shape, camera)}
          type="button"
        >
          send
        </button>
      ) : null}
    </>
  )
}

export function getEditableKonvaNodeTextField(shape: CanvasNodeShape): KonvaNodeTextFieldName | null {
  if (shape.props.nodeType === 'prompt') return 'prompt'
  if (shape.props.nodeType === 'analysis') return 'analysisPrompt'
  if (shape.props.nodeType === 'chat') return 'chatDraft'
  return null
}

export function getKonvaNodeFieldText(shape: CanvasNodeShape, fieldName: KonvaNodeTextFieldName) {
  const value = shape.props.data[fieldName]
  if (fieldName === 'chatDraft') return getKonvaChatDraft(shape.props.data)
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
    padding: fieldName === 'chatDraft' ? `${2 * zoom}px 0` : `${12 * zoom}px`,
    textAlign: 'left',
    top: `${(shape.y + rect.y) * zoom + camera.y}px`,
    whiteSpace: 'pre-wrap',
    width: `${rect.width * zoom}px`,
  }
}

export function getKonvaNodeFieldRect(shape: CanvasNodeShape, fieldName: KonvaNodeTextFieldName) {
  if (fieldName === 'analysisPrompt') {
    return { height: 64, width: shape.props.width - 28, x: 14, y: 116 }
  }
  if (fieldName === 'chatDraft') {
    return { height: 38, width: shape.props.width - 60, x: 30, y: shape.props.height - 86 }
  }
  return { height: shape.props.height - 78, width: shape.props.width - 28, x: 14, y: 54 }
}

function getChatSendButtonStyle(shape: CanvasNodeShape, camera: CanvasCamera): CSSProperties {
  const zoom = camera.zoom
  const width = 58
  const height = 22
  return {
    background: '#dcfce7',
    border: `${1 * zoom}px solid #22c55e`,
    borderRadius: `${999 * zoom}px`,
    boxSizing: 'border-box',
    color: '#16a34a',
    cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: `${10 * zoom}px`,
    fontWeight: 700,
    height: `${height * zoom}px`,
    left: `${(shape.x + shape.props.width - width - 26) * zoom + camera.x}px`,
    lineHeight: `${20 * zoom}px`,
    padding: 0,
    position: 'absolute',
    top: `${(shape.y + shape.props.height - 47) * zoom + camera.y}px`,
    width: `${width * zoom}px`,
    zIndex: 36,
  }
}
