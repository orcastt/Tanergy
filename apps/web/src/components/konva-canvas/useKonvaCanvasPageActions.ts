'use client'

import { useCallback } from 'react'
import type { CanvasDocument } from '@/features/canvas-engine'
import { normalizeUserLabelInput } from '@/features/security/safeText'
import type { useKonvaBoardPages } from './useKonvaBoardPages'

type UseKonvaCanvasPageActionsOptions = {
  boardPages: ReturnType<typeof useKonvaBoardPages>
  document: CanvasDocument
  history: {
    checkpoint: (document?: CanvasDocument) => void
  }
  selectedIds: string[]
}

export function useKonvaCanvasPageActions({
  boardPages,
  document,
  history,
  selectedIds,
}: UseKonvaCanvasPageActionsOptions) {
  const handleCreatePage = useCallback(() => {
    history.checkpoint(document)
    boardPages.createPage()
  }, [boardPages, document, history])

  const handleDeletePage = useCallback((pageId: string) => {
    history.checkpoint(document)
    boardPages.deletePage(pageId)
  }, [boardPages, document, history])

  const handleDuplicatePage = useCallback((pageId: string) => {
    history.checkpoint(document)
    boardPages.duplicatePage(pageId)
  }, [boardPages, document, history])

  const handleMovePage = useCallback((pageId: string, direction: Parameters<typeof boardPages.movePage>[1]) => {
    history.checkpoint(document)
    boardPages.movePage(pageId, direction)
  }, [boardPages, document, history])

  const handleRenamePage = useCallback((pageId: string, title: string) => {
    const nextTitle = normalizeUserLabelInput(title)
    const currentTitle = boardPages.pages.find((page) => page.id === pageId)?.title.trim()
    if (!nextTitle || nextTitle === currentTitle) return
    history.checkpoint(document)
    boardPages.renamePage(pageId, nextTitle)
  }, [boardPages, document, history])

  const handleMoveSelectionToPage = useCallback((targetPageId: string) => {
    history.checkpoint(document)
    boardPages.moveSelectionToPage(targetPageId, selectedIds)
  }, [boardPages, document, history, selectedIds])

  return {
    handleCreatePage,
    handleDeletePage,
    handleDuplicatePage,
    handleMovePage,
    handleMoveSelectionToPage,
    handleRenamePage,
  }
}
