import type { CanvasDocument } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import { mergeKonvaBoardPages } from '@/features/collaboration/konvaYjsPageMerge'
import { cloneKonvaPageCanvasDocument, normalizeKonvaBoardPageIndexes } from './konvaBoardPageActions'
import {
  persistActivePage,
  type BoardPageRefs,
  type BoardPageSetters,
  type RemotePageApplyOptions,
  type RemotePageApplyResult,
} from './konvaBoardPageSync'

export function applyRemoteKonvaPageChanges({
  activeDocument,
  incomingPages,
  options = {},
  refs,
  setters,
}: {
  activeDocument: CanvasDocument
  incomingPages: SerializedKonvaBoardPage[]
  options?: RemotePageApplyOptions
  refs: BoardPageRefs
  setters: BoardPageSetters
}): RemotePageApplyResult {
  const currentPages = persistActivePage(refs.pagesRef.current, refs.activePageIdRef.current, activeDocument)
  const normalizedIncomingPages = normalizeKonvaBoardPageIndexes(incomingPages)
  if (normalizedIncomingPages.length === 0) {
    return { activePageChanged: false, applied: false }
  }

  const activePageId = refs.activePageIdRef.current
  const currentPageMap = new Map(currentPages.map((page) => [page.id, page]))
  const nextPages = options.basePages && options.basePages.length > 0
    ? preserveRemoteApplyCamera(
        mergeKonvaBoardPages(
          currentPages,
          normalizedIncomingPages,
          normalizeKonvaBoardPageIndexes(options.basePages),
        ),
        activePageId,
        options.preserveCamera ? refs.cameraRef.current : null,
      )
    : replaceRemotePages(currentPages, normalizedIncomingPages, {
        activePageId,
        changedPageIds: options.changedPageIds,
        preserveCamera: options.preserveCamera ? refs.cameraRef.current : null,
      })
  const didApply = !isSameJsonValue(currentPages, nextPages)

  if (!didApply) return { activePageChanged: false, applied: false }

  const nextActivePage = nextPages.find((page) => page.id === activePageId)
    ?? nextPages.find((page) => page.id === options.remoteActivePageId)
    ?? nextPages[0]
  if (!nextActivePage) {
    return { activePageChanged: false, applied: false }
  }

  const currentActivePage = currentPageMap.get(activePageId)
  const activePageChanged = nextActivePage.id !== activePageId || !isSameJsonValue(currentActivePage, nextActivePage)
  refs.pagesRef.current = nextPages
  setters.setPages(nextPages)
  if (activePageChanged) {
    const nextDocument = cloneKonvaPageCanvasDocument(nextActivePage.canvasDocument)
    refs.activePageIdRef.current = nextActivePage.id
    setters.setActivePageId(nextActivePage.id)
    setters.onDocumentChange(nextDocument)
    setters.onCameraChange(nextDocument.camera)
    setters.onTransientClear()
  } else if (refs.activePageIdRef.current !== nextActivePage.id) {
    refs.activePageIdRef.current = nextActivePage.id
    setters.setActivePageId(nextActivePage.id)
  }
  setters.setRevision((value) => value + 1)
  return {
    activePageChanged,
    applied: true,
  }
}

function replaceRemotePages(
  currentPages: SerializedKonvaBoardPage[],
  incomingPages: SerializedKonvaBoardPage[],
  options: {
    activePageId: string
    changedPageIds?: readonly string[]
    preserveCamera?: { x: number; y: number; zoom: number } | null
  },
) {
  const changedPageIds = new Set(options.changedPageIds ?? [])
  const currentPageMap = new Map(currentPages.map((page) => [page.id, page]))

  return incomingPages.map((incomingPage, index) => {
    const currentPage = currentPageMap.get(incomingPage.id)
    if (!currentPage) return incomingPage
    const shouldReplace = changedPageIds.size === 0 || changedPageIds.has(incomingPage.id)
    if (!shouldReplace) {
      return {
        ...currentPage,
        index,
      }
    }
    const nextPageDocument = cloneKonvaPageCanvasDocument(incomingPage.canvasDocument)
    if (incomingPage.id === options.activePageId && options.preserveCamera) {
      nextPageDocument.camera = { ...options.preserveCamera }
    }
    return {
      ...incomingPage,
      canvasDocument: nextPageDocument,
      index,
    }
  })
}

function preserveRemoteApplyCamera(
  pages: SerializedKonvaBoardPage[],
  activePageId: string,
  camera: { x: number; y: number; zoom: number } | null,
) {
  if (!camera) return pages
  return pages.map((page) => {
    if (page.id !== activePageId) return page
    const nextDocument = cloneKonvaPageCanvasDocument(page.canvasDocument)
    nextDocument.camera = { ...camera }
    return {
      ...page,
      canvasDocument: nextDocument,
    }
  })
}

function isSameJsonValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
