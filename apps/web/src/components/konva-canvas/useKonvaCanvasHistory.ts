import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { withCanvasShapes, type CanvasDocument, type CanvasShape } from '@/features/canvas-engine'

type CanvasHistorySnapshot = {
  selectedIds: string[]
  shapes: CanvasShape[]
}

type UseKonvaCanvasHistoryOptions = {
  document: CanvasDocument
  selectedIds: string[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onSelectionChange: (shapeIds: string[]) => void
}

export function useKonvaCanvasHistory({
  document,
  onDocumentChange,
  onSelectionChange,
  selectedIds,
}: UseKonvaCanvasHistoryOptions) {
  const undoStackRef = useRef<CanvasHistorySnapshot[]>([])
  const redoStackRef = useRef<CanvasHistorySnapshot[]>([])
  const documentRef = useRef(document)
  const selectedIdsRef = useRef(selectedIds)

  useEffect(() => {
    documentRef.current = document
    selectedIdsRef.current = selectedIds
  }, [document, selectedIds])

  const checkpoint = useCallback((snapshotDocument: CanvasDocument = documentRef.current) => {
    const snapshot = createSnapshot(snapshotDocument, selectedIdsRef.current)
    const previous = undoStackRef.current.at(-1)
    if (previous && snapshotsEqual(previous, snapshot)) return
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-80)
    redoStackRef.current = []
  }, [])

  const undo = useCallback(() => {
    const snapshot = undoStackRef.current.at(-1)
    if (!snapshot) return
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [...redoStackRef.current, createSnapshot(documentRef.current, selectedIdsRef.current)]
    restoreSnapshot(snapshot, onDocumentChange, onSelectionChange)
  }, [onDocumentChange, onSelectionChange])

  const redo = useCallback(() => {
    const snapshot = redoStackRef.current.at(-1)
    if (!snapshot) return
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [...undoStackRef.current, createSnapshot(documentRef.current, selectedIdsRef.current)]
    restoreSnapshot(snapshot, onDocumentChange, onSelectionChange)
  }, [onDocumentChange, onSelectionChange])

  return useMemo(() => ({ checkpoint, redo, undo }), [checkpoint, redo, undo])
}

function createSnapshot(document: CanvasDocument, selectedIds: string[]): CanvasHistorySnapshot {
  return {
    selectedIds: [...selectedIds],
    shapes: cloneShapes(document.shapes),
  }
}

function restoreSnapshot(
  snapshot: CanvasHistorySnapshot,
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>,
  onSelectionChange: (shapeIds: string[]) => void
) {
  onDocumentChange((current) => withCanvasShapes(current, cloneShapes(snapshot.shapes)))
  onSelectionChange(snapshot.selectedIds)
}

function cloneShapes(shapes: CanvasShape[]) {
  return typeof structuredClone === 'function'
    ? structuredClone(shapes) as CanvasShape[]
    : JSON.parse(JSON.stringify(shapes)) as CanvasShape[]
}

function snapshotsEqual(a: CanvasHistorySnapshot, b: CanvasHistorySnapshot) {
  return JSON.stringify(a.shapes) === JSON.stringify(b.shapes) && a.selectedIds.join('\0') === b.selectedIds.join('\0')
}
