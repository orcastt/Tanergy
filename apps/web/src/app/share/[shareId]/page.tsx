'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { detectBoardCanvasEngine } from '@/features/boards/boardCanvasEngine'
import type {
  BoardPersistenceRecord,
  BoardShareLinkResolveRecord,
} from '@/features/boards/boardTypes'
import {
  loadSharedBoardDocument,
  resolveLocalBoardShareLink,
} from '@/features/boards/localBoardClient'

const KonvaCanvasSpike = dynamic(
  () => import('@/components/konva-canvas/KonvaCanvasSpike').then((module) => module.KonvaCanvasSpike),
  { ssr: false }
)

type ShareLoadState =
  | { status: 'loading' }
  | { error: string; status: 'missing' | 'unsupported' }
  | { board: BoardPersistenceRecord; shareLink: BoardShareLinkResolveRecord; status: 'loaded' }

export default function PublicShareBoardPage() {
  const params = useParams<{ shareId?: string | string[] }>()
  const rawShareId = Array.isArray(params.shareId) ? params.shareId[0] : params.shareId
  const shareId = rawShareId ? decodeURIComponent(rawShareId) : ''
  const [state, setState] = useState<ShareLoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const loadSharedBoard = async () => {
      if (!shareId) {
        if (!cancelled) setState({ error: 'Share link is missing.', status: 'missing' })
        return
      }
      if (!cancelled) setState({ status: 'loading' })
      try {
        const [shareResponse, boardResponse] = await Promise.all([
          resolveLocalBoardShareLink(shareId),
          loadSharedBoardDocument(shareId),
        ])
        const shareLink = shareResponse.shareLink
        const board = boardResponse.board
        if (!shareLink || !board) throw new Error('Shared board was not found.')
        if (detectBoardCanvasEngine(board.document) !== 'konva') {
          throw new Error('This shared Board is not a Konva v2 document.')
        }
        if (!cancelled) setState({ board, shareLink, status: 'loaded' })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Shared board load failed.'
        setState({
          error: message,
          status: message.includes('Konva v2') ? 'unsupported' : 'missing',
        })
      }
    }
    void loadSharedBoard()
    return () => {
      cancelled = true
    }
  }, [shareId])

  if (state.status === 'loading') {
    return <ShareRouteState detail="Loading shared board..." title="Opening Share Link" />
  }

  if (state.status === 'missing') {
    return <ShareRouteState detail={state.error} title="Share Link Not Available" />
  }

  if (state.status === 'unsupported') {
    return <ShareRouteState detail={state.error} title="Unsupported Shared Board" />
  }

  if (state.status !== 'loaded') {
    return null
  }

  const loadedState = state

  return (
    <KonvaCanvasSpike
      boardId={loadedState.board.id}
      boardTitle={loadedState.shareLink.boardTitle}
      initialBoard={loadedState.board}
      mode="board"
      readOnly
      seedOnMount={false}
    />
  )
}

function ShareRouteState({ detail, title }: { detail: string; title: string }) {
  return (
    <main className="canvas-board-route-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </main>
  )
}
