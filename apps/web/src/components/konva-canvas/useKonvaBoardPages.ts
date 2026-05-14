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
import { mergeKonvaBoardPages } from '@/features/collaboration/konvaYjsPageMerge'
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

type RestorePageOptions = {
  bumpCollaborationRevision?: boolean
  preserveActivePage?: boolean
  preserveCamera?: boolean
}

type RemotePageApplyResult = {
  activePageChanged: boolean
  applied: boolean
}

type RemotePageApplyOptions = {
  basePages?: SerializedKonvaBoardPage[]
  changedPageIds?: readonly string[]
  preserveCamera?: boolean
  remoteActivePageId?: string
}

type CollaborationChange = {
  changedPageIds: string[]
  requiresFullBoardSync: boolean
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
  const [collaborationChange, setCollaborationChange] = useState<CollaborationChange>({
    changedPageIds: [defaultKonvaBoardPageId],
    requiresFullBoardSync: true,
  })
  const [revision, setRevision] = useState(0)
  const [collaborationRevision, setCollaborationRevision] = useState(0)
  const activeDocumentRef = useRef(activeDocument)
  const activePageIdRef = useRef(activePageId)
  const cameraRef = useRef(camera)
  const collaborationChangeRef = useRef<CollaborationChange>({
    changedPageIds: [defaultKonvaBoardPageId],
    requiresFullBoardSync: true,
  })
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

  const noteCollaborationChange = useCallback((
    changedPageIds: readonly string[],
    options: { requiresFullBoardSync?: boolean } = {},
  ) => {
    const nextChange = {
      changedPageIds: [...new Set(changedPageIds.filter((pageId): pageId is string => typeof pageId === 'string' && pageId.length > 0))],
      requiresFullBoardSync: Boolean(options.requiresFullBoardSync),
    }
    collaborationChangeRef.current = nextChange
    setCollaborationChange(nextChange)
    setCollaborationRevision((value) => value + 1)
  }, [])

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
    const previousActivePageId = activePageIdRef.current
    const currentPages = persistActivePage(pagesRef.current, previousActivePageId, getActiveDocument())
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
    noteCollaborationChange([previousActivePageId, nextPage.id])
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

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
    noteCollaborationChange([pageId])
  }, [getActiveDocument, noteCollaborationChange, onDocumentChange])

  const deletePage = useCallback((pageId: string) => {
    const previousActivePageId = activePageIdRef.current
    const result = deleteKonvaBoardPage(
      persistActivePage(pagesRef.current, previousActivePageId, getActiveDocument()),
      previousActivePageId,
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
    noteCollaborationChange([pageId, previousActivePageId, result.activePageId])
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

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
    noteCollaborationChange([pageId, result.activePageId])
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

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
    noteCollaborationChange([pageId])
  }, [getActiveDocument, noteCollaborationChange])

  const moveSelectionToPage = useCallback((targetPageId: string, shapeIds: readonly string[]) => {
    const previousActivePageId = activePageIdRef.current
    const result = moveKonvaSelectionToPage(
      persistActivePage(pagesRef.current, previousActivePageId, getActiveDocument()),
      previousActivePageId,
      targetPageId,
      shapeIds
    )
    if (!result) return
    pagesRef.current = result.pages
    setPages(result.pages)
    onDocumentChange(result.document)
    onTransientClear()
    setRevision((value) => value + 1)
    noteCollaborationChange([previousActivePageId, targetPageId])
  }, [getActiveDocument, noteCollaborationChange, onDocumentChange, onTransientClear])

  const updatePageDocument = useCallback((
    pageId: string,
    updater: (document: CanvasDocument) => CanvasDocument,
  ) => {
    const currentPages = persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument())
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
    pagesRef.current = nextPages
    setPages(nextPages)
    if (pageId === activePageIdRef.current) {
      const activePage = nextPages.find((page) => page.id === pageId)
      if (activePage) onDocumentChange(cloneKonvaPageCanvasDocument(activePage.canvasDocument))
    }
    setRevision((value) => value + 1)
    noteCollaborationChange([pageId])
    return true
  }, [getActiveDocument, noteCollaborationChange, onDocumentChange])

  const restorePages = useCallback((restore: KonvaBoardRestorePayload, options: RestorePageOptions = {}) => {
    const nextPages = normalizeKonvaBoardPageIndexes(restore.pages)
    const preferredActivePageId = options.preserveActivePage
      ? activePageIdRef.current
      : restore.activePageId
    const activePage = nextPages.find((page) => page.id === preferredActivePageId)
      ?? nextPages.find((page) => page.id === restore.activePageId)
      ?? nextPages[0]
    if (!activePage) return

    const shouldPreserveCamera = Boolean(options.preserveActivePage && options.preserveCamera && activePage.id === activePageIdRef.current)
    const nextCamera = shouldPreserveCamera ? { ...cameraRef.current } : { ...activePage.canvasDocument.camera }
    const nextDocument = cloneKonvaPageCanvasDocument(activePage.canvasDocument)
    nextDocument.camera = nextCamera
    const resolvedPages = shouldPreserveCamera
      ? nextPages.map((page) => {
          if (page.id !== activePage.id) return page
          const pageDocument = cloneKonvaPageCanvasDocument(page.canvasDocument)
          pageDocument.camera = nextCamera
          return {
            ...page,
            canvasDocument: pageDocument,
          }
        })
      : nextPages

    pagesRef.current = resolvedPages
    activePageIdRef.current = activePage.id
    setPages(resolvedPages)
    setActivePageId(activePage.id)
    onDocumentChange(nextDocument)
    onCameraChange(nextCamera)
    onTransientClear()
    setRevision((value) => value + 1)
    if (options.bumpCollaborationRevision ?? true) {
      noteCollaborationChange(resolvedPages.map((page) => page.id), { requiresFullBoardSync: true })
    }
  }, [noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

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
    noteCollaborationChange(nextPages.map((page) => page.id), { requiresFullBoardSync: true })
  }, [noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const applyRemotePageChanges = useCallback((
    incomingPages: SerializedKonvaBoardPage[],
    options: RemotePageApplyOptions = {},
  ): RemotePageApplyResult => {
    const currentPages = persistActivePage(pagesRef.current, activePageIdRef.current, getActiveDocument())
    const normalizedIncomingPages = normalizeKonvaBoardPageIndexes(incomingPages)
    if (normalizedIncomingPages.length === 0) {
      return { activePageChanged: false, applied: false }
    }

    const activePageId = activePageIdRef.current
    const currentPageMap = new Map(currentPages.map((page) => [page.id, page]))
    const nextPages = options.basePages && options.basePages.length > 0
      ? preserveRemoteApplyCamera(
          mergeKonvaBoardPages(
            currentPages,
            normalizedIncomingPages,
            normalizeKonvaBoardPageIndexes(options.basePages),
          ),
          activePageId,
          options.preserveCamera ? cameraRef.current : null,
        )
      : replaceRemotePages(currentPages, normalizedIncomingPages, {
          activePageId,
          changedPageIds: options.changedPageIds,
          preserveCamera: options.preserveCamera ? cameraRef.current : null,
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
    pagesRef.current = nextPages
    setPages(nextPages)
    if (activePageChanged) {
      const nextDocument = cloneKonvaPageCanvasDocument(nextActivePage.canvasDocument)
      activePageIdRef.current = nextActivePage.id
      setActivePageId(nextActivePage.id)
      onDocumentChange(nextDocument)
      onCameraChange(nextDocument.camera)
      onTransientClear()
    } else if (activePageIdRef.current !== nextActivePage.id) {
      activePageIdRef.current = nextActivePage.id
      setActivePageId(nextActivePage.id)
    }
    setRevision((value) => value + 1)
    return {
      activePageChanged,
      applied: true,
    }
  }, [getActiveDocument, onCameraChange, onDocumentChange, onTransientClear])

  return {
    activePageId,
    activePageTitle,
    applyRemotePageChanges,
    collaborationChange: {
      ...collaborationChange,
      revision: collaborationRevision,
    },
    collaborationRevision,
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
    updatePageDocument,
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

function replaceRemotePages(
  currentPages: SerializedKonvaBoardPage[],
  incomingPages: SerializedKonvaBoardPage[],
  options: {
    activePageId: string
    changedPageIds?: readonly string[]
    preserveCamera?: CanvasCamera | null
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
  camera: CanvasCamera | null,
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
