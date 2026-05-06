'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { boundsToRect, getShapeBounds, type CanvasBounds, type CanvasDocument, type CanvasShape } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import type { KonvaBoardPageReorderDirection } from './konvaBoardPageActions'

type KonvaCanvasPagesPanelProps = {
  activeDocument: CanvasDocument
  activePageId: string
  onCreatePage: () => void
  onDeletePage: (pageId: string) => void
  onDuplicatePage: (pageId: string) => void
  onMovePage: (pageId: string, direction: KonvaBoardPageReorderDirection) => void
  onRenamePage: (pageId: string, title: string) => void
  onSelectPage: (pageId: string) => void
  pages: SerializedKonvaBoardPage[]
  readOnly?: boolean
}

export function KonvaCanvasPagesPanel({
  activeDocument,
  activePageId,
  onCreatePage,
  onDeletePage,
  onDuplicatePage,
  onMovePage,
  onRenamePage,
  onSelectPage,
  pages,
  readOnly = false,
}: KonvaCanvasPagesPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pageSummaries = useMemo(() => pages.map((page) => ({
    ...page,
    canvasDocument: page.id === activePageId ? activeDocument : page.canvasDocument,
    shapeCount: page.id === activePageId ? activeDocument.shapes.length : page.canvasDocument.shapes.length,
  })), [activeDocument, activePageId, pages])

  useEffect(() => {
    if (!editingPageId) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editingPageId])

  const beginRename = (page: SerializedKonvaBoardPage) => {
    if (readOnly) return
    setEditingPageId(page.id)
    setDraftTitle(page.title)
  }

  const commitRename = () => {
    if (!editingPageId) return
    onRenamePage(editingPageId, draftTitle)
    setEditingPageId(null)
  }

  const cancelRename = () => {
    setEditingPageId(null)
  }

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitRename()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelRename()
    }
  }

  return (
    <aside aria-label="Pages" className="konva-canvas-pages-drawer" data-open={isOpen ? 'true' : 'false'} {...canvasEventProps}>
      <button
        aria-label={isOpen ? 'Collapse pages' : 'Expand pages'}
        className="konva-canvas-pages-drawer__handle"
        onClick={() => setIsOpen((open) => !open)}
        title={isOpen ? 'Collapse pages' : 'Expand pages'}
        type="button"
      >
        <span aria-hidden>{isOpen ? '›' : '‹'}</span>
      </button>
      {isOpen ? (
        <div className="konva-canvas-pages">
          <header>
            <strong>Pages</strong>
            {readOnly ? null : <button aria-label="New page" onClick={onCreatePage} type="button">+</button>}
          </header>
          <div className="konva-canvas-pages__list">
            {pageSummaries.map((page) => {
              const isActive = page.id === activePageId
              const isEditing = page.id === editingPageId
              const canDelete = pages.length > 1
              return (
                <div
                  aria-current={isActive ? 'page' : undefined}
                  className="konva-canvas-pages__item"
                  data-active={isActive}
                  key={page.id}
                  onDoubleClick={(event) => {
                    if (readOnly) return
                    event.stopPropagation()
                    beginRename(page)
                  }}
                >
                  <button
                    aria-label={`Open ${page.title}`}
                    className="konva-canvas-pages__thumb"
                    onClick={() => onSelectPage(page.id)}
                    type="button"
                  >
                    {page.thumbnailUrl ? (
                      <span aria-hidden className="konva-canvas-pages__thumb-image" style={{ backgroundImage: `url(${page.thumbnailUrl})` }} />
                    ) : <PageThumbnail document={page.canvasDocument} fallbackIndex={page.index + 1} />}
                  </button>
                  <span className="konva-canvas-pages__meta">
                    {isEditing ? (
                      <input
                        aria-label="Page name"
                        onBlur={commitRename}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={handleTitleKeyDown}
                        ref={inputRef}
                        value={draftTitle}
                      />
                    ) : (
                      <button className="konva-canvas-pages__title" onClick={() => onSelectPage(page.id)} type="button">
                        {page.title}
                      </button>
                    )}
                    <small>{page.shapeCount}</small>
                  </span>
                  {readOnly ? null : (
                    <span className="konva-canvas-pages__actions">
                      <button
                        aria-label={`Move ${page.title} up`}
                        disabled={page.index === 0}
                        onClick={(event) => {
                          event.stopPropagation()
                          onMovePage(page.id, 'up')
                        }}
                        title="Move up"
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Move ${page.title} down`}
                        disabled={page.index >= pages.length - 1}
                        onClick={(event) => {
                          event.stopPropagation()
                          onMovePage(page.id, 'down')
                        }}
                        title="Move down"
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        aria-label={`Duplicate ${page.title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDuplicatePage(page.id)
                        }}
                        title="Duplicate"
                        type="button"
                      >
                        ⧉
                      </button>
                      <button
                        aria-label={`Delete ${page.title}`}
                        disabled={!canDelete}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!window.confirm(`Delete "${page.title}"? This page and its canvas contents will be removed.`)) return
                          onDeletePage(page.id)
                        }}
                        title="Delete"
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function PageThumbnail({ document, fallbackIndex }: { document: CanvasDocument; fallbackIndex: number }) {
  const preview = useMemo(() => getPagePreview(document.shapes), [document.shapes])
  if (!preview) return <span>{fallbackIndex}</span>
  return (
    <svg aria-hidden className="konva-canvas-pages__thumb-svg" viewBox="0 0 84 63">
      <rect fill="#ffffff" height="63" width="84" x="0" y="0" />
      {preview.items.map((item) => (
        <rect
          fill={item.fill}
          height={item.height}
          key={item.id}
          rx={item.rx}
          stroke={item.stroke}
          strokeWidth={item.strokeWidth}
          width={item.width}
          x={item.x}
          y={item.y}
        />
      ))}
    </svg>
  )
}

function getPagePreview(shapes: CanvasShape[]) {
  if (shapes.length === 0) return null
  const bounds = getShapesBounds(shapes)
  if (!bounds) return null
  const rect = boundsToRect(bounds)
  const safeWidth = Math.max(1, rect.width)
  const safeHeight = Math.max(1, rect.height)
  const scale = Math.min(68 / safeWidth, 47 / safeHeight)
  const offsetX = (84 - safeWidth * scale) / 2
  const offsetY = (63 - safeHeight * scale) / 2
  const visibleShapes = shapes.slice(-36)
  return {
    items: visibleShapes.map((shape) => {
      const shapeBounds = getShapeBounds(shape)
      const shapeRect = boundsToRect(shapeBounds)
      const width = Math.max(1.5, shapeRect.width * scale)
      const height = Math.max(1.5, shapeRect.height * scale)
      return {
        fill: getPreviewFill(shape),
        height,
        id: shape.id,
        rx: getPreviewRadius(shape),
        stroke: shape.style?.stroke ?? '#5b4bdb',
        strokeWidth: shape.type === 'stroke' || shape.type === 'line' || shape.type === 'arrow' ? 1.8 : 1,
        width,
        x: offsetX + (shapeRect.x - rect.x) * scale,
        y: offsetY + (shapeRect.y - rect.y) * scale,
      }
    }),
  }
}

function getShapesBounds(shapes: CanvasShape[]) {
  return shapes.map(getShapeBounds).reduce<CanvasBounds | null>((current, bounds) => {
    if (!current) return bounds
    return {
      maxX: Math.max(current.maxX, bounds.maxX),
      maxY: Math.max(current.maxY, bounds.maxY),
      minX: Math.min(current.minX, bounds.minX),
      minY: Math.min(current.minY, bounds.minY),
    }
  }, null)
}

function getPreviewFill(shape: CanvasShape) {
  if (shape.type === 'image') return '#dbeafe'
  if (shape.type === 'node_card') return '#f5f3ff'
  if (shape.type === 'sticky') return '#fef3c7'
  if (shape.type === 'stroke' || shape.type === 'line' || shape.type === 'arrow') return shape.style?.stroke ?? '#5b4bdb'
  return shape.style?.fill ?? '#eef2ff'
}

function getPreviewRadius(shape: CanvasShape) {
  if (shape.type === 'ellipse') return 999
  if (shape.type === 'sticky' || shape.type === 'node_card') return 4
  return 2
}

const canvasEventProps = {
  onContextMenu: stopCanvasEvent,
  onDoubleClick: stopCanvasEvent,
  onPointerDown: stopCanvasEvent,
  onWheel: stopCanvasEvent,
}

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}
