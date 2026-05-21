'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTangentSession } from '@/features/auth/useTangentSession'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { listLocalBoardDocuments } from '@/features/boards/localBoardClient'
import { mapSettledWithConcurrency } from '@/features/shared/asyncConcurrency'
import type { WorkspaceBoardSortMode } from './WorkspaceBoardToolbar'
import {
  collectCachedBoards,
  createBoardScopes,
  mergeWorkspaceBoardResults,
} from './workspaceBoardGalleryDerived'
import { filterAndSortBoards } from './workspaceBoardUtils'

const maxConcurrentBoardListLoads = 4

export function useWorkspaceBoardGalleryData({
  panelBoardId,
  searchQuery,
  sortMode,
}: {
  panelBoardId: string | null
  searchQuery: string
  sortMode: WorkspaceBoardSortMode
}) {
  const { error: sessionError, session, status: sessionStatus } = useTangentSession()
  const [boards, setBoards] = useState<BoardPersistenceSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadedWorkspaceIdsBySignature, setLoadedWorkspaceIdsBySignature] = useState<Record<string, string[]>>({})
  const visibleBoardCountRef = useRef(0)

  const activeWorkspaces = useMemo(
    () => (sessionStatus === 'ready' ? session.workspaces : []),
    [session.workspaces, sessionStatus],
  )
  const workspaceSignature = useMemo(
    () => activeWorkspaces.map((workspace) => `${workspace.id}:${workspace.kind}:${workspace.planKey ?? ''}`).join('|'),
    [activeWorkspaces],
  )
  const loadedWorkspaceIds = useMemo(
    () => loadedWorkspaceIdsBySignature[workspaceSignature] ?? [],
    [loadedWorkspaceIdsBySignature, workspaceSignature],
  )
  const workspaceById = useMemo(
    () => new Map(activeWorkspaces.map((workspace) => [workspace.id, workspace])),
    [activeWorkspaces],
  )
  const loadedWorkspaceIdSet = useMemo(() => new Set(loadedWorkspaceIds), [loadedWorkspaceIds])
  const filteredBoards = useMemo(
    () => filterAndSortBoards(boards, searchQuery, sortMode),
    [boards, searchQuery, sortMode],
  )
  const panelBoard = useMemo(
    () => boards.find((board) => board.id === panelBoardId) ?? null,
    [boards, panelBoardId],
  )
  const boardScopes = useMemo(
    () => createBoardScopes(activeWorkspaces, filteredBoards, searchQuery.trim().length > 0),
    [activeWorkspaces, filteredBoards, searchQuery],
  )

  useEffect(() => {
    visibleBoardCountRef.current = boards.length
  }, [boards.length])

  const refreshBoards = useCallback(async (hasVisibleData = visibleBoardCountRef.current > 0) => {
    if (sessionStatus !== 'ready') return
    if (hasVisibleData) setIsRefreshing(true)
    else setIsLoading(true)
    try {
      const results = await mapSettledWithConcurrency(activeWorkspaces, maxConcurrentBoardListLoads, async (workspace) => {
        const response = await listLocalBoardDocuments(workspace)
        return { boards: response.boards, workspaceId: workspace.id }
      })
      const nextBoardsByWorkspace = new Map<string, BoardPersistenceSummary[]>()
      const failedWorkspaces: string[] = []
      const succeededWorkspaceIds: string[] = []

      results.forEach((result, index) => {
        const workspace = activeWorkspaces[index]
        if (!workspace) return
        if (result.status === 'fulfilled') {
          nextBoardsByWorkspace.set(result.value.workspaceId, result.value.boards)
          succeededWorkspaceIds.push(result.value.workspaceId)
          return
        }
        failedWorkspaces.push(workspace.name || 'Unknown')
      })

      if (succeededWorkspaceIds.length > 0) {
        setLoadedWorkspaceIdsBySignature((current) => ({
          ...current,
          [workspaceSignature]: [...new Set([...(current[workspaceSignature] ?? []), ...succeededWorkspaceIds])],
        }))
      }
      if (nextBoardsByWorkspace.size > 0 || activeWorkspaces.length === 0) {
        setBoards((current) => mergeWorkspaceBoardResults(current, activeWorkspaces, nextBoardsByWorkspace))
      }
      setError(failedWorkspaces.length > 0 ? `Some board spaces failed to load: ${failedWorkspaces.join(', ')}` : null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board list failed.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [activeWorkspaces, sessionStatus, workspaceSignature])

  useEffect(() => {
    if (sessionStatus !== 'ready') return
    const cachedBoards = collectCachedBoards(activeWorkspaces)
    const hasCachedBoards = cachedBoards.length > 0
    if (hasCachedBoards) {
      visibleBoardCountRef.current = Math.max(visibleBoardCountRef.current, cachedBoards.length)
    }
    const timeout = window.setTimeout(() => {
      if (hasCachedBoards) {
        setBoards((current) => (current.length === 0 ? cachedBoards : current))
        setIsLoading(false)
      }
      void refreshBoards(hasCachedBoards || visibleBoardCountRef.current > 0)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [activeWorkspaces, refreshBoards, sessionStatus, workspaceSignature])

  return {
    boardScopes,
    boards,
    error,
    filteredBoards,
    isLoading,
    isRefreshing,
    loadedWorkspaceIdSet,
    panelBoard,
    session,
    sessionError,
    sessionStatus,
    setBoards,
    setError,
    workspaceById,
  }
}
