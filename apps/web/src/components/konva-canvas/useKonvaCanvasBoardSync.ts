'use client'

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import * as Y from 'yjs'
import type { CanvasDocument } from '@/features/canvas-engine'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import { loadLocalBoardDocument } from '@/features/boards/localBoardClient'
import { defaultCanvasSettings, useCanvasSettingsStore } from '@/features/canvas-settings/canvasSettingsStore'
import {
  restoreKonvaBoardDocument,
  restoreKonvaBoardPages,
} from '@/features/boards/konvaBoardDocument'
import type { KonvaBoardSaveAuditHandle } from './KonvaBoardSaveAudit'
import {
  useKonvaLocalYjsSync,
  type KonvaLocalYjsRemoteRestorePayload,
} from './useKonvaLocalYjsSync'
import { isBoardSavedAtNewer } from './konvaCanvasSpikeHelpers'
import type { useKonvaBoardPages } from './useKonvaBoardPages'
import type { KonvaCanvasHistoryPageState } from './useKonvaCanvasHistory'

type UseKonvaCanvasBoardSyncOptions = {
  boardId: string
  boardPageHistoryRef: MutableRefObject<{
    getPageState?: (document: CanvasDocument) => KonvaCanvasHistoryPageState | null
    restorePageState?: (state: KonvaCanvasHistoryPageState) => void
  }>
  boardPages: ReturnType<typeof useKonvaBoardPages>
  clearTransientState: () => void
  collaborationBoardSavedAt: string | null
  collaborationClientInstanceId?: string | null
  collaborationEnabled: boolean
  collaborationRoomKey?: string | null
  document: CanvasDocument
  effectiveReadOnly: boolean
  history: {
    clear: () => void
  }
  initialBoard: BoardPersistenceRecord | null
  mode: 'board' | 'dev'
  onBoardLoaded?: (title: string) => void
  saveAuditRef: RefObject<KonvaBoardSaveAuditHandle | null>
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  workspace?: TangentWorkspace
  ydoc: Y.Doc
}

export function useKonvaCanvasBoardSync({
  boardId,
  boardPageHistoryRef,
  boardPages,
  clearTransientState,
  collaborationBoardSavedAt,
  collaborationClientInstanceId = null,
  collaborationEnabled,
  collaborationRoomKey = null,
  document,
  effectiveReadOnly,
  history,
  initialBoard,
  mode,
  onBoardLoaded,
  saveAuditRef,
  setSettingsOpen,
  workspace,
  ydoc,
}: UseKonvaCanvasBoardSyncOptions) {
  const lastKnownBoardSavedAtRef = useRef<string | null>(initialBoard?.savedAt ?? null)
  const remoteSyncInFlightRef = useRef(false)
  const requestedRemoteBoardSavedAtRef = useRef<string | null>(null)
  const wasReadOnlyRef = useRef(false)
  const restoredInitialBoardIdRef = useRef<string | null>(null)

  const restoreBoardRecord = useCallback((
    board: BoardPersistenceRecord,
    options: { clearTransient?: boolean } = {},
  ) => {
    const restored = restoreKonvaBoardDocument(board.document, { workspaceId: board.workspaceId })
    if (options.clearTransient ?? true) clearTransientState()
    history.clear()
    boardPages.restorePages(restored)
    restoredInitialBoardIdRef.current = board.id
    lastKnownBoardSavedAtRef.current = board.savedAt
    onBoardLoaded?.(board.title)
  }, [boardPages, clearTransientState, history, onBoardLoaded])

  const restoreCollaborativeDocument = useCallback((
    remoteDocument: KonvaLocalYjsRemoteRestorePayload,
    options: {
      basePages?: NonNullable<KonvaLocalYjsRemoteRestorePayload['pages']>
      changedPageIds?: readonly string[]
      hadUnsyncedLocalChanges?: boolean
      clearTransient?: boolean
    } = {},
  ) => {
    useCanvasSettingsStore.getState().replace(remoteDocument.canvasSettings ?? defaultCanvasSettings)
    const remotePages = remoteDocument.pages
    const remoteActivePageId = remoteDocument.activePageId
    const basePages = options.hadUnsyncedLocalChanges && options.basePages?.length
      ? [...options.basePages]
      : undefined
    const applied = boardPages.applyRemotePageChanges(remotePages, {
      basePages,
      changedPageIds: options.changedPageIds,
      preserveCamera: true,
      remoteActivePageId: typeof remoteActivePageId === 'string' ? remoteActivePageId : undefined,
    })
    if (applied.applied) {
      if (applied.activePageChanged) history.clear()
      return
    }
    const restore = restoreKonvaBoardPages({
      activePageId: remoteActivePageId,
      pages: remotePages,
    })
    if (options.clearTransient ?? true) clearTransientState()
    history.clear()
    boardPages.restorePages(restore, {
      bumpCollaborationRevision: false,
      preserveActivePage: true,
      preserveCamera: true,
    })
  }, [boardPages, clearTransientState, history])

  useEffect(() => () => {
    ydoc.destroy()
  }, [ydoc])

  useEffect(() => {
    boardPageHistoryRef.current.getPageState = boardPages.getHistoryState
    boardPageHistoryRef.current.restorePageState = boardPages.restoreHistoryState
  }, [boardPageHistoryRef, boardPages.getHistoryState, boardPages.restoreHistoryState])

  useEffect(() => {
    if (effectiveReadOnly && !wasReadOnlyRef.current) {
      const timeoutId = window.setTimeout(() => {
        clearTransientState()
        setSettingsOpen(false)
      }, 0)
      wasReadOnlyRef.current = true
      return () => window.clearTimeout(timeoutId)
    }
    wasReadOnlyRef.current = effectiveReadOnly
  }, [clearTransientState, effectiveReadOnly, setSettingsOpen])

  useEffect(() => {
    if (!initialBoard || restoredInitialBoardIdRef.current === initialBoard.id) return
    const timeoutId = window.setTimeout(() => {
      try {
        restoreBoardRecord(initialBoard, { clearTransient: false })
      } catch {
        restoredInitialBoardIdRef.current = initialBoard.id
        lastKnownBoardSavedAtRef.current = initialBoard.savedAt
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [initialBoard, restoreBoardRecord])

  useEffect(() => {
    if (!collaborationEnabled || !boardId || !workspace || !effectiveReadOnly || !collaborationBoardSavedAt) return
    if (!isBoardSavedAtNewer(collaborationBoardSavedAt, lastKnownBoardSavedAtRef.current)) return
    if (remoteSyncInFlightRef.current || requestedRemoteBoardSavedAtRef.current === collaborationBoardSavedAt) return
    requestedRemoteBoardSavedAtRef.current = collaborationBoardSavedAt
    remoteSyncInFlightRef.current = true
    void loadLocalBoardDocument(boardId, workspace, { force: true })
      .then((response) => {
        if (!response.board || !isBoardSavedAtNewer(response.board.savedAt, lastKnownBoardSavedAtRef.current)) return
        restoreBoardRecord(response.board)
      })
      .catch(() => {
        requestedRemoteBoardSavedAtRef.current = null
      })
      .finally(() => {
        remoteSyncInFlightRef.current = false
      })
  }, [boardId, collaborationBoardSavedAt, collaborationEnabled, effectiveReadOnly, restoreBoardRecord, workspace])

  const localYjsSync = useKonvaLocalYjsSync({
    activePageId: boardPages.activePageId,
    boardId: mode === 'board' ? boardId : undefined,
    canWrite: collaborationEnabled && !effectiveReadOnly,
    clientInstanceId: collaborationClientInstanceId,
    document,
    enabled: collaborationEnabled,
    getPageEnvelope: boardPages.getPageEnvelope,
    onRemoteDocumentRestore: (restore, meta) => {
      saveAuditRef.current?.acknowledgeExternalDocument(meta.signature)
      restoreCollaborativeDocument(restore, {
        basePages: meta.basePages ?? undefined,
        changedPageIds: meta.changedPageIds,
        hadUnsyncedLocalChanges: meta.hadUnsyncedLocalChanges,
      })
    },
    pageChangedPageIds: boardPages.collaborationChange.changedPageIds,
    pageRevision: boardPages.collaborationRevision,
    requiresFullBoardSync: boardPages.collaborationChange.requiresFullBoardSync,
    roomKey: collaborationRoomKey,
    workspace,
    ydoc,
  })

  const markBoardSavedAt = useCallback((savedAt: string) => {
    lastKnownBoardSavedAtRef.current = savedAt
  }, [])

  return {
    localYjsSync,
    markBoardSavedAt,
  }
}
