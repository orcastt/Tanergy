import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { auditBoardDocument } from '@/features/boards/boardDocumentGuard'

const storageRoot = process.env.TANGENT_BOARD_STORAGE_DIR ?? path.join(process.cwd(), '.tangent-boards')
const boardsRoot = path.join(storageRoot, 'boards')

export type LocalBoardRecord = {
  byteSize: number
  document: unknown
  id: string
  savedAt: string
  title: string
}

export async function saveLocalBoard(input: {
  boardId?: string
  document: unknown
  title?: string
}) {
  const audit = auditBoardDocument(input.document)
  if (!audit.ok) {
    return { audit, board: null }
  }

  const boardId = sanitizeBoardId(input.boardId) ?? `board_${randomUUID()}`
  const record: LocalBoardRecord = {
    byteSize: audit.byteSize,
    document: input.document,
    id: boardId,
    savedAt: new Date().toISOString(),
    title: input.title?.trim() || 'Untitled Board',
  }

  await mkdir(boardsRoot, { recursive: true })
  await writeFile(getBoardPath(boardId), `${JSON.stringify(record, null, 2)}\n`)
  return { audit, board: record }
}

export async function loadLocalBoard(boardId: string) {
  const safeBoardId = sanitizeBoardId(boardId)
  if (!safeBoardId) throw new Error('Invalid board id.')
  const raw = await readFile(getBoardPath(safeBoardId), 'utf8')
  return JSON.parse(raw) as LocalBoardRecord
}

function getBoardPath(boardId: string) {
  return path.join(boardsRoot, `${boardId}.json`)
}

function sanitizeBoardId(value: string | undefined) {
  if (!value) return null
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes('..') ? value : null
}
