export const boardCardColorValues = ['cream', 'mint', 'peach', 'yellow', 'soft'] as const

export type BoardCardColor = typeof boardCardColorValues[number]

export const boardVisibilityValues = ['private', 'workspace', 'public'] as const

export type BoardVisibility = typeof boardVisibilityValues[number]

export const boardMemberRoleValues = ['owner', 'admin', 'editor', 'viewer', 'temporary_viewer'] as const

export type BoardMemberRole = typeof boardMemberRoleValues[number]

export function normalizeBoardCardColor(value: unknown): BoardCardColor | null {
  return typeof value === 'string' && boardCardColorValues.includes(value as BoardCardColor)
    ? value as BoardCardColor
    : null
}

export function normalizeBoardDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 280) : null
}

export function normalizeBoardShareId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^[a-zA-Z0-9_-]{8,64}$/.test(trimmed) ? trimmed : null
}

export function normalizeBoardThumbnailUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/api/assets/')) return trimmed.slice(0, 512)
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed.slice(0, 512)
  return null
}

export function normalizeBoardVisibility(value: unknown): BoardVisibility {
  return typeof value === 'string' && boardVisibilityValues.includes(value as BoardVisibility)
    ? value as BoardVisibility
    : 'private'
}

export function normalizeBoardMemberRole(value: unknown): BoardMemberRole {
  return typeof value === 'string' && boardMemberRoleValues.includes(value as BoardMemberRole)
    ? value as BoardMemberRole
    : 'viewer'
}

export function getBoardDocumentMetrics(document: unknown): { assetCount: number; shapeCount: number } {
  if (!document || typeof document !== 'object') {
    return { assetCount: 0, shapeCount: 0 }
  }
  const candidate = document as { assets?: unknown; canvasDocument?: unknown; shapes?: unknown }
  const pageShapeCounts = Array.isArray((candidate as { pages?: unknown }).pages)
    ? ((candidate as { pages: unknown[] }).pages).reduce<number>((total, page) => {
        if (!page || typeof page !== 'object') return total
        const pageDocument = (page as { canvasDocument?: unknown }).canvasDocument
        const pageShapes = pageDocument && typeof pageDocument === 'object'
          ? (pageDocument as { shapes?: unknown }).shapes
          : null
        return total + (Array.isArray(pageShapes) ? pageShapes.length : 0)
      }, 0)
    : 0
  const canvasDocument = candidate.canvasDocument && typeof candidate.canvasDocument === 'object'
    ? candidate.canvasDocument as { shapes?: unknown }
    : null
  return {
    assetCount: Array.isArray(candidate.assets) ? candidate.assets.length : 0,
    shapeCount: pageShapeCounts > 0
      ? pageShapeCounts
      : Array.isArray(candidate.shapes)
      ? candidate.shapes.length
      : Array.isArray(canvasDocument?.shapes) ? canvasDocument.shapes.length : 0,
  }
}
