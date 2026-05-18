'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import type { KonvaBoardPageReorderDirection } from './konvaBoardPageActions'
import { KonvaCanvasPageLimitDialog } from './KonvaCanvasPageLimitDialog'
import { KonvaCanvasPageThumbnail } from './KonvaCanvasPageThumbnail'

type KonvaCanvasPagesPanelProps = {
  activeDocument: CanvasDocument
  activePageId: string
  onCreatePage: () => void
  onDeletePage: (pageId: string) => void
  onDuplicatePage: (pageId: string) => void
  onMovePage: (pageId: string, direction: KonvaBoardPageReorderDirection) => void
  onRenamePage: (pageId: string, title: string) => void
  onSelectPage: (pageId: string) => void
  pageLimit?: number | null
  pageLimitPlanName?: string
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
  pageLimit = null,
  pageLimitPlanName,
  pages,
  readOnly = false,
}: KonvaCanvasPagesPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [limitDialogOpen, setLimitDialogOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const resolvedPageLimit = typeof pageLimit === 'number' && Number.isFinite(pageLimit) && pageLimit >= 0
    ? Math.floor(pageLimit)
    : null
  const isAtPageLimit = resolvedPageLimit !== null && pages.length >= resolvedPageLimit
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

  const requestCreatePage = () => {
    if (readOnly) return
    if (isAtPageLimit) {
      setLimitDialogOpen(true)
      return
    }
    onCreatePage()
  }

  const requestDuplicatePage = (pageId: string) => {
    if (readOnly) return
    if (isAtPageLimit) {
      setLimitDialogOpen(true)
      return
    }
    onDuplicatePage(pageId)
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
            <span className="konva-canvas-pages__heading">
              <strong>Pages</strong>
              {resolvedPageLimit !== null ? <small>{pages.length}/{resolvedPageLimit}</small> : null}
            </span>
            {readOnly ? null : <button aria-label="New page" onClick={requestCreatePage} type="button">+</button>}
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
                    ) : <KonvaCanvasPageThumbnail document={page.canvasDocument} fallbackIndex={page.index + 1} />}
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
                          requestDuplicatePage(page.id)
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
          {limitDialogOpen ? (
            <KonvaCanvasPageLimitDialog
              onClose={() => setLimitDialogOpen(false)}
              pageLimit={resolvedPageLimit ?? 3}
              planName={pageLimitPlanName}
            />
          ) : null}
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
