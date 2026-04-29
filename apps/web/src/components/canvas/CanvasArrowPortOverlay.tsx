'use client'

import { useEffect, useReducer } from 'react'
import type { Editor } from 'tldraw'
import { getArrowPortOverlayState } from './useArrowPortSnapping'
import { useEditorRevision } from './useEditorRevision'

type CanvasArrowPortOverlayProps = {
  editor: Editor | null
}

export function CanvasArrowPortOverlay({ editor }: CanvasArrowPortOverlayProps) {
  const [, bumpPointerRevision] = useReducer((revision: number) => revision + 1, 0)
  useEditorRevision(editor)

  useEffect(() => {
    if (!editor) return

    const updateOverlay = () => bumpPointerRevision()
    editor.on('event', updateOverlay)
    editor.on('resize', updateOverlay)

    return () => {
      editor.off('event', updateOverlay)
      editor.off('resize', updateOverlay)
    }
  }, [editor])

  if (!editor) return null

  const overlayState = getArrowPortOverlayState(editor)
  if (overlayState.ports.length === 0 && overlayState.shapes.length === 0) return null

  return (
    <div className="canvas-arrow-port-overlay" aria-hidden>
      <svg className="canvas-arrow-shape-overlay">
        {overlayState.shapes.map((highlight) => {
          const points = highlight.pagePoints
            .map((pagePoint) => {
              const screenPoint = editor.pageToScreen(pagePoint)
              return `${screenPoint.x},${screenPoint.y}`
            })
            .join(' ')

          return (
            <polygon
              className="canvas-arrow-shape-highlight"
              data-role={highlight.role}
              key={highlight.id}
              points={points}
            />
          )
        })}
      </svg>

      {overlayState.ports.map((highlight) => {
        const screenPoint = editor.pageToScreen(highlight.pagePoint)

        return (
          <div
            className="canvas-arrow-port"
            data-active={highlight.isActive}
            data-role={highlight.role}
            data-type={highlight.dataType}
            key={highlight.id}
            style={{ left: screenPoint.x, top: screenPoint.y }}
          />
        )
      })}
    </div>
  )
}
