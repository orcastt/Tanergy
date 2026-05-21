import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { type CanvasCamera, type CanvasDocument } from '@/features/canvas-engine'
import {
  createKonvaBoardPage,
  defaultKonvaBoardPageId,
  type SerializedKonvaBoardPage,
} from '@/features/boards/konvaBoardPageContract'
import type { KonvaBoardPageReorderDirection } from './konvaBoardPageActions'
import type { KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'
import type { KonvaBoardDocumentSerializationOptions, KonvaBoardRestorePayload } from '@/features/boards/konvaBoardDocument'
import {
  persistActivePage,
  restoreKonvaBoardHistoryState,
  restoreKonvaBoardPages,
  type RemotePageApplyOptions,
  type RemotePageApplyResult,
  type RestorePageOptions,
} from './konvaBoardPageSync'
import { applyRemoteKonvaPageChanges } from './konvaBoardPageRemoteApply'
import {
  createKonvaBoardPageMutation,
  deleteKonvaBoardPageMutation,
  duplicateKonvaBoardPageMutation,
  moveKonvaBoardPageMutation,
  moveKonvaSelectionToBoardPage,
  renameKonvaBoardPage,
  selectKonvaBoardPage,
  updateKonvaBoardPageDocument,
} from './konvaBoardPageMutations'

type UseKonvaBoardPagesOptions = {
  activeDocument: CanvasDocument
  camera: CanvasCamera
  onCameraChange: Dispatch<SetStateAction<CanvasCamera>>
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onTransientClear: () => void
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
    selectKonvaBoardPage({
      activeDocument: getActiveDocument(),
      pageId,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: { onCameraChange, onDocumentChange, onTransientClear, setActivePageId, setPages, setRevision },
    })
  }, [getActiveDocument, onCameraChange, onDocumentChange, onTransientClear])

  const createPage = useCallback(() => {
    createKonvaBoardPageMutation({
      activeDocument: getActiveDocument(),
      noteCollaborationChange,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: { onCameraChange, onDocumentChange, onTransientClear, setActivePageId, setPages, setRevision },
    })
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const renamePage = useCallback((pageId: string, title: string) => {
    renameKonvaBoardPage({
      activeDocument: getActiveDocument(),
      noteCollaborationChange,
      pageId,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: { onCameraChange, onDocumentChange, onTransientClear, setActivePageId, setPages, setRevision },
      title,
    })
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const deletePage = useCallback((pageId: string) => {
    deleteKonvaBoardPageMutation({
      activeDocument: getActiveDocument(),
      noteCollaborationChange,
      pageId,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: { onCameraChange, onDocumentChange, onTransientClear, setActivePageId, setPages, setRevision },
    })
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const duplicatePage = useCallback((pageId: string) => {
    duplicateKonvaBoardPageMutation({
      activeDocument: getActiveDocument(),
      noteCollaborationChange,
      pageId,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: { onCameraChange, onDocumentChange, onTransientClear, setActivePageId, setPages, setRevision },
    })
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const movePage = useCallback((pageId: string, direction: KonvaBoardPageReorderDirection) => {
    moveKonvaBoardPageMutation({
      activeDocument: getActiveDocument(),
      direction,
      noteCollaborationChange,
      pageId,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: { onCameraChange, onDocumentChange, onTransientClear, setActivePageId, setPages, setRevision },
    })
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const moveSelectionToPage = useCallback((targetPageId: string, shapeIds: readonly string[]) => {
    moveKonvaSelectionToBoardPage({
      activeDocument: getActiveDocument(),
      noteCollaborationChange,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: { onCameraChange, onDocumentChange, onTransientClear, setActivePageId, setPages, setRevision },
      shapeIds,
      targetPageId,
    })
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const updatePageDocument = useCallback((
    pageId: string,
    updater: (document: CanvasDocument) => CanvasDocument,
  ) => {
    return updateKonvaBoardPageDocument({
      activeDocument: getActiveDocument(),
      noteCollaborationChange,
      pageId,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: { onCameraChange, onDocumentChange, onTransientClear, setActivePageId, setPages, setRevision },
      updater,
    })
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const restorePages = useCallback((restore: KonvaBoardRestorePayload, options: RestorePageOptions = {}) => {
    restoreKonvaBoardPages({
      noteCollaborationChange,
      options,
      refs: { activePageIdRef, cameraRef, pagesRef },
      restore,
      setters: {
        onCameraChange,
        onDocumentChange,
        onTransientClear,
        setActivePageId,
        setPages,
        setRevision,
      },
    })
  }, [noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const restoreHistoryState = useCallback((
    state: KonvaCanvasHistoryPageState,
    options: { preserveCamera?: boolean } = {},
  ) => {
    restoreKonvaBoardHistoryState({
      activeDocument: getActiveDocument(),
      noteCollaborationChange,
      options,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: {
        onCameraChange,
        onDocumentChange,
        onTransientClear,
        setActivePageId,
        setPages,
        setRevision,
      },
      state,
    })
  }, [getActiveDocument, noteCollaborationChange, onCameraChange, onDocumentChange, onTransientClear])

  const applyRemotePageChanges = useCallback((
    incomingPages: SerializedKonvaBoardPage[],
    options: RemotePageApplyOptions = {},
  ): RemotePageApplyResult => {
    return applyRemoteKonvaPageChanges({
      activeDocument: getActiveDocument(),
      incomingPages,
      options,
      refs: { activePageIdRef, cameraRef, pagesRef },
      setters: {
        onCameraChange,
        onDocumentChange,
        onTransientClear,
        setActivePageId,
        setPages,
        setRevision,
      },
    })
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
