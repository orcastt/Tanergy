'use client'

import type { PointerEvent, SyntheticEvent } from 'react'
import type { Editor } from 'tldraw'
import { useEditorRevision } from './useEditorRevision'

type CanvasSpikeNavigatorProps = {
  editor: Editor | null
}

const mapWidth = 184
const mapHeight = 116
const mapPadding = 10

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSpikeNavigator({ editor }: CanvasSpikeNavigatorProps) {
  useEditorRevision(editor)

  if (!editor) return null

  const viewportBounds = editor.getViewportPageBounds()
  const contentBounds = editor.getCurrentPageBounds()
  const shapes = editor
    .getCurrentPageShapes()
    .map((shape) => editor.getShapePageBounds(shape.id))
    .filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds))

  const minX = Math.min(contentBounds?.minX ?? viewportBounds.minX, viewportBounds.minX)
  const minY = Math.min(contentBounds?.minY ?? viewportBounds.minY, viewportBounds.minY)
  const maxX = Math.max(contentBounds?.maxX ?? viewportBounds.maxX, viewportBounds.maxX)
  const maxY = Math.max(contentBounds?.maxY ?? viewportBounds.maxY, viewportBounds.maxY)
  const worldWidth = Math.max(maxX - minX, 1)
  const worldHeight = Math.max(maxY - minY, 1)
  const scale = Math.min(
    (mapWidth - mapPadding * 2) / worldWidth,
    (mapHeight - mapPadding * 2) / worldHeight
  )
  const mapContentWidth = worldWidth * scale
  const mapContentHeight = worldHeight * scale
  const offsetX = (mapWidth - mapContentWidth) / 2
  const offsetY = (mapHeight - mapContentHeight) / 2
  const zoomPercent = Math.round(editor.getZoomLevel() * 100)

  const toMapRect = (bounds: { minX: number; minY: number; w: number; h: number }) => ({
    h: Math.max(bounds.h * scale, 2),
    w: Math.max(bounds.w * scale, 2),
    x: offsetX + (bounds.minX - minX) * scale,
    y: offsetY + (bounds.minY - minY) * scale,
  })

  const viewportRect = toMapRect(viewportBounds)

  const jumpToPoint = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * mapWidth
    const y = ((event.clientY - rect.top) / rect.height) * mapHeight
    editor.centerOnPoint(
      {
        x: (x - offsetX) / scale + minX,
        y: (y - offsetY) / scale + minY,
      },
      { animation: { duration: 160 } }
    )
  }

  return (
    <aside
      aria-label="Navigation map"
      className="canvas-navigator"
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <svg
        aria-label="Click to jump to a canvas area"
        className="canvas-navigator__map"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          jumpToPoint(event)
        }}
        role="button"
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
      >
        <rect className="canvas-navigator__map-bg" height={mapHeight} rx="10" width={mapWidth} />
        {shapes.map((bounds, index) => {
          const rect = toMapRect(bounds)
          return (
            <rect
              className="canvas-navigator__shape"
              height={rect.h}
              key={`${bounds.x}-${bounds.y}-${index}`}
              rx="2"
              width={rect.w}
              x={rect.x}
              y={rect.y}
            />
          )
        })}
        <rect
          className="canvas-navigator__viewport"
          height={viewportRect.h}
          rx="4"
          width={viewportRect.w}
          x={viewportRect.x}
          y={viewportRect.y}
        />
      </svg>
      <div className="canvas-navigator__controls">
        <button
          aria-label="Zoom out"
          onClick={() => editor.zoomOut(undefined, { animation: { duration: 120 } })}
          title="Zoom out"
          type="button"
        >
          −
        </button>
        <span>{zoomPercent}%</span>
        <button
          aria-label="Zoom in"
          onClick={() => editor.zoomIn(undefined, { animation: { duration: 120 } })}
          title="Zoom in"
          type="button"
        >
          +
        </button>
      </div>
    </aside>
  )
}
