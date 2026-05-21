'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
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
  | { error?: string; status: 'password' }
  | { error: string; status: 'missing' | 'unsupported' }
  | { board: BoardPersistenceRecord; shareLink: BoardShareLinkResolveRecord; status: 'loaded' }

export default function PublicShareBoardPage() {
  const params = useParams<{ shareId?: string | string[] }>()
  const rawShareId = Array.isArray(params.shareId) ? params.shareId[0] : params.shareId
  const shareId = rawShareId ? decodeURIComponent(rawShareId) : ''
  const [state, setState] = useState<ShareLoadState>({ status: 'loading' })
  const [passwordInput, setPasswordInput] = useState('')
  const [sharePassword, setSharePassword] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadSharedBoard = async () => {
      if (!shareId) {
        if (!cancelled) setState({ error: 'Share link is missing.', status: 'missing' })
        return
      }
      if (!cancelled) setState({ status: 'loading' })
      try {
        const shareResponse = await resolveLocalBoardShareLink(shareId, sharePassword ?? undefined)
        const boardResponse = await loadSharedBoardDocument(shareId, sharePassword ?? undefined)
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
        if (isSharePasswordError(message)) {
          setState({ error: sharePassword ? 'That password did not unlock this share link.' : undefined, status: 'password' })
          return
        }
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
  }, [shareId, sharePassword])

  if (state.status === 'loading') {
    return <ShareRouteState detail="Loading shared board..." title="Opening Share Link" />
  }

  if (state.status === 'password') {
    return (
      <SharePasswordState
        error={state.error}
        onChange={setPasswordInput}
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = passwordInput.trim()
          if (!trimmed) {
            setState({ error: 'Enter the share password.', status: 'password' })
            return
          }
          setSharePassword(trimmed)
        }}
        password={passwordInput}
      />
    )
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

function SharePasswordState({
  error,
  onChange,
  onSubmit,
  password,
}: {
  error?: string
  onChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  password: string
}) {
  return (
    <main className="canvas-board-route-state">
      <strong>Share Link Password</strong>
      <form onSubmit={onSubmit}>
        <input
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
        <button type="submit">Open Board</button>
      </form>
      {error ? <span>{error}</span> : null}
    </main>
  )
}

function isSharePasswordError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('share') && normalized.includes('password')
}
