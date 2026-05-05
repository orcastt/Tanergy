import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createEmptyCanvasDocument, type CanvasCamera, type CanvasDocument } from '@/features/canvas-engine'
import {
  createKonvaBoardPage,
  defaultKonvaBoardPageId,
  type SerializedKonvaBoardPage,
} from '@/features/boards/konvaBoardPageContract'
import type {
  KonvaBoardDocumentSerializationOptions,
  KonvaBoardRestorePayload,
} from '@/features/boards/konvaBoardDocument'

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

  const selectPage = useCallback((pageId: string) => {
    if (pageId === activePageIdRef.current) return
    const nextPages = persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument())
    const targetPage = nextPages.find((page) => page.id === pageId)
    if (!targetPage) return
    const nextDocument = cloneCanvasDocument(targetPage.canvasDocument)
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
    const title = getNextPageTitle(currentPages)
    const nextDocument = createEmptyCanvasDocument({
      camera: cameraRef.current,
      name: title,
      shapes: [],
    })
    const nextPage = createKonvaBoardPage(nextDocument, {
      id: createPageId(),
      index: currentPages.length,
      title,
    })
    const nextPages = normalizePageIndexes([...currentPages, nextPage])
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

  const restorePages = useCallback((restore: KonvaBoardRestorePayload) => {
    const nextPages = normalizePageIndexes(restore.pages)
    pagesRef.current = nextPages
    activePageIdRef.current = restore.activePageId
    setPages(nextPages)
    setActivePageId(restore.activePageId)
    onDocumentChange(restore.document)
    onCameraChange(restore.document.camera)
    onTransientClear()
    setRevision((value) => value + 1)
  }, [onCameraChange, onDocumentChange, onTransientClear])

  return {
    activePageId,
    activePageTitle,
    createPage,
    getPageEnvelope,
    pages,
    renamePage,
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
  const nextPages = normalizePageIndexes(pages).map((page, index) => {
    if (page.id !== activePageId) return page
    didPersist = true
    return {
      ...page,
      canvasDocument: cloneCanvasDocument(activeDocument),
      index,
      title: page.title || activeDocument.metadata.name || `Page ${index + 1}`,
      updatedAt: activeDocument.metadata.updatedAt || now,
    }
  })
  if (didPersist) return nextPages
  return normalizePageIndexes([
    ...nextPages,
    createKonvaBoardPage(activeDocument, {
      id: activePageId,
      index: nextPages.length,
      title: activeDocument.metadata.name ?? `Page ${nextPages.length + 1}`,
    }),
  ])
}

function normalizePageIndexes(pages: SerializedKonvaBoardPage[]) {
  return [...pages]
    .sort((a, b) => a.index - b.index || a.id.localeCompare(b.id))
    .map((page, index) => ({ ...page, index }))
}

function getNextPageTitle(pages: SerializedKonvaBoardPage[]) {
  const usedTitles = new Set(pages.map((page) => page.title.trim()))
  for (let index = pages.length + 1; index < pages.length + 1000; index += 1) {
    const title = `Page ${index}`
    if (!usedTitles.has(title)) return title
  }
  return `Page ${pages.length + 1}`
}

function createPageId() {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function cloneCanvasDocument(document: CanvasDocument) {
  return typeof structuredClone === 'function'
    ? structuredClone(document) as CanvasDocument
    : JSON.parse(JSON.stringify(document)) as CanvasDocument
}
