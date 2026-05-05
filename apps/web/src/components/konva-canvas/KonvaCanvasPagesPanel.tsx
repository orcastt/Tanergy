'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'

type KonvaCanvasPagesPanelProps = {
  activeDocument: CanvasDocument
  activePageId: string
  onCreatePage: () => void
  onRenamePage: (pageId: string, title: string) => void
  onSelectPage: (pageId: string) => void
  pages: SerializedKonvaBoardPage[]
}

export function KonvaCanvasPagesPanel({
  activeDocument,
  activePageId,
  onCreatePage,
  onRenamePage,
  onSelectPage,
  pages,
}: KonvaCanvasPagesPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pageSummaries = useMemo(() => pages.map((page) => ({
    ...page,
    shapeCount: page.id === activePageId ? activeDocument.shapes.length : page.canvasDocument.shapes.length,
  })), [activeDocument.shapes.length, activePageId, pages])

  useEffect(() => {
    if (!editingPageId) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editingPageId])

  const beginRename = (page: SerializedKonvaBoardPage) => {
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
            <button aria-label="New page" onClick={onCreatePage} type="button">+</button>
          </header>
          <div className="konva-canvas-pages__list">
            {pageSummaries.map((page) => {
              const isActive = page.id === activePageId
              const isEditing = page.id === editingPageId
              return (
                <div
                  aria-current={isActive ? 'page' : undefined}
                  className="konva-canvas-pages__item"
                  data-active={isActive}
                  key={page.id}
                  onDoubleClick={(event) => {
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
                    ) : <span>{page.index + 1}</span>}
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
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </aside>
  )
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
