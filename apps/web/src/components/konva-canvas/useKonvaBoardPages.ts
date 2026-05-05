import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createEmptyCanvasDocument, type CanvasCamera, type CanvasDocument } from '@/features/canvas-engine'
import {
  createKonvaBoardPage,
  defaultKonvaBoardPageId,
  type SerializedKonvaBoardPage,
} from '@/features/boards/konvaBoardPageContract'
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
import type {
  KonvaBoardDocumentSerializationOptions,
  KonvaBoardRestorePayload,
} from '@/features/boards/konvaBoardDocument'
import type { KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'

type UseKonvaBoardPagesOptions = {
  activeDocument: CanvasDocument
  camera: CanvasCamera
  onCameraChange: Dispatch<SetStateAction<CanvasCamera>>
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onTransientClear: () => void
}

export function useKonvaBoardPages({
  activeDocument,
  camera,
  onCameraChange,
  onDocumentChange,
  onTransientClear,
}: UseKonvaBoardPagesOptions) {
  const [activePageId, setActivePageId] = useState(defaultKonvaBoardPageId)
  const [pages, setPages] = useState<SerializedKonvaBoardPage[]>(() => [
    createKonvaBoardPage(activeDocument, {
      id: defaultKonvaBoardPageId,
      title: 'Page 1',
    }),
  ])
  const [revision, setRevision] = useState(0)
  const activeDocumentRef = useRef(activeDocument)
  const activePageIdRef = useRef(activePageId)
  const cameraRef = useRef(camera)
  const pagesRef = useRef(pages)

  useEffect(() => {
    activeDocumentRef.current = activeDocument
    cameraRef.current = camera
  }, [activeDocument, camera])

  useEffect(() => {
    activePageIdRef.current = activePageId
    pagesRef.current = pages
  }, [activePageId, pages])

  const activePageTitle = useMemo(() => (
    pages.find((page) => page.id === activePageId)?.title
    ?? activeDocument.metadata.name
    ?? 'Page 1'
  ), [activeDocument.metadata.name, activePageId, pages])

  const getActiveDocument = useCallback((document: CanvasDocument = activeDocumentRef.current) => ({
    ...document,
    camera: { ...cameraRef.current },
  }), [])

  const getPageEnvelope = useCallback((document: CanvasDocument): KonvaBoardDocumentSerializationOptions => ({
    activePageId: activePageIdRef.current,
    pages: persistActivePage(pagesRef.current, activePageIdRef.current, document),
  }), [])

  const getHistoryState = useCallback((document: CanvasDocument): KonvaCanvasHistoryPageState => ({
    activePageId: activePageIdRef.current,
    pages: persistActivePage(pagesRef.current, activePageIdRef.current, document),
  }), [])

  const selectPage = useCallback((pageId: string) => {
    if (pageId === activePageIdRef.current) return
    const nextPages = persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument())
    const targetPage = nextPages.find((page) => page.id === pageId)
    if (!targetPage) return
    const nextDocument = cloneKonvaPageCanvasDocument(targetPage.canvasDocument)
    pagesRef.current = nextPages
    activePageIdRef.current = targetPage.id
    setPages(nextPages)
    setActivePageId(targetPage.id)
    onDocumentChange(nextDocument)
    onCameraChange(nextDocument.camera)
    onTransientClear()
    setRevision((value) => value + 1)
  }, [getActiveDocument, onCameraChange, onDocumentChange, onTransientClear])

  const createPage = useCallback(() => {
    const currentPages = persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument())
    const title = getNextKonvaBoardPageTitle(currentPages)
    const nextDocument = createEmptyCanvasDocument({
      camera: cameraRef.current,
      name: title,
      shapes: [],
    })
    const nextPage = createKonvaBoardPage(nextDocument, {
      id: createKonvaBoardPageId(),
      index: currentPages.length,
      title,
    })
    const nextPages = normalizeKonvaBoardPageIndexes([...currentPages, nextPage])
    pagesRef.current = nextPages
    activePageIdRef.current = nextPage.id
    setPages(nextPages)
    setActivePageId(nextPage.id)
    onDocumentChange(nextDocument)
    onCameraChange(nextDocument.camera)
    onTransientClear()
    setRevision((value) => value + 1)
  }, [getActiveDocument, onCameraChange, onDocumentChange, onTransientClear])

  const renamePage = useCallback((pageId: string, title: string) => {
    const nextTitle = title.trim()
    if (!nextTitle) return
    const now = new Date().toISOString()
    const nextPages = persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument()).map((page) => {
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
    pagesRef.current = nextPages
    setPages(nextPages)
    if (pageId === activePageIdRef.current) {
      onDocumentChange((current) => ({
        ...current,
        metadata: {
          ...current.metadata,
          name: nextTitle,
          updatedAt: now,
        },
      }))
    }
    setRevision((value) => value + 1)
  }, [getActiveDocument, onDocumentChange])

  const deletePage = useCallback((pageId: string) => {
    const result = deleteKonvaBoardPage(
      persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument()),
      activePageIdRef.current,
      pageId
    )
    if (!result) return
    pagesRef.current = result.pages
    activePageIdRef.current = result.activePageId
    setPages(result.pages)
    setActivePageId(result.activePageId)
    if (result.deletedActivePage && result.document) {
      onDocumentChange(result.document)
      onCameraChange(result.document.camera)
      onTransientClear()
    }
    setRevision((value) => value + 1)
  }, [getActiveDocument, onCameraChange, onDocumentChange, onTransientClear])

  const duplicatePage = useCallback((pageId: string) => {
    const result = duplicateKonvaBoardPage(
      persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument()),
      activePageIdRef.current,
      pageId
    )
    if (!result) return
    pagesRef.current = result.pages
    activePageIdRef.current = result.activePageId
    setPages(result.pages)
    setActivePageId(result.activePageId)
    onDocumentChange(result.document)
    onCameraChange(result.document.camera)
    onTransientClear()
    setRevision((value) => value + 1)
  }, [getActiveDocument, onCameraChange, onDocumentChange, onTransientClear])

  const movePage = useCallback((pageId: string, direction: KonvaBoardPageReorderDirection) => {
    const nextPages = reorderKonvaBoardPage(
      persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument()),
      pageId,
      direction
    )
    if (!nextPages) return
    pagesRef.current = nextPages
    setPages(nextPages)
    setRevision((value) => value + 1)
  }, [getActiveDocument])

  const moveSelectionToPage = useCallback((targetPageId: string, shapeIds: readonly string[]) => {
    const result = moveKonvaSelectionToPage(
      persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument()),
      activePageIdRef.current,
      targetPageId,
      shapeIds
    )
    if (!result) return
    pagesRef.current = result.pages
    setPages(result.pages)
    onDocumentChange(result.document)
    onTransientClear()
    setRevision((value) => value + 1)
  }, [getActiveDocument, onDocumentChange, onTransientClear])

  const restorePages = useCallback((restore: KonvaBoardRestorePayload) => {
    const nextPages = normalizeKonvaBoardPageIndexes(restore.pages)
    pagesRef.current = nextPages
    activePageIdRef.current = restore.activePageId
    setPages(nextPages)
    setActivePageId(restore.activePageId)
    onDocumentChange(restore.document)
    onCameraChange(restore.document.camera)
    onTransientClear()
    setRevision((value) => value + 1)
  }, [onCameraChange, onDocumentChange, onTransientClear])

  const restoreHistoryState = useCallback((state: KonvaCanvasHistoryPageState) => {
    const nextPages = normalizeKonvaBoardPageIndexes(state.pages)
    const activePage = nextPages.find((page) => page.id === state.activePageId) ?? nextPages[0]
    if (!activePage) return
    const nextDocument = cloneKonvaPageCanvasDocument(activePage.canvasDocument)
    pagesRef.current = nextPages
    activePageIdRef.current = activePage.id
    setPages(nextPages)
    setActivePageId(activePage.id)
    onDocumentChange(nextDocument)
    onCameraChange(nextDocument.camera)
    onTransientClear()
    setRevision((value) => value + 1)
  }, [onCameraChange, onDocumentChange, onTransientClear])

  return {
    activePageId,
    activePageTitle,
    createPage,
    deletePage,
    duplicatePage,
    getHistoryState,
    getPageEnvelope,
    movePage,
    moveSelectionToPage,
    pages,
    renamePage,
    restoreHistoryState,
    restorePages,
    revision,
    selectPage,
  }
}

function persistActivePage(
  pages: SerializedKonvaBoardPage[],
  activePageId: string,
  activeDocument: CanvasDocument
) {
  const now = new Date().toISOString()
  let didPersist = false
  const nextPages = normalizeKonvaBoardPageIndexes(pages).map((page, index) => {
    if (page.id !== activePageId) return page
    didPersist = true
    return {
      ...page,
      canvasDocument: cloneKonvaPageCanvasDocument(activeDocument),
      index,
      title: page.title || activeDocument.metadata.name || `Page ${index + 1}`,
      updatedAt: activeDocument.metadata.updatedAt || now,
    }
  })
  if (didPersist) return nextPages
  return normalizeKonvaBoardPageIndexes([
    ...nextPages,
    createKonvaBoardPage(activeDocument, {
      id: activePageId,
      index: nextPages.length,
      title: activeDocument.metadata.name ?? `Page ${nextPages.length + 1}`,
    }),
  ])
}
