import type { CanvasDocument } from '@/features/canvas-engine'
import { createEmptyCanvasDocument } from '@/features/canvas-engine'
import { createKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import {
  cloneKonvaPageCanvasDocument,
  createKonvaBoardPageId,
  deleteKonvaBoardPage,
  duplicateKonvaBoardPage,
  getNextKonvaBoardPageTitle,
  moveKonvaSelectionToPage,
  normalizeKonvaBoardPageIndexes,
  reorderKonvaBoardPage,
  type KonvaBoardPageReorderDirection,
} from './konvaBoardPageActions'
import {
  persistActivePage,
  type BoardPageRefs,
  type BoardPageSetters,
  type NoteCollaborationChange,
} from './konvaBoardPageSync'

export function selectKonvaBoardPage({
  activeDocument,
  pageId,
  refs,
  setters,
}: {
  activeDocument: CanvasDocument
  pageId: string
  refs: BoardPageRefs
  setters: BoardPageSetters
}) {
  if (pageId === refs.activePageIdRef.current) return
  const nextPages = persistActivePage(refs.pagesRef.current, refs.activePageIdRef.current, activeDocument)
  const targetPage = nextPages.find((page) => page.id === pageId)
  if (!targetPage) return
  const nextDocument = cloneKonvaPageCanvasDocument(targetPage.canvasDocument)
  refs.pagesRef.current = nextPages
  refs.activePageIdRef.current = targetPage.id
  setters.setPages(nextPages)
  setters.setActivePageId(targetPage.id)
  setters.onDocumentChange(nextDocument)
  setters.onCameraChange(nextDocument.camera)
  setters.onTransientClear()
  setters.setRevision((value) => value + 1)
}

export function createKonvaBoardPageMutation({
  activeDocument,
  noteCollaborationChange,
  refs,
  setters,
}: {
  activeDocument: CanvasDocument
  noteCollaborationChange: NoteCollaborationChange
  refs: BoardPageRefs
  setters: BoardPageSetters
}) {
  const previousActivePageId = refs.activePageIdRef.current
  const currentPages = persistActivePage(refs.pagesRef.current, previousActivePageId, activeDocument)
  const title = getNextKonvaBoardPageTitle(currentPages)
  const nextDocument = createEmptyCanvasDocument({
    camera: refs.cameraRef.current,
    name: title,
    shapes: [],
  })
  const nextPage = createKonvaBoardPage(nextDocument, {
    id: createKonvaBoardPageId(),
    index: currentPages.length,
    title,
  })
  const nextPages = normalizeKonvaBoardPageIndexes([...currentPages, nextPage])
  refs.pagesRef.current = nextPages
  refs.activePageIdRef.current = nextPage.id
  setters.setPages(nextPages)
  setters.setActivePageId(nextPage.id)
  setters.onDocumentChange(nextDocument)
  setters.onCameraChange(nextDocument.camera)
  setters.onTransientClear()
  setters.setRevision((value) => value + 1)
  noteCollaborationChange([previousActivePageId, nextPage.id])
}

export function renameKonvaBoardPage({
  activeDocument,
  noteCollaborationChange,
  pageId,
  refs,
  setters,
  title,
}: {
  activeDocument: CanvasDocument
  noteCollaborationChange: NoteCollaborationChange
  pageId: string
  refs: BoardPageRefs
  setters: BoardPageSetters
  title: string
}) {
  const nextTitle = title.trim()
  if (!nextTitle) return
  const now = new Date().toISOString()
  const nextPages = persistActivePage(refs.pagesRef.current, refs.activePageIdRef.current, activeDocument).map((page) => {
    if (page.id !== pageId) return page
    return {
      ...page,
      canvasDocument: {
        ...page.canvasDocument,
        metadata: {
          ...page.canvasDocument.metadata,
          name: nextTitle,
          updatedAt: now,
        },
      },
      title: nextTitle,
      updatedAt: now,
    }
  })
  refs.pagesRef.current = nextPages
  setters.setPages(nextPages)
  if (pageId === refs.activePageIdRef.current) {
    setters.onDocumentChange((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        name: nextTitle,
        updatedAt: now,
      },
    }))
  }
  setters.setRevision((value) => value + 1)
  noteCollaborationChange([pageId])
}

export function deleteKonvaBoardPageMutation({
  activeDocument,
  noteCollaborationChange,
  pageId,
  refs,
  setters,
}: {
  activeDocument: CanvasDocument
  noteCollaborationChange: NoteCollaborationChange
  pageId: string
  refs: BoardPageRefs
  setters: BoardPageSetters
}) {
  const previousActivePageId = refs.activePageIdRef.current
  const result = deleteKonvaBoardPage(
    persistActivePage(refs.pagesRef.current, previousActivePageId, activeDocument),
    previousActivePageId,
    pageId,
  )
  if (!result) return
  refs.pagesRef.current = result.pages
  refs.activePageIdRef.current = result.activePageId
  setters.setPages(result.pages)
  setters.setActivePageId(result.activePageId)
  if (result.deletedActivePage && result.document) {
    setters.onDocumentChange(result.document)
    setters.onCameraChange(result.document.camera)
    setters.onTransientClear()
  }
  setters.setRevision((value) => value + 1)
  noteCollaborationChange([pageId, previousActivePageId, result.activePageId])
}

export function duplicateKonvaBoardPageMutation({
  activeDocument,
  noteCollaborationChange,
  pageId,
  refs,
  setters,
}: {
  activeDocument: CanvasDocument
  noteCollaborationChange: NoteCollaborationChange
  pageId: string
  refs: BoardPageRefs
  setters: BoardPageSetters
}) {
  const result = duplicateKonvaBoardPage(
    persistActivePage(refs.pagesRef.current, refs.activePageIdRef.current, activeDocument),
    refs.activePageIdRef.current,
    pageId,
  )
  if (!result) return
  refs.pagesRef.current = result.pages
  refs.activePageIdRef.current = result.activePageId
  setters.setPages(result.pages)
  setters.setActivePageId(result.activePageId)
  setters.onDocumentChange(result.document)
  setters.onCameraChange(result.document.camera)
  setters.onTransientClear()
  setters.setRevision((value) => value + 1)
  noteCollaborationChange([pageId, result.activePageId])
}

export function moveKonvaBoardPageMutation({
  activeDocument,
  direction,
  noteCollaborationChange,
  pageId,
  refs,
  setters,
}: {
  activeDocument: CanvasDocument
  direction: KonvaBoardPageReorderDirection
  noteCollaborationChange: NoteCollaborationChange
  pageId: string
  refs: BoardPageRefs
  setters: BoardPageSetters
}) {
  const nextPages = reorderKonvaBoardPage(
    persistActivePage(refs.pagesRef.current, refs.activePageIdRef.current, activeDocument),
    pageId,
    direction,
  )
  if (!nextPages) return
  refs.pagesRef.current = nextPages
  setters.setPages(nextPages)
  setters.setRevision((value) => value + 1)
  noteCollaborationChange([pageId])
}

export function moveKonvaSelectionToBoardPage({
  activeDocument,
  noteCollaborationChange,
  refs,
  setters,
  shapeIds,
  targetPageId,
}: {
  activeDocument: CanvasDocument
  noteCollaborationChange: NoteCollaborationChange
  refs: BoardPageRefs
  setters: BoardPageSetters
  shapeIds: readonly string[]
  targetPageId: string
}) {
  const previousActivePageId = refs.activePageIdRef.current
  const result = moveKonvaSelectionToPage(
    persistActivePage(refs.pagesRef.current, previousActivePageId, activeDocument),
    previousActivePageId,
    targetPageId,
    shapeIds,
  )
  if (!result) return
  refs.pagesRef.current = result.pages
  setters.setPages(result.pages)
  setters.onDocumentChange(result.document)
  setters.onTransientClear()
  setters.setRevision((value) => value + 1)
  noteCollaborationChange([previousActivePageId, targetPageId])
}

export function updateKonvaBoardPageDocument({
  activeDocument,
  noteCollaborationChange,
  pageId,
  refs,
  setters,
  updater,
}: {
  activeDocument: CanvasDocument
  noteCollaborationChange: NoteCollaborationChange
  pageId: string
  refs: BoardPageRefs
  setters: BoardPageSetters
  updater: (document: CanvasDocument) => CanvasDocument
}) {
  const currentPages = persistActivePage(refs.pagesRef.current, refs.activePageIdRef.current, activeDocument)
  const now = new Date().toISOString()
  let didUpdate = false
  const nextPages = currentPages.map((page) => {
    if (page.id !== pageId) return page
    didUpdate = true
    const nextDocument = updater(cloneKonvaPageCanvasDocument(page.canvasDocument))
    return {
      ...page,
      canvasDocument: nextDocument,
      index: page.index,
      title: page.title || nextDocument.metadata.name || `Page ${page.index + 1}`,
      updatedAt: nextDocument.metadata.updatedAt || now,
    }
  })
  if (!didUpdate) return false
  refs.pagesRef.current = nextPages
  setters.setPages(nextPages)
  if (pageId === refs.activePageIdRef.current) {
    const activePage = nextPages.find((page) => page.id === pageId)
    if (activePage) setters.onDocumentChange(cloneKonvaPageCanvasDocument(activePage.canvasDocument))
  }
  setters.setRevision((value) => value + 1)
  noteCollaborationChange([pageId])
  return true
}
