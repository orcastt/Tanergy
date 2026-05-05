import type { CanvasDocument, CanvasRuntimeEdge, CanvasShape } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'

export type KonvaBoardPageReorderDirection = 'down' | 'up'

export function duplicateKonvaBoardPage(
  pages: SerializedKonvaBoardPage[],
  activePageId: string,
  pageId: string
) {
  const ordered = normalizeKonvaBoardPageIndexes(pages)
  const sourceIndex = ordered.findIndex((page) => page.id === pageId)
  const sourcePage = ordered[sourceIndex]
  if (!sourcePage) return null
  const now = new Date().toISOString()
  const title = getDuplicatePageTitle(ordered, sourcePage.title)
  const document = touchCanvasDocument({
    ...cloneKonvaPageCanvasDocument(sourcePage.canvasDocument),
    metadata: {
      ...sourcePage.canvasDocument.metadata,
      name: title,
      updatedAt: now,
    },
  })
  const duplicatePage: SerializedKonvaBoardPage = {
    ...sourcePage,
    canvasDocument: document,
    createdAt: now,
    id: createKonvaBoardPageId(),
    index: sourceIndex + 1,
    thumbnailUrl: sourcePage.thumbnailUrl ?? null,
    title,
    updatedAt: now,
  }
  const nextPages = normalizeKonvaBoardPageIndexes([
    ...ordered.slice(0, sourceIndex + 1),
    duplicatePage,
    ...ordered.slice(sourceIndex + 1),
  ])
  return {
    activePageId: duplicatePage.id,
    document,
    duplicatedPageId: duplicatePage.id,
    pages: nextPages,
  }
}

export function deleteKonvaBoardPage(
  pages: SerializedKonvaBoardPage[],
  activePageId: string,
  pageId: string
) {
  const ordered = normalizeKonvaBoardPageIndexes(pages)
  if (ordered.length <= 1) return null
  const deletedIndex = ordered.findIndex((page) => page.id === pageId)
  if (deletedIndex < 0) return null

  const remaining = ordered.filter((page) => page.id !== pageId)
  const nextPages = normalizeKonvaBoardPageIndexes(remaining)
  if (pageId !== activePageId) {
    return {
      activePageId,
      deletedActivePage: false,
      document: null,
      pages: nextPages,
    }
  }

  const fallbackPage = nextPages[Math.min(deletedIndex, nextPages.length - 1)]
  return {
    activePageId: fallbackPage.id,
    deletedActivePage: true,
    document: cloneKonvaPageCanvasDocument(fallbackPage.canvasDocument),
    pages: nextPages,
  }
}

export function reorderKonvaBoardPage(
  pages: SerializedKonvaBoardPage[],
  pageId: string,
  direction: KonvaBoardPageReorderDirection
) {
  const ordered = normalizeKonvaBoardPageIndexes(pages)
  const index = ordered.findIndex((page) => page.id === pageId)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return null
  const nextPages = [...ordered]
  const currentPage = nextPages[index]
  const targetPage = nextPages[targetIndex]
  if (!currentPage || !targetPage) return null
  nextPages[index] = targetPage
  nextPages[targetIndex] = currentPage
  return nextPages.map((page, nextIndex) => ({ ...page, index: nextIndex }))
}

export function moveKonvaSelectionToPage(
  pages: SerializedKonvaBoardPage[],
  activePageId: string,
  targetPageId: string,
  selectedIds: readonly string[]
) {
  if (targetPageId === activePageId || selectedIds.length === 0) return null
  const ordered = normalizeKonvaBoardPageIndexes(pages)
  const sourcePage = ordered.find((page) => page.id === activePageId)
  const targetPage = ordered.find((page) => page.id === targetPageId)
  if (!sourcePage || !targetPage) return null
  const selected = expandPageMoveShapeIds(sourcePage.canvasDocument.shapes, selectedIds)

  const movedShapes = sourcePage.canvasDocument.shapes.filter((shape) => selected.has(shape.id))
  if (movedShapes.length === 0) return null
  const movedShapeIds = new Set(movedShapes.map((shape) => shape.id))
  const movedEdges = sourcePage.canvasDocument.runtimeEdges.filter((edge) => (
    movedShapeIds.has(edge.sourceShapeId) && movedShapeIds.has(edge.targetShapeId)
  ))
  const sourceDocument = touchCanvasDocument({
    ...sourcePage.canvasDocument,
    runtimeEdges: sourcePage.canvasDocument.runtimeEdges.filter((edge) => (
      !movedShapeIds.has(edge.sourceShapeId) && !movedShapeIds.has(edge.targetShapeId)
    )),
    shapes: sourcePage.canvasDocument.shapes.filter((shape) => !movedShapeIds.has(shape.id)),
  })
  const targetDocument = touchCanvasDocument({
    ...targetPage.canvasDocument,
    runtimeEdges: mergeRuntimeEdges(targetPage.canvasDocument.runtimeEdges, movedEdges),
    shapes: [...targetPage.canvasDocument.shapes, ...cloneCanvasShapes(movedShapes)],
  })
  const now = new Date().toISOString()
  return {
    document: sourceDocument,
    movedCount: movedShapes.length,
    pages: ordered.map((page) => {
      if (page.id === sourcePage.id) {
        return { ...page, canvasDocument: sourceDocument, updatedAt: now }
      }
      if (page.id === targetPage.id) {
        return { ...page, canvasDocument: targetDocument, updatedAt: now }
      }
      return page
    }),
  }
}

function mergeRuntimeEdges(existing: CanvasRuntimeEdge[], incoming: CanvasRuntimeEdge[]) {
  const edgeIds = new Set(existing.map((edge) => edge.id))
  return [
    ...existing,
    ...incoming.filter((edge) => !edgeIds.has(edge.id)).map((edge) => ({ ...edge })),
  ]
}

function expandPageMoveShapeIds(shapes: CanvasShape[], shapeIds: readonly string[]) {
  const expanded = new Set(shapeIds)
  const groupIds = new Set(shapes
    .filter((shape) => expanded.has(shape.id) && shape.groupId)
    .map((shape) => shape.groupId!))
  if (groupIds.size > 0) {
    for (const shape of shapes) {
      if (shape.groupId && groupIds.has(shape.groupId)) expanded.add(shape.id)
    }
  }

  let didAddChild = true
  while (didAddChild) {
    didAddChild = false
    for (const shape of shapes) {
      if (!shape.parentId || !expanded.has(shape.parentId) || expanded.has(shape.id)) continue
      expanded.add(shape.id)
      didAddChild = true
    }
  }
  return expanded
}

function touchCanvasDocument(document: CanvasDocument): CanvasDocument {
  return {
    ...document,
    metadata: {
      ...document.metadata,
      updatedAt: new Date().toISOString(),
    },
  }
}

export function normalizeKonvaBoardPageIndexes(pages: SerializedKonvaBoardPage[]) {
  return [...pages]
    .sort((a, b) => a.index - b.index || a.id.localeCompare(b.id))
    .map((page, index) => ({ ...page, index }))
}

function getDuplicatePageTitle(pages: SerializedKonvaBoardPage[], sourceTitle: string) {
  const baseTitle = sourceTitle.trim() || 'Page'
  const usedTitles = new Set(pages.map((page) => page.title.trim()))
  const firstCopy = `${baseTitle} Copy`
  if (!usedTitles.has(firstCopy)) return firstCopy
  for (let index = 2; index < 1000; index += 1) {
    const title = `${firstCopy} ${index}`
    if (!usedTitles.has(title)) return title
  }
  return `${firstCopy} ${pages.length + 1}`
}

export function cloneKonvaPageCanvasDocument(document: CanvasDocument) {
  return typeof structuredClone === 'function'
    ? structuredClone(document) as CanvasDocument
    : JSON.parse(JSON.stringify(document)) as CanvasDocument
}

export function createKonvaBoardPageId() {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function getNextKonvaBoardPageTitle(pages: SerializedKonvaBoardPage[]) {
  const usedTitles = new Set(pages.map((page) => page.title.trim()))
  for (let index = pages.length + 1; index < pages.length + 1000; index += 1) {
    const title = `Page ${index}`
    if (!usedTitles.has(title)) return title
  }
  return `Page ${pages.length + 1}`
}

function cloneCanvasShapes(shapes: CanvasShape[]) {
  return typeof structuredClone === 'function'
    ? structuredClone(shapes) as CanvasShape[]
    : JSON.parse(JSON.stringify(shapes)) as CanvasShape[]
}
