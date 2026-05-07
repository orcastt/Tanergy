'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Editor } from 'tldraw'
import type { NodeType } from '@/types/nodeRuntime'

type CanvasNodePickerProps = {
  editor: Editor | null
  onSelect: (type: NodeType) => void
}

const categories = [
  {
    items: [
      { label: 'Prompt', type: 'prompt' as NodeType },
      { label: 'Prompt Optimizer', type: 'prompt_optimizer' as NodeType },
      { label: 'Chat', type: 'chat' as NodeType },
      { label: 'Analysis', type: 'analysis' as NodeType },
    ],
    title: 'Text',
  },
  {
    items: [
      { label: 'Image Gen', type: 'image_gen' as NodeType },
      { label: 'Image Gen 4', type: 'image_gen_4' as NodeType },
      { label: 'Image', type: 'image' as NodeType },
    ],
    title: 'Image',
  },
]

export function CanvasNodePicker({ editor, onSelect }: CanvasNodePickerProps) {
  const [open, setOpen] = useState(false)
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!editor) return
    const handleCanvasDblClick = (event: Event) => {
      const mouseEvent = event as PointerEvent
      const target = event.target as HTMLElement
      if (target.closest('.node-card-shape') || target.closest('.canvas-spike-toolbar')) return
      setScreenPos({ x: mouseEvent.clientX, y: mouseEvent.clientY })
      setOpen(true)
    }
    const stage = document.querySelector('.canvas-spike-stage')
    if (!stage) return
    stage.addEventListener('dblclick', handleCanvasDblClick)
    return () => { stage.removeEventListener('dblclick', handleCanvasDblClick) }
  }, [editor])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.node-picker')) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const handleSelect = useCallback((type: NodeType) => {
    setOpen(false)
    onSelect(type)
  }, [onSelect])

  if (!open || !editor) return null

  return (
    <div
      className="node-picker"
      onPointerDown={(e) => e.stopPropagation()}
      style={{ left: screenPos.x, top: screenPos.y }}
    >
      {categories.map((category, catIndex) => (
        <div className="node-picker__group" key={category.title}>
          {catIndex > 0 ? <div className="node-picker__divider" /> : null}
          <span className="node-picker__group-label">{category.title}</span>
          <div className="node-picker__items">
            {category.items.map((node) => (
              <button
                className={`node-picker__item node-picker__item--${node.type}`}
                key={node.type}
                onClick={() => handleSelect(node.type)}
                type="button"
              >
                {node.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
