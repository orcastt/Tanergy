import type { CanvasRuntimeEdge, CanvasShape } from '@/features/canvas-engine'
import type { SerializedKonvaBoardPage } from '@/features/boards/konvaBoardPageContract'

export function reconcileMergedPageEntities(
  mergedPages: SerializedKonvaBoardPage[],
  currentPages: SerializedKonvaBoardPage[],
  incomingPages: SerializedKonvaBoardPage[],
  basePages: SerializedKonvaBoardPage[],
) {
  if (basePages.length === 0) return mergedPages

  const currentShapes = buildPageEntityLookup(currentPages, (page) => page.canvasDocument.shapes)
  const incomingShapes = buildPageEntityLookup(incomingPages, (page) => page.canvasDocument.shapes)
  const baseShapes = buildPageEntityLookup(basePages, (page) => page.canvasDocument.shapes)
  const resolvedShapesByPage = new Map<string, Map<string, CanvasShape>>()
  const resolvedShapePageIds = new Map<string, string>()

  for (const shapeId of collectEntityIds(currentShapes, incomingShapes, baseShapes)) {
    const currentShape = currentShapes.get(shapeId) ?? null
    const incomingShape = incomingShapes.get(shapeId) ?? null
    const baseShape = baseShapes.get(shapeId) ?? null
    const resolvedPageId = resolveMergedEntityPageId(currentShape?.pageId ?? null, incomingShape?.pageId ?? null, baseShape?.pageId ?? null)
    const resolvedShape = resolveMergedEntityValue(currentShape?.entity ?? null, incomingShape?.entity ?? null, baseShape?.entity ?? null)
    if (!resolvedPageId || !resolvedShape) continue
    rememberResolvedEntity(resolvedShapesByPage, resolvedPageId, shapeId, resolvedShape)
    resolvedShapePageIds.set(shapeId, resolvedPageId)
  }

  const currentEdges = buildPageEntityLookup(currentPages, (page) => page.canvasDocument.runtimeEdges)
  const incomingEdges = buildPageEntityLookup(incomingPages, (page) => page.canvasDocument.runtimeEdges)
  const baseEdges = buildPageEntityLookup(basePages, (page) => page.canvasDocument.runtimeEdges)
  const resolvedEdgesByPage = new Map<string, Map<string, CanvasRuntimeEdge>>()

  for (const edgeId of collectEntityIds(currentEdges, incomingEdges, baseEdges)) {
    const currentEdge = currentEdges.get(edgeId) ?? null
    const incomingEdge = incomingEdges.get(edgeId) ?? null
    const baseEdge = baseEdges.get(edgeId) ?? null
    const resolvedEdge = resolveMergedEntityValue(currentEdge?.entity ?? null, incomingEdge?.entity ?? null, baseEdge?.entity ?? null)
    if (!resolvedEdge) continue
    const sourcePageId = resolvedShapePageIds.get(resolvedEdge.sourceShapeId) ?? null
    const targetPageId = resolvedShapePageIds.get(resolvedEdge.targetShapeId) ?? null
    if (!sourcePageId || sourcePageId !== targetPageId) continue
    rememberResolvedEntity(resolvedEdgesByPage, sourcePageId, edgeId, resolvedEdge)
  }

  return mergedPages.map((page) => {
    const shapes = orderResolvedPageEntities(
      page.id,
      resolvedShapesByPage.get(page.id) ?? new Map<string, CanvasShape>(),
      currentPages,
      incomingPages,
      basePages,
      (currentPage) => currentPage.canvasDocument.shapes,
    )
    const keptShapeIds = new Set(shapes.map((shape) => shape.id))
    const runtimeEdges = orderResolvedPageEntities(
      page.id,
      resolvedEdgesByPage.get(page.id) ?? new Map<string, CanvasRuntimeEdge>(),
      currentPages,
      incomingPages,
      basePages,
      (currentPage) => currentPage.canvasDocument.runtimeEdges,
    ).filter((edge) => keptShapeIds.has(edge.sourceShapeId) && keptShapeIds.has(edge.targetShapeId))
    return {
      ...page,
      canvasDocument: {
        ...page.canvasDocument,
        runtimeEdges,
        shapes,
      },
    }
  })
}

function orderResolvedPageEntities<T extends { id: string }>(
  pageId: string,
  resolvedById: Map<string, T>,
  currentPages: SerializedKonvaBoardPage[],
  incomingPages: SerializedKonvaBoardPage[],
  basePages: SerializedKonvaBoardPage[],
  getEntities: (page: SerializedKonvaBoardPage) => T[],
) {
  return mergeOrderedIds({
    baseOrder: getEntitiesForPage(basePages, pageId, getEntities).map((entity) => entity.id),
    currentOrder: getEntitiesForPage(currentPages, pageId, getEntities).map((entity) => entity.id),
    incomingOrder: getEntitiesForPage(incomingPages, pageId, getEntities).map((entity) => entity.id),
    nextIds: new Set(resolvedById.keys()),
  })
    .map((entityId) => resolvedById.get(entityId))
    .filter((entity): entity is T => Boolean(entity))
}

function buildPageEntityLookup<T extends { id: string }>(
  pages: SerializedKonvaBoardPage[],
  getEntities: (page: SerializedKonvaBoardPage) => T[],
) {
  const lookup = new Map<string, { entity: T; pageId: string }>()
  for (const page of pages) {
    for (const entity of getEntities(page)) {
      lookup.set(entity.id, {
        entity,
        pageId: page.id,
      })
    }
  }
  return lookup
}

function collectEntityIds<T>(
  ...lookups: Array<Map<string, T>>
) {
  const entityIds = new Set<string>()
  for (const lookup of lookups) {
    for (const entityId of lookup.keys()) entityIds.add(entityId)
  }
  return entityIds
}

function getEntitiesForPage<T extends { id: string }>(
  pages: SerializedKonvaBoardPage[],
  pageId: string,
  getEntities: (page: SerializedKonvaBoardPage) => T[],
) {
  const page = pages.find((candidate) => candidate.id === pageId)
  return page ? getEntities(page) : []
}

function rememberResolvedEntity<T extends { id: string }>(
  resolvedByPage: Map<string, Map<string, T>>,
  pageId: string,
  entityId: string,
  entity: T,
) {
  const existing = resolvedByPage.get(pageId)
  if (existing) {
    existing.set(entityId, entity)
    return
  }
  resolvedByPage.set(pageId, new Map([[entityId, entity]]))
}

function resolveMergedEntityPageId(
  currentPageId: null | string,
  incomingPageId: null | string,
  basePageId: null | string,
) {
  if (basePageId === null) return incomingPageId ?? currentPageId
  return isSameJsonValue(incomingPageId, basePageId) ? currentPageId : incomingPageId
}

function resolveMergedEntityValue<T>(
  currentValue: null | T,
  incomingValue: null | T,
  baseValue: null | T,
) {
  if (baseValue === null) return incomingValue ?? currentValue
  return isSameJsonValue(incomingValue, baseValue) ? currentValue : incomingValue
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
