/* eslint-disable @next/next/no-img-element -- Thumbnail URLs can come from local API, FastAPI, or R2. */
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

type BoardThumbnailProps = {
  board: BoardPersistenceSummary
}

const thumbnailSurfaces = [
  '#f5e9d4',
  '#fcab79',
  '#a8d8c4',
  '#f4d35e',
  '#d9a441',
]

export function BoardThumbnail({ board }: BoardThumbnailProps) {
  if (board.thumbnailUrl) {
    return <img alt="" className="boards-thumbnail" src={board.thumbnailUrl} />
  }

  const color = thumbnailSurfaces[getStableIndex(board.id, thumbnailSurfaces.length)]

  return (
    <div className="boards-thumbnail boards-thumbnail-placeholder" style={{ backgroundColor: color }}>
      <span>{getInitials(board.title)}</span>
    </div>
  )
}

function getInitials(title: string) {
  const parts = title.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'T'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function getStableIndex(value: string, modulo: number) {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % modulo
}
