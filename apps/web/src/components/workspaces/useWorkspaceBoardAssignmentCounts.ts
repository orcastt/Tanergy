'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { listLocalBoardMembers } from '@/features/boards/localBoardClient'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'

type UseWorkspaceBoardAssignmentCountsArgs = {
  boards: BoardPersistenceSummary[]
  enabled: boolean
  reloadToken: number
  workspace: TangentWorkspace
}

export function useWorkspaceBoardAssignmentCounts({
  boards,
  enabled,
  reloadToken,
  workspace,
}: UseWorkspaceBoardAssignmentCountsArgs) {
  const [countsByUserId, setCountsByUserId] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!enabled || boards.length === 0) return
    let cancelled = false

    Promise.allSettled(boards.map(async (board) => {
      const response = await listLocalBoardMembers(board.id, workspace)
      return { board, members: response.members }
    }))
      .then((results) => {
        if (cancelled) return
        const nextCounts: Record<string, number> = {}
        for (const result of results) {
          if (result.status !== 'fulfilled') continue
          for (const member of result.value.members) {
            nextCounts[member.userId] = (nextCounts[member.userId] ?? 0) + 1
          }
        }
        setCountsByUserId(nextCounts)
      })
      .catch(() => {
        if (!cancelled) setCountsByUserId({})
      })

    return () => {
      cancelled = true
    }
  }, [boards, enabled, reloadToken, workspace])

  return useMemo(() => (enabled && boards.length > 0 ? countsByUserId : {}), [boards.length, countsByUserId, enabled])
}
