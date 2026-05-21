import type { CanvasDocument } from '@/features/canvas-engine'

export const defaultKonvaBoardPageId = 'page-1'

export type SerializedKonvaBoardPage = {
  canvasDocument: CanvasDocument
  createdAt: string
  id: string
  index: number
  thumbnailUrl?: string | null
  title: string
  updatedAt: string
}

export type KonvaBoardPageEnvelope = {
  activePageId?: string
  canvasDocument: CanvasDocument
  pages?: SerializedKonvaBoardPage[]
  serializedAt?: string
}

export function createKonvaBoardPage(
  document: CanvasDocument,
  options: {
    id?: string
    index?: number
    now?: string
    thumbnailUrl?: string | null
    title?: string
  } = {}
): SerializedKonvaBoardPage {
  const now = options.now ?? new Date().toISOString()
  return {
    canvasDocument: cloneJsonValue(document) as CanvasDocument,
    createdAt: document.metadata.createdAt || now,
    id: options.id ?? defaultKonvaBoardPageId,
    index: options.index ?? 0,
    thumbnailUrl: options.thumbnailUrl ?? null,
    title: options.title ?? document.metadata.name ?? 'Page 1',
    updatedAt: document.metadata.updatedAt || now,
  }
}

export function normalizeKonvaBoardPages(envelope: KonvaBoardPageEnvelope): SerializedKonvaBoardPage[] {
  const activePageId = envelope.activePageId ?? defaultKonvaBoardPageId
  const pages = Array.isArray(envelope.pages)
    ? envelope.pages.filter(isSerializedKonvaBoardPageLike).map((page, index) => ({
        ...page,
        canvasDocument: cloneJsonValue(page.canvasDocument) as CanvasDocument,
        index: Number.isFinite(page.index) ? page.index : index,
        thumbnailUrl: typeof page.thumbnailUrl === 'string' ? page.thumbnailUrl : null,
      }))
    : []

  if (pages.length === 0) {
    return [createKonvaBoardPage(envelope.canvasDocument, {
      id: activePageId,
      now: envelope.serializedAt,
      title: envelope.canvasDocument.metadata.name ?? 'Page 1',
    })]
  }

  if (pages.some((page) => page.id === activePageId)) return pages.sort(sortPages)
  return [
    createKonvaBoardPage(envelope.canvasDocument, {
      id: activePageId,
      now: envelope.serializedAt,
      title: envelope.canvasDocument.metadata.name ?? 'Page 1',
    }),
    ...pages,
  ].sort(sortPages)
}

export function getActiveKonvaBoardPage(envelope: KonvaBoardPageEnvelope): SerializedKonvaBoardPage {
  const activePageId = envelope.activePageId ?? defaultKonvaBoardPageId
  return normalizeKonvaBoardPages(envelope).find((page) => page.id === activePageId)
    ?? createKonvaBoardPage(envelope.canvasDocument, { id: activePageId, now: envelope.serializedAt })
}

function isSerializedKonvaBoardPageLike(value: unknown): value is SerializedKonvaBoardPage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SerializedKonvaBoardPage>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Boolean(candidate.canvasDocument && typeof candidate.canvasDocument === 'object')
  )
}

function sortPages(a: SerializedKonvaBoardPage, b: SerializedKonvaBoardPage) {
  return a.index - b.index || a.id.localeCompare(b.id)
}

function cloneJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as unknown
}
