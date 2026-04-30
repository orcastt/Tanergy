'use client'

import { useState } from 'react'
import type { PointerEvent, SyntheticEvent } from 'react'
import type { Editor } from 'tldraw'
import { useCanvasPerformanceStore } from '@/features/canvas-performance/canvasPerformanceStore'
import { useEditorInteractionState } from './useEditorInteractionState'
import { useEditorRevision } from './useEditorRevision'
import { canvasMaxZoom } from './useCanvasSettings'

type CanvasSpikeNavigatorProps = {
  editor: Editor | null
}

const mapWidth = 184
const mapHeight = 116
const mapPadding = 10
const maxMapShapeRects = 120

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSpikeNavigator({ editor }: CanvasSpikeNavigatorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const interaction = useEditorInteractionState(editor)
  useEditorRevision(editor, 'viewport-document')
  const imageLikeCount = useCanvasPerformanceStore((state) => state.imageLikeCount)

  if (!editor) return null

  if (isCollapsed) {
    return (
      <aside
        aria-label="Navigation map"
        className="canvas-navigator canvas-navigator--collapsed"
        onDoubleClick={stopCanvasEvent}
        onPointerDown={stopCanvasEvent}
        onWheel={stopCanvasEvent}
      >
        <button
          aria-label="Expand navigation map"
          className="canvas-navigator__expand-btn"
          onClick={(event) => {
            event.stopPropagation()
            setIsCollapsed(false)
          }}
          title="Expand navigation map"
          type="button"
        >
          <span className="canvas-navigator__mini-icon" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </span>
        </button>
      </aside>
    )
  }

  const viewportBounds = editor.getViewportPageBounds()
  const contentBounds = editor.getCurrentPageBounds()
  const pageShapes = editor.getCurrentPageShapes()
  const isMovingView = interaction.isDragging || interaction.isPanning || interaction.cameraState === 'moving'
  const shapeStep = Math.max(1, Math.ceil(pageShapes.length / getMapShapeBudget(imageLikeCount, isMovingView)))
  const shapes = pageShapes
    .filter((_, index) => index % shapeStep === 0)
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
  const zoomLevel = editor.getZoomLevel()
  const zoomPercent = Math.round(zoomLevel * 100)

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
      <button
        aria-label="Collapse navigation map"
        className="canvas-navigator__collapse-btn"
        onClick={(event) => {
          event.stopPropagation()
          setIsCollapsed(true)
        }}
        title="Collapse navigation map"
        type="button"
      >
        <span aria-hidden />
      </button>
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
          disabled={zoomLevel >= canvasMaxZoom}
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

function getMapShapeBudget(imageLikeCount: number, isDragging: boolean) {
  if (isDragging) return 32
  if (imageLikeCount >= 80) return 48
  if (imageLikeCount >= 48) return 72
  return maxMapShapeRects
}
