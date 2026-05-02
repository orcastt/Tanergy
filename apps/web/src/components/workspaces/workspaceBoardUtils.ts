import type { BoardCardColor, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import type { WorkspaceBoardSortMode } from './WorkspaceBoardToolbar'

export const boardPageSize = 12
const defaultCardColors = ['cream', 'mint', 'peach', 'yellow', 'soft'] as const

export function createBoardId() {
  return `board-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
}

export function getBoardObjectTotal(board: BoardPersistenceSummary) {
  return board.shapeCount + board.assetCount
}

export function getBoardDisplayCardColor(board: BoardPersistenceSummary): BoardCardColor {
  if (board.cardColor) return board.cardColor
  return defaultCardColors[getStableIndex(board.id, defaultCardColors.length)]
}

export function comparePinnedBoards(left: BoardPersistenceSummary, right: BoardPersistenceSummary) {
  return Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned))
}

export function getActivityTime(board: BoardPersistenceSummary) {
  return Date.parse(board.lastOpenedAt || board.savedAt) || 0
}

export function getSavedTime(board: BoardPersistenceSummary) {
  return Date.parse(board.savedAt) || 0
}

export function filterAndSortBoards(
  boards: BoardPersistenceSummary[],
  searchQuery: string,
  sortMode: WorkspaceBoardSortMode
) {
  const query = searchQuery.trim().toLowerCase()
  const visibleBoards = query ? boards.filter((board) => (
    board.title.toLowerCase().includes(query) || board.id.toLowerCase().includes(query)
  )) : boards

  return [...visibleBoards].sort((left, right) => {
    const pinned = comparePinnedBoards(left, right)
    if (pinned !== 0) return pinned
    if (sortMode === 'title') return left.title.localeCompare(right.title)
    if (sortMode === 'objects') return getBoardObjectTotal(right) - getBoardObjectTotal(left)
    if (sortMode === 'saved') return getSavedTime(right) - getSavedTime(left)
    return getActivityTime(right) - getActivityTime(left)
  })
}

export function createBoardShareId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  return Math.random().toString(36).slice(2, 18).padEnd(16, '0')
}

export function getBoardShareUrl(board: BoardPersistenceSummary) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const share = board.shareId ? `?share=${encodeURIComponent(board.shareId)}` : ''
  return `${origin}/boards/${encodeURIComponent(board.id)}${share}`
}

function getStableIndex(value: string, modulo: number) {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % modulo
}
