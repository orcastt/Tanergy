/* eslint-disable @next/next/no-img-element -- Thumbnail URLs can come from local API, FastAPI, or R2. */
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

type BoardThumbnailProps = {
  board: BoardPersistenceSummary
}

const thumbnailSurface = '#d9a441'

export function BoardThumbnail({ board }: BoardThumbnailProps) {
  if (board.thumbnailUrl) {
    return <img alt="" className="boards-thumbnail" src={board.thumbnailUrl} />
  }

  return (
    <div className="boards-thumbnail boards-thumbnail-placeholder" style={{ backgroundColor: thumbnailSurface }}>
      <span>{getInitials(board.title)}</span>
    </div>
  )
}

function getInitials(title: string) {
  const parts = title.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'T'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}
