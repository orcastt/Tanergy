'use client'

import dynamic from 'next/dynamic'
import { useParams, useSearchParams } from 'next/navigation'
import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import type { BoardPersistenceRecord, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import {
  detectBoardCanvasEngine,
} from '@/features/boards/boardCanvasEngine'
import {
  loadLocalBoardDocument,
  loadSharedBoardDocument,
  renameLocalBoardDocument,
} from '@/features/boards/localBoardClient'
const KonvaCanvasSpike = dynamic(
  () => import('@/components/konva-canvas/KonvaCanvasSpike').then((module) => module.KonvaCanvasSpike),
  {
    loading: () => <BoardRouteState title="Loading Board" detail="Opening canvas..." />,
    ssr: false,
  }
)

type BoardLoadState =
  | { board: BoardPersistenceRecord; status: 'loaded' }
  | { error?: string; status: 'idle' | 'loading' | 'missing' }

export default function BoardCanvasPage() {
  const params = useParams<{ boardId?: string | string[] }>()
  const searchParams = useSearchParams()
  const rawBoardId = Array.isArray(params.boardId) ? params.boardId[0] : params.boardId
  const boardId = rawBoardId ? safeDecodeURIComponent(rawBoardId) : 'untitled-board'
  const isNewBoard = searchParams.get('new') === '1'
  const shareId = searchParams.get('share')
  const requestedWorkspaceId = searchParams.get('workspace')
  const { error: sessionError, session, status: sessionStatus } = useTangentSession({
    requestedWorkspaceId: shareId ? null : requestedWorkspaceId,
  })
  const [loadState, setLoadState] = useState<BoardLoadState>({ status: isNewBoard ? 'idle' : 'loading' })
  const [boardTitleOverride, setBoardTitleOverride] = useState<{ boardId: string; title: string } | null>(null)
  const detectedEngine = loadState.status === 'loaded' ? detectBoardCanvasEngine(loadState.board.document) : null
  const effectiveBoardId = loadState.status === 'loaded' ? loadState.board.id : boardId
  const candidateWorkspaces = useMemo(() => {
    if (!shareId && sessionStatus !== 'ready') return []
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
  }, [requestedWorkspaceId, session.activeWorkspace, session.workspaces, sessionStatus, shareId])
  const resolvedWorkspace = useMemo(() => {
    if (loadState.status === 'loaded') {
      return candidateWorkspaces.find((workspace) => workspace.id === loadState.board.workspaceId)
        ?? session.workspaces.find((workspace) => workspace.id === loadState.board.workspaceId)
        ?? candidateWorkspaces[0]
        ?? session.activeWorkspace
    }
    return candidateWorkspaces[0] ?? session.activeWorkspace
  }, [candidateWorkspaces, loadState, session.activeWorkspace, session.workspaces])
  const loadedBoard = loadState.status === 'loaded' ? loadState.board : null
  const boardTitle = boardTitleOverride?.boardId === effectiveBoardId
    ? boardTitleOverride.title
    : loadState.status === 'loaded'
      ? loadState.board.title
      : formatBoardTitle(boardId)
  const clearNewBoardQuery = useCallback((board: BoardPersistenceSummary) => {
    if (!isNewBoard || typeof window === 'undefined') return
    const query = new URLSearchParams(searchParams.toString())
    query.delete('new')
    if (board.workspaceId) query.set('workspace', board.workspaceId)
    const nextUrl = `/boards/${encodeURIComponent(board.id)}${query.toString() ? `?${query.toString()}` : ''}`
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [isNewBoard, searchParams])

  useEffect(() => {
    let cancelled = false
    const loadBoard = async () => {
      if (!shareId && sessionStatus !== 'ready') {
        if (!cancelled) setLoadState({ status: 'loading' })
        return
      }
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
  }, [boardId, candidateWorkspaces, isNewBoard, sessionStatus, shareId])

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
  }, [boardTitle, effectiveBoardId, isNewBoard, loadState.status, resolvedWorkspace, setBoardTitleOverride])

  if (!shareId && sessionStatus === 'error') {
    return <BoardRouteState title="Board unavailable" detail={sessionError ?? 'Workspace session failed to load.'} />
  }

  if (!shareId && sessionStatus !== 'ready') {
    return <BoardRouteState title="Loading Board" detail="Loading workspace access..." />
  }

  if (loadState.status === 'loading') {
    return <BoardRouteState title="Loading Board" detail={formatBoardTitle(boardId)} />
  }

  if (loadState.status === 'loaded' && !detectedEngine) {
    return (
      <BoardRouteState
        title="Unsupported Board Document"
        detail="This saved Board is not a supported Konva v2 document, so it was not opened automatically."
      />
    )
  }

  if (loadState.status === 'missing') {
    return (
      <BoardRouteState
        title="Board unavailable"
        detail={loadState.error ?? 'This board was deleted or you no longer have access.'}
      />
    )
  }

  return (
    <BoardCanvasErrorBoundary boardId={effectiveBoardId}>
      <KonvaCanvasSpike
        autoLoadBoard={false}
        boardId={effectiveBoardId}
        boardTitle={boardTitle}
        initialBoard={loadedBoard && detectedEngine === 'konva' ? loadedBoard : null}
        mode="board"
        onBoardLoaded={(title) => setBoardTitleOverride({ boardId: effectiveBoardId, title })}
        onBoardSaved={clearNewBoardQuery}
        onBoardTitleRename={renameBoardTitle}
        seedOnMount={false}
        workspace={resolvedWorkspace}
      />
    </BoardCanvasErrorBoundary>
  )
}

function BoardRouteState({ actions, detail, title }: { actions?: ReactNode; detail: string; title: string }) {
  return (
    <main className="canvas-board-route-state">
      <strong>{title}</strong>
      <span>{detail}</span>
      {actions ? <div className="canvas-board-route-actions">{actions}</div> : null}
    </main>
  )
}

class BoardCanvasErrorBoundary extends Component<{ boardId: string; children: ReactNode }, { error: null | string }> {
  state: { error: null | string } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : 'Board canvas failed to load.' }
  }

  componentDidCatch(error: unknown) {
    console.error('Board canvas failed to render.', error)
  }

  componentDidUpdate(previousProps: { boardId: string }) {
    if (previousProps.boardId !== this.props.boardId && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <BoardRouteState
        actions={(
          <>
            <button className="product-button product-button-secondary" onClick={() => window.location.assign('/workspaces')} type="button">
              Back to workspace
            </button>
            <button className="product-button" onClick={() => window.location.reload()} type="button">
              Reload
            </button>
          </>
        )}
        detail={this.state.error}
        title="Board could not load"
      />
    )
  }
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
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
  if (workspaces.length === 0) {
    throw new Error('Board load failed.')
  }

  let lastError: Error | null = null
  for (const workspace of workspaces) {
    try {
      return await loadLocalBoardDocument(boardId, workspace)
    } catch (error) {
      const nextError = error instanceof Error ? error : new Error('Board load failed.')
      if (!isWorkspaceScopedBoardMiss(nextError)) {
        throw nextError
      }
      lastError = nextError
    }
  }
  throw lastError ?? new Error('Board load failed.')
}

function isWorkspaceScopedBoardMiss(error: Error) {
  const message = error.message.toLowerCase()
  return message.includes('board not found') || message.includes('not found in workspace')
}
