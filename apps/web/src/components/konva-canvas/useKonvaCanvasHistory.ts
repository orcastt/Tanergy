import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { withCanvasRuntimeEdges, withCanvasShapes, type CanvasDocument, type CanvasRuntimeEdge, type CanvasShape } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'

export type KonvaCanvasHistoryPageState = {
  activePageId: string
  pages: SerializedKonvaBoardPage[]
}

type CanvasHistorySnapshot = {
  pageState: KonvaCanvasHistoryPageState | null
  runtimeEdges: CanvasRuntimeEdge[]
  selectedIds: string[]
  shapes: CanvasShape[]
  signature: string
}

type UseKonvaCanvasHistoryOptions = {
  document: CanvasDocument
  selectedIds: string[]
  getPageState?: (document: CanvasDocument) => KonvaCanvasHistoryPageState | null
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onPageStateRestore?: (state: KonvaCanvasHistoryPageState) => void
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaCanvasHistory({
  document,
  getPageState,
  onDocumentChange,
  onPageStateRestore,
  onSelectionChange,
  selectedIds,
}: UseKonvaCanvasHistoryOptions) {
  const undoStackRef = useRef<CanvasHistorySnapshot[]>([])
  const redoStackRef = useRef<CanvasHistorySnapshot[]>([])
  const documentRef = useRef(document)
  const getPageStateRef = useRef(getPageState)
  const onPageStateRestoreRef = useRef(onPageStateRestore)
  const selectedIdsRef = useRef(selectedIds)

  useEffect(() => {
    documentRef.current = document
    getPageStateRef.current = getPageState
    onPageStateRestoreRef.current = onPageStateRestore
    selectedIdsRef.current = selectedIds
  }, [document, getPageState, onPageStateRestore, selectedIds])

  const checkpoint = useCallback((snapshotDocument: CanvasDocument = documentRef.current) => {
    const pageState = getPageStateRef.current?.(snapshotDocument) ?? null
    const signature = createSnapshotSignature(snapshotDocument.shapes, snapshotDocument.runtimeEdges, selectedIdsRef.current, pageState)
    const previous = undoStackRef.current.at(-1)
    if (previous?.signature === signature) return
    const snapshot = createSnapshot(snapshotDocument, selectedIdsRef.current, signature, pageState)
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-80)
    redoStackRef.current = []
  }, [])

  const clear = useCallback(() => {
    undoStackRef.current = []
    redoStackRef.current = []
  }, [])

  const undo = useCallback(() => {
    const snapshot = undoStackRef.current.at(-1)
    if (!snapshot) return
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [...redoStackRef.current, createSnapshot(documentRef.current, selectedIdsRef.current, undefined, getPageStateRef.current?.(documentRef.current) ?? null)]
    restoreSnapshot(snapshot, onDocumentChange, onSelectionChange, onPageStateRestoreRef.current)
  }, [onDocumentChange, onSelectionChange])

  const redo = useCallback(() => {
    const snapshot = redoStackRef.current.at(-1)
    if (!snapshot) return
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [...undoStackRef.current, createSnapshot(documentRef.current, selectedIdsRef.current, undefined, getPageStateRef.current?.(documentRef.current) ?? null)]
    restoreSnapshot(snapshot, onDocumentChange, onSelectionChange, onPageStateRestoreRef.current)
  }, [onDocumentChange, onSelectionChange])

  return useMemo(() => ({ checkpoint, clear, redo, undo }), [checkpoint, clear, redo, undo])
}

function createSnapshot(
  document: CanvasDocument,
  selectedIds: string[],
  signature?: string,
  pageState: KonvaCanvasHistoryPageState | null = null
): CanvasHistorySnapshot {
  const nextSignature = signature ?? createSnapshotSignature(document.shapes, document.runtimeEdges, selectedIds, pageState)
  return {
    pageState: pageState ? clonePageState(pageState) : null,
    runtimeEdges: cloneRuntimeEdges(document.runtimeEdges),
    selectedIds: [...selectedIds],
    shapes: cloneShapes(document.shapes),
    signature: nextSignature,
  }
}

function restoreSnapshot(
  snapshot: CanvasHistorySnapshot,
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>,
  onSelectionChange: (shapeIds: string[]) => void,
  onPageStateRestore?: (state: KonvaCanvasHistoryPageState) => void
) {
  if (snapshot.pageState && onPageStateRestore) {
    onPageStateRestore(clonePageState(snapshot.pageState))
    onSelectionChange(snapshot.selectedIds)
    return
  }
  onDocumentChange((current) => (
    withCanvasRuntimeEdges(withCanvasShapes(current, cloneShapes(snapshot.shapes)), cloneRuntimeEdges(snapshot.runtimeEdges))
  ))
  onSelectionChange(snapshot.selectedIds)
}

function cloneShapes(shapes: CanvasShape[]) {
  return typeof structuredClone === 'function'
    ? structuredClone(shapes) as CanvasShape[]
    : JSON.parse(JSON.stringify(shapes)) as CanvasShape[]
}

function cloneRuntimeEdges(edges: CanvasRuntimeEdge[]) {
  return typeof structuredClone === 'function'
    ? structuredClone(edges) as CanvasRuntimeEdge[]
    : JSON.parse(JSON.stringify(edges)) as CanvasRuntimeEdge[]
}

function clonePageState(state: KonvaCanvasHistoryPageState) {
  return typeof structuredClone === 'function'
    ? structuredClone(state) as KonvaCanvasHistoryPageState
    : JSON.parse(JSON.stringify(state)) as KonvaCanvasHistoryPageState
}

function createSnapshotSignature(shapes: CanvasShape[], runtimeEdges: CanvasRuntimeEdge[], selectedIds: string[], pageState: KonvaCanvasHistoryPageState | null) {
  return `${JSON.stringify(pageState ?? { runtimeEdges, shapes })}\n${selectedIds.join('\0')}`
}
