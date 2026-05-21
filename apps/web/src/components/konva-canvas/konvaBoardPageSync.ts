import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CanvasCamera, CanvasDocument } from '@/features/canvas-engine'
import { createKonvaBoardPage, type SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import type { KonvaBoardRestorePayload } from '@/features/boards/konvaBoardDocument'
import type { KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'
import {
  cloneKonvaPageCanvasDocument,
  normalizeKonvaBoardPageIndexes,
} from './konvaBoardPageActions'

export type RestorePageOptions = {
  bumpCollaborationRevision?: boolean
  preserveActivePage?: boolean
  preserveCamera?: boolean
}

export type RemotePageApplyResult = {
  activePageChanged: boolean
  applied: boolean
}

export type RemotePageApplyOptions = {
  basePages?: SerializedKonvaBoardPage[]
  changedPageIds?: readonly string[]
  preserveCamera?: boolean
  remoteActivePageId?: string
}

export type BoardPageRefs = {
  activePageIdRef: MutableRefObject<string>
  cameraRef: MutableRefObject<CanvasCamera>
  pagesRef: MutableRefObject<SerializedKonvaBoardPage[]>
}

export type BoardPageSetters = {
  onCameraChange: Dispatch<SetStateAction<CanvasCamera>>
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onTransientClear: () => void
  setActivePageId: Dispatch<SetStateAction<string>>
  setPages: Dispatch<SetStateAction<SerializedKonvaBoardPage[]>>
  setRevision: Dispatch<SetStateAction<number>>
}

export type NoteCollaborationChange = (
  changedPageIds: readonly string[],
  options?: { requiresFullBoardSync?: boolean },
) => void

export function persistActivePage(
  pages: SerializedKonvaBoardPage[],
  activePageId: string,
  activeDocument: CanvasDocument,
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

export function restoreKonvaBoardPages({
  noteCollaborationChange,
  options = {},
  refs,
  restore,
  setters,
}: {
  noteCollaborationChange: NoteCollaborationChange
  options?: RestorePageOptions
  refs: BoardPageRefs
  restore: KonvaBoardRestorePayload
  setters: BoardPageSetters
}) {
  const nextPages = normalizeKonvaBoardPageIndexes(restore.pages)
  const preferredActivePageId = options.preserveActivePage
    ? refs.activePageIdRef.current
    : restore.activePageId
  const activePage = nextPages.find((page) => page.id === preferredActivePageId)
    ?? nextPages.find((page) => page.id === restore.activePageId)
    ?? nextPages[0]
  if (!activePage) return

  const shouldPreserveCamera = Boolean(
    options.preserveActivePage
    && options.preserveCamera
    && activePage.id === refs.activePageIdRef.current,
  )
  const nextCamera = shouldPreserveCamera ? { ...refs.cameraRef.current } : { ...activePage.canvasDocument.camera }
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

  refs.pagesRef.current = resolvedPages
  refs.activePageIdRef.current = activePage.id
  setters.setPages(resolvedPages)
  setters.setActivePageId(activePage.id)
  setters.onDocumentChange(nextDocument)
  setters.onCameraChange(nextCamera)
  setters.onTransientClear()
  setters.setRevision((value) => value + 1)
  if (options.bumpCollaborationRevision ?? true) {
    noteCollaborationChange(resolvedPages.map((page) => page.id), { requiresFullBoardSync: true })
  }
}

export function restoreKonvaBoardHistoryState({
  activeDocument,
  noteCollaborationChange,
  options = {},
  refs,
  setters,
  state,
}: {
  activeDocument: CanvasDocument
  noteCollaborationChange: NoteCollaborationChange
  options?: { preserveCamera?: boolean }
  refs: BoardPageRefs
  setters: BoardPageSetters
  state: KonvaCanvasHistoryPageState
}) {
  const preserveCamera = options.preserveCamera ?? true
  const currentPages = persistActivePage(refs.pagesRef.current, refs.activePageIdRef.current, activeDocument)
  const currentPageCameraById = new Map(currentPages.map((page) => [page.id, { ...page.canvasDocument.camera }]))
  const nextPages = normalizeKonvaBoardPageIndexes(state.pages).map((page) => {
    if (!preserveCamera) return page
    const preservedCamera = currentPageCameraById.get(page.id)
    if (!preservedCamera) return page
    const pageDocument = cloneKonvaPageCanvasDocument(page.canvasDocument)
    pageDocument.camera = preservedCamera
    return {
      ...page,
      canvasDocument: pageDocument,
    }
  })
  const activePage = nextPages.find((page) => page.id === state.activePageId) ?? nextPages[0]
  if (!activePage) return
  const nextDocument = cloneKonvaPageCanvasDocument(activePage.canvasDocument)
  if (preserveCamera) {
    nextDocument.camera = { ...refs.cameraRef.current }
    const activePageIndex = nextPages.findIndex((page) => page.id === activePage.id)
    if (activePageIndex >= 0) {
      const activePageDocument = cloneKonvaPageCanvasDocument(nextPages[activePageIndex]!.canvasDocument)
      activePageDocument.camera = { ...refs.cameraRef.current }
      nextPages[activePageIndex] = {
        ...nextPages[activePageIndex]!,
        canvasDocument: activePageDocument,
      }
    }
  }
  refs.pagesRef.current = nextPages
  refs.activePageIdRef.current = activePage.id
  setters.setPages(nextPages)
  setters.setActivePageId(activePage.id)
  setters.onDocumentChange(nextDocument)
  setters.onCameraChange(preserveCamera ? { ...refs.cameraRef.current } : nextDocument.camera)
  setters.onTransientClear()
  setters.setRevision((value) => value + 1)
  noteCollaborationChange(nextPages.map((page) => page.id), { requiresFullBoardSync: true })
}
