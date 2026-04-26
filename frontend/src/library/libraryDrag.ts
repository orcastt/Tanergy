import type { DragEvent as ReactDragEvent } from "react"
import type { LibraryItem } from "../types/library"

export const LIBRARY_DRAG_TYPE = "application/tanvas-library-item"

export function setLibraryDragData(event: ReactDragEvent, item: LibraryItem) {
  event.dataTransfer.setData(LIBRARY_DRAG_TYPE, JSON.stringify(item))
  event.dataTransfer.effectAllowed = "copy"
}

export function getLibraryDragData(event: React.DragEvent | DragEvent): LibraryItem | null {
  const raw = event.dataTransfer?.getData(LIBRARY_DRAG_TYPE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LibraryItem
  } catch {
    return null
  }
}
