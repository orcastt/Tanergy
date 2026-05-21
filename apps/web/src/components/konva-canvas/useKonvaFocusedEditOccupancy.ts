import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { KonvaNodeTextFieldName } from './KonvaNodeTextEditor'

type FocusedEditSource = 'chat-model-menu' | 'field-dropdown'

type UseKonvaFocusedEditOccupancyOptions = {
  cropEditingImageId: string | null
  editingNodeText: { fieldName: KonvaNodeTextFieldName; shapeId: string } | null
  editingTextId: string | null
  onSelectionChange: (shapeIds: string[]) => void
  remoteEditingOwners: Map<string, string>
  setCropEditingImageId: Dispatch<SetStateAction<string | null>>
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
}

export function useKonvaFocusedEditOccupancy({
  cropEditingImageId,
  editingNodeText,
  editingTextId,
  onSelectionChange,
  remoteEditingOwners,
  setCropEditingImageId,
  setSelectedEdgeId,
}: UseKonvaFocusedEditOccupancyOptions) {
  const [focusedControlShapes, setFocusedControlShapes] = useState<Record<string, string>>({})
  const [focusedEditNotice, setFocusedEditNotice] = useState<string | null>(null)

  const focusedControlShapeIds = useMemo(() => (
    dedupeEditingPresenceShapeIds(Object.values(focusedControlShapes))
  ), [focusedControlShapes])

  const editingPresenceShapeIds = useMemo(() => dedupeEditingPresenceShapeIds([
    cropEditingImageId,
    editingNodeText?.shapeId,
    editingTextId,
    ...focusedControlShapeIds,
  ]), [cropEditingImageId, editingNodeText?.shapeId, editingTextId, focusedControlShapeIds])

  useEffect(() => {
    if (!focusedEditNotice) return
    const timeoutId = window.setTimeout(() => setFocusedEditNotice(null), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [focusedEditNotice])

  const requestFocusedEditShape = useCallback((shapeId: string, targetLabel: string) => {
    const editingOwner = remoteEditingOwners.get(shapeId)
    if (editingOwner) {
      setFocusedEditNotice(`${editingOwner} is already editing this ${targetLabel}.`)
      return false
    }
    setFocusedEditNotice(null)
    onSelectionChange([shapeId])
    setSelectedEdgeId(null)
    setCropEditingImageId(null)
    return true
  }, [onSelectionChange, remoteEditingOwners, setCropEditingImageId, setSelectedEdgeId])

  const setFocusedControlShapeState = useCallback((
    shapeId: string,
    source: FocusedEditSource,
    active: boolean,
  ) => {
    const key = `${shapeId}:${source}`
    setFocusedControlShapes((current) => {
      if (active) {
        if (current[key] === shapeId) return current
        return { ...current, [key]: shapeId }
      }
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }, [])

  return {
    editingPresenceShapeIds,
    focusedEditNotice,
    requestFocusedEditShape,
    setFocusedControlShapeState,
  }
}

function dedupeEditingPresenceShapeIds(shapeIds: Array<string | null | undefined>) {
  return [...new Set(shapeIds.filter((shapeId): shapeId is string => typeof shapeId === 'string' && shapeId.length > 0))]
}
