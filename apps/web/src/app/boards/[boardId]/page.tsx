'use client'

import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import type { BoardPersistenceRecord } from '@/features/boards/boardTypes'
import {
  detectBoardCanvasEngine,
  getDefaultBoardCanvasEngine,
  isTldrawReferenceEnabled,
  parseBoardCanvasEngine,
} from '@/features/boards/boardCanvasEngine'
import {
  loadLocalBoardDocument,
  loadSharedBoardDocument,
  renameLocalBoardDocument,
  saveLocalBoardDocument,
} from '@/features/boards/localBoardClient'
import { migrateTldrawV1BoardToKonvaV2 } from '@/features/boards/tldrawToKonvaMigration'

const CanvasSpike = dynamic(
  () => import('@/components/canvas/CanvasSpike').then((module) => module.CanvasSpike),
  {
    ssr: false,
  }
)
const KonvaCanvasSpike = dynamic(
  () => import('@/components/konva-canvas/KonvaCanvasSpike').then((module) => module.KonvaCanvasSpike),
  {
    ssr: false,
  }
)

type BoardLoadState =
  | { board: BoardPersistenceRecord; status: 'loaded' }
  | { error?: string; status: 'idle' | 'loading' | 'missing' }

export default function BoardCanvasPage() {
  const params = useParams<{ boardId?: string | string[] }>()
  const searchParams = useSearchParams()
  const { session } = useTangentSession()
  const rawBoardId = Array.isArray(params.boardId) ? params.boardId[0] : params.boardId
  const boardId = rawBoardId ? decodeURIComponent(rawBoardId) : 'untitled-board'
  const isNewBoard = searchParams.get('new') === '1'
  const shareId = searchParams.get('share')
  const requestedWorkspaceId = searchParams.get('workspace')
  const requestedEngine = parseBoardCanvasEngine(searchParams.get('engine'))
  const [loadState, setLoadState] = useState<BoardLoadState>({ status: isNewBoard ? 'idle' : 'loading' })
  const [boardTitleOverride, setBoardTitleOverride] = useState<{ boardId: string; title: string } | null>(null)
  const tldrawReferenceEnabled = isTldrawReferenceEnabled()
  const detectedEngine = loadState.status === 'loaded' ? detectBoardCanvasEngine(loadState.board.document) : null
  const effectiveBoardId = loadState.status === 'loaded' ? loadState.board.id : boardId
  const candidateWorkspaces = useMemo(() => {
    const ordered: TangentWorkspace[] = []
    const seen = new Set<string>()
    const pushWorkspace = (workspace: TangentWorkspace | null | undefined) => {
      if (!workspace || seen.has(workspace.id)) return
      seen.add(workspace.id)
      ordered.push(workspace)
    }

    pushWorkspace(session.workspaces.find((workspace) => workspace.id === requestedWorkspaceId))
    pushWorkspace(session.activeWorkspace)
    session.workspaces.forEach((workspace) => pushWorkspace(workspace))
    return ordered
  }, [requestedWorkspaceId, session.activeWorkspace, session.workspaces])
  const resolvedWorkspace = useMemo(() => {
    if (loadState.status === 'loaded') {
      return candidateWorkspaces.find((workspace) => workspace.id === loadState.board.workspaceId)
        ?? session.workspaces.find((workspace) => workspace.id === loadState.board.workspaceId)
        ?? candidateWorkspaces[0]
        ?? session.activeWorkspace
    }
    return candidateWorkspaces[0] ?? session.activeWorkspace
  }, [candidateWorkspaces, loadState, session.activeWorkspace, session.workspaces])
  const engine = useMemo(
    () => detectedEngine ?? requestedEngine ?? getDefaultBoardCanvasEngine(),
    [detectedEngine, requestedEngine]
  )
  const wantsKonvaCopy = loadState.status === 'loaded' && detectedEngine === 'tldraw' && requestedEngine === 'konva'
  const boardTitle = boardTitleOverride?.boardId === effectiveBoardId
    ? boardTitleOverride.title
    : loadState.status === 'loaded'
      ? loadState.board.title
      : formatBoardTitle(boardId)

  useEffect(() => {
    let cancelled = false
    const loadBoard = async () => {
      if (isNewBoard) {
        if (!cancelled) setLoadState({ status: 'idle' })
        return
      }
      if (!cancelled) setLoadState({ status: 'loading' })
      try {
        const response = shareId
          ? await loadSharedBoardDocument(shareId)
          : await loadBoardAcrossWorkspaces(boardId, candidateWorkspaces)
        if (cancelled) return
        setLoadState(response.board ? { board: response.board, status: 'loaded' } : { status: 'missing' })
      } catch (error) {
        if (!cancelled) setLoadState({ error: error instanceof Error ? error.message : 'Board load failed.', status: 'missing' })
      }
    }
    void loadBoard()
    return () => {
      cancelled = true
    }
  }, [boardId, candidateWorkspaces, isNewBoard, shareId])

  const renameBoardTitle = useCallback(async (title: string) => {
    const nextTitle = title.trim()
    if (!nextTitle) return boardTitle
    try {
      const response = await renameLocalBoardDocument(effectiveBoardId, nextTitle, resolvedWorkspace)
      const renamedTitle = response.board?.title ?? nextTitle
      setBoardTitleOverride({ boardId: effectiveBoardId, title: renamedTitle })
      return renamedTitle
    } catch (error) {
      if (!isNewBoard && loadState.status !== 'missing') throw error
      setBoardTitleOverride({ boardId: effectiveBoardId, title: nextTitle })
      return nextTitle
    }
  }, [boardTitle, effectiveBoardId, isNewBoard, loadState.status, resolvedWorkspace])

  if (loadState.status === 'loading') {
    return <BoardRouteState title="Loading Board" detail={formatBoardTitle(boardId)} />
  }

  if (loadState.status === 'loaded' && !detectedEngine) {
    return (
      <BoardRouteState
        title="Unsupported Board Document"
        detail="This saved Board is not a tldraw v1 or Konva v2 document, so it was not opened automatically."
      />
    )
  }

  if (loadState.status === 'loaded' && detectedEngine === 'tldraw' && (!tldrawReferenceEnabled || wantsKonvaCopy)) {
    return (
      <LegacyTldrawMigrationState
        board={loadState.board}
        detail={tldrawReferenceEnabled
          ? 'This saved Board is a legacy tldraw v1 document. Copy it to a new Konva v2 Board to continue migration testing.'
          : 'This saved Board is a legacy tldraw v1 document. Production Boards must be opened through Konva v2.'}
        workspace={resolvedWorkspace}
      />
    )
  }

  if (engine === 'konva') {
    return (
      <KonvaCanvasSpike
        autoLoadBoard={loadState.status === 'loaded' && detectedEngine === 'konva'}
        boardId={effectiveBoardId}
        boardTitle={boardTitle}
        mode="board"
        onBoardLoaded={(title) => setBoardTitleOverride({ boardId: effectiveBoardId, title })}
        onBoardTitleRename={renameBoardTitle}
        seedOnMount={false}
        workspace={resolvedWorkspace}
      />
    )
  }

  if (!tldrawReferenceEnabled) {
    return (
      <BoardRouteState
        title="tldraw Reference Disabled"
        detail="tldraw is only available as a development reference route, not as a production Board engine."
      />
    )
  }

  return (
    <CanvasSpike
      autoLoadBoard={loadState.status === 'loaded' && detectedEngine === 'tldraw'}
      boardId={effectiveBoardId}
      boardTitle={boardTitle}
      headerTitle={boardTitle}
      onBoardLoaded={(title) => setBoardTitleOverride({ boardId: effectiveBoardId, title })}
      onBoardTitleRename={renameBoardTitle}
      seedOnMount={false}
      workspace={resolvedWorkspace}
    />
  )
}

function BoardRouteState({ detail, title }: { detail: string; title: string }) {
  return (
    <main className="canvas-board-route-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </main>
  )
}

function LegacyTldrawMigrationState({
  board,
  detail,
  workspace,
}: {
  board: BoardPersistenceRecord
  detail: string
  workspace?: TangentWorkspace
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isCopying, setIsCopying] = useState(false)

  const copyToKonva = async () => {
    setIsCopying(true)
    setError(null)
    try {
      const boardId = createKonvaCopyBoardId(board.id)
      const title = `${board.title} Konva copy`
      const migrated = migrateTldrawV1BoardToKonvaV2(board.document, { boardId, title })
      await saveLocalBoardDocument({
        boardId,
        cardColor: board.cardColor ?? null,
        description: board.description ?? null,
        document: migrated.document,
        title,
      }, workspace)
      const query = new URLSearchParams()
      if (workspace?.id) query.set('workspace', workspace.id)
      router.push(`/boards/${encodeURIComponent(boardId)}${query.toString() ? `?${query.toString()}` : ''}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Konva copy failed.')
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <main className="canvas-board-route-state">
      <strong>Legacy tldraw Board</strong>
      <span>{detail}</span>
      <button className="product-button product-button-primary" disabled={isCopying} onClick={() => void copyToKonva()} type="button">
        {isCopying ? 'Copying...' : 'Copy to Konva v2'}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </main>
  )
}

function createKonvaCopyBoardId(boardId: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now()}`
  return `${boardId.replace(/[^a-zA-Z0-9._-]+/g, '-')}-konva-${suffix}`
}

function formatBoardTitle(boardId: string) {
  return boardId
    .replace(/^board[_-]?/i, '')
    .replace(/[._-]+/g, ' ')
    .trim() || 'Untitled board'
}

async function loadBoardAcrossWorkspaces(
  boardId: string,
  workspaces: TangentWorkspace[]
) {
  let lastError: unknown = null

  for (const workspace of workspaces) {
    try {
      return await loadLocalBoardDocument(boardId, workspace)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Board load failed.')
}
