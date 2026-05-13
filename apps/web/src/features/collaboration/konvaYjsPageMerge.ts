import type { CanvasDocument, CanvasRuntimeEdge, CanvasShape } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'
import { reconcileMergedPageEntities } from './konvaYjsEntityReconcile'

export function mergeKonvaBoardPages(
  currentPages: SerializedKonvaBoardPage[],
  incomingPages: SerializedKonvaBoardPage[],
  basePages?: SerializedKonvaBoardPage[] | null,
) {
  const currentById = new Map(currentPages.map((page) => [page.id, page]))
  const incomingById = new Map(incomingPages.map((page) => [page.id, page]))
  const baseById = new Map((basePages ?? []).map((page) => [page.id, page]))
  const mergedById = new Map<string, SerializedKonvaBoardPage>()

  for (const pageId of resolveMergedPageOrder(currentPages, incomingPages, basePages ?? [])) {
    const currentPage = currentById.get(pageId)
    const incomingPage = incomingById.get(pageId)
    const basePage = baseById.get(pageId)
    if (currentPage && incomingPage) {
      mergedById.set(pageId, mergeBoardPage(currentPage, incomingPage, basePage))
      continue
    }
    if (incomingPage && !basePage) {
      mergedById.set(pageId, incomingPage)
      continue
    }
    if (currentPage && !basePage) {
      mergedById.set(pageId, currentPage)
      continue
    }
    if (incomingPage && currentPage) {
      mergedById.set(pageId, incomingPage)
      continue
    }
  }

  const mergedPages = resolveMergedPageOrder(currentPages, incomingPages, basePages ?? [])
    .map((pageId, index) => {
      const page = mergedById.get(pageId)
      return page ? { ...page, index } : null
    })
    .filter((page): page is SerializedKonvaBoardPage => Boolean(page))
  return reconcileMergedPageEntities(mergedPages, currentPages, incomingPages, basePages ?? [])
}

export function mergeActiveKonvaBoardPages(
  currentPages: SerializedKonvaBoardPage[],
  incomingPages: SerializedKonvaBoardPage[],
  activePageId: string,
  basePages?: SerializedKonvaBoardPage[] | null,
) {
  const mergedPages = mergeKonvaBoardPages(currentPages, incomingPages, basePages)
  if (!mergedPages.some((page) => page.id === activePageId)) return currentPages
  return mergedPages.map((page) => (
    page.id === activePageId ? page : currentPages.find((candidate) => candidate.id === page.id) ?? page
  ))
}

function resolveMergedPageOrder(
  currentPages: SerializedKonvaBoardPage[],
  incomingPages: SerializedKonvaBoardPage[],
  basePages: SerializedKonvaBoardPage[],
) {
  const currentIds = currentPages.map((page) => page.id)
  const incomingIds = incomingPages.map((page) => page.id)
  const baseIds = basePages.map((page) => page.id)
  const mergedIds = new Set<string>()

  for (const pageId of incomingIds) {
    if (!baseIds.includes(pageId) || currentIds.includes(pageId)) mergedIds.add(pageId)
  }
  for (const pageId of currentIds) {
    if (!baseIds.includes(pageId) || incomingIds.includes(pageId)) mergedIds.add(pageId)
  }

  return mergeOrderedIds({
    baseOrder: baseIds,
    currentOrder: currentIds,
    incomingOrder: incomingIds,
    nextIds: mergedIds,
  })
}

function mergeCanvasDocument(
  currentDocument: CanvasDocument,
  incomingDocument: CanvasDocument,
  baseDocument?: CanvasDocument,
) {
  const mergedShapes = mergeShapeCollection(
    currentDocument.shapes,
    incomingDocument.shapes,
    baseDocument?.shapes ?? null,
  )
  const keptShapeIds = new Set(mergedShapes.map((shape) => shape.id))
  const mergedRuntimeEdges = mergeRuntimeEdgeCollection(
    currentDocument.runtimeEdges,
    incomingDocument.runtimeEdges,
    baseDocument?.runtimeEdges ?? null,
  ).filter((edge) => keptShapeIds.has(edge.sourceShapeId) && keptShapeIds.has(edge.targetShapeId))

  return {
    ...currentDocument,
    camera: preferIncomingValue(currentDocument.camera, incomingDocument.camera, baseDocument?.camera),
    id: incomingDocument.id,
    metadata: preferIncomingValue(currentDocument.metadata, incomingDocument.metadata, baseDocument?.metadata),
    runtimeEdges: mergedRuntimeEdges,
    schemaVersion: incomingDocument.schemaVersion,
    shapes: mergedShapes,
  }
}

function mergeBoardPage(
  currentPage: SerializedKonvaBoardPage,
  incomingPage: SerializedKonvaBoardPage,
  basePage?: SerializedKonvaBoardPage,
): SerializedKonvaBoardPage {
  return {
    canvasDocument: mergeCanvasDocument(
      currentPage.canvasDocument,
      incomingPage.canvasDocument,
      basePage?.canvasDocument,
    ),
    createdAt: preferIncomingValue(currentPage.createdAt, incomingPage.createdAt, basePage?.createdAt),
    id: incomingPage.id,
    index: incomingPage.index,
    thumbnailUrl: preferIncomingValue(currentPage.thumbnailUrl ?? null, incomingPage.thumbnailUrl ?? null, basePage?.thumbnailUrl ?? null),
    title: preferIncomingValue(currentPage.title, incomingPage.title, basePage?.title),
    updatedAt: preferIncomingValue(currentPage.updatedAt, incomingPage.updatedAt, basePage?.updatedAt),
  }
}

function mergeShapeCollection(
  currentShapes: CanvasShape[],
  incomingShapes: CanvasShape[],
  baseShapes: CanvasShape[] | null,
) {
  const currentById = new Map(currentShapes.map((shape) => [shape.id, shape]))
  const incomingById = new Map(incomingShapes.map((shape) => [shape.id, shape]))
  const baseById = new Map((baseShapes ?? []).map((shape) => [shape.id, shape]))
  const nextById = new Map(currentById)

  for (const [shapeId, incomingShape] of incomingById.entries()) {
    const baseShape = baseById.get(shapeId)
    if (!baseShape || !isSameJsonValue(incomingShape, baseShape)) nextById.set(shapeId, incomingShape)
  }
  for (const [shapeId, baseShape] of baseById.entries()) {
    if (!incomingById.has(shapeId) && baseShape) nextById.delete(shapeId)
  }

  return mergeOrderedCollection(currentShapes, incomingShapes, baseShapes ?? [], nextById)
}

function mergeRuntimeEdgeCollection(
  currentEdges: CanvasRuntimeEdge[],
  incomingEdges: CanvasRuntimeEdge[],
  baseEdges: CanvasRuntimeEdge[] | null,
) {
  const currentById = new Map(currentEdges.map((edge) => [edge.id, edge]))
  const incomingById = new Map(incomingEdges.map((edge) => [edge.id, edge]))
  const baseById = new Map((baseEdges ?? []).map((edge) => [edge.id, edge]))
  const nextById = new Map(currentById)

  for (const [edgeId, incomingEdge] of incomingById.entries()) {
    const baseEdge = baseById.get(edgeId)
    if (!baseEdge || !isSameJsonValue(incomingEdge, baseEdge)) nextById.set(edgeId, incomingEdge)
  }
  for (const [edgeId, baseEdge] of baseById.entries()) {
    if (!incomingById.has(edgeId) && baseEdge) nextById.delete(edgeId)
  }

  return mergeOrderedCollection(currentEdges, incomingEdges, baseEdges ?? [], nextById)
}

function mergeOrderedCollection<T extends { id: string }>(
  currentItems: T[],
  incomingItems: T[],
  baseItems: T[],
  nextById: Map<string, T>,
) {
  return mergeOrderedIds({
    baseOrder: baseItems.map((item) => item.id),
    currentOrder: currentItems.map((item) => item.id),
    incomingOrder: incomingItems.map((item) => item.id),
    nextIds: new Set(nextById.keys()),
  })
    .map((itemId) => nextById.get(itemId))
    .filter((item): item is T => Boolean(item))
}

function mergeOrderedIds(options: {
  baseOrder: string[]
  currentOrder: string[]
  incomingOrder: string[]
  nextIds: Set<string>
}) {
  const { baseOrder, currentOrder, incomingOrder, nextIds } = options
  const localOrderChanged = !areIdListsEqual(incomingOrder, baseOrder)
  const preferredOrder = localOrderChanged ? incomingOrder : currentOrder
  const secondaryOrder = localOrderChanged ? currentOrder : incomingOrder
  const orderedIds: string[] = []
  for (const candidate of preferredOrder) {
    if (nextIds.has(candidate) && !orderedIds.includes(candidate)) orderedIds.push(candidate)
  }
  for (const candidate of secondaryOrder) {
    if (nextIds.has(candidate) && !orderedIds.includes(candidate)) orderedIds.push(candidate)
  }
  for (const candidate of nextIds) {
    if (!orderedIds.includes(candidate)) orderedIds.push(candidate)
  }
  return orderedIds
}

function preferIncomingValue<T>(currentValue: T, incomingValue: T, baseValue?: T) {
  if (baseValue === undefined) return incomingValue
  return isSameJsonValue(incomingValue, baseValue) ? currentValue : incomingValue
}

function areIdListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function isSameJsonValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
