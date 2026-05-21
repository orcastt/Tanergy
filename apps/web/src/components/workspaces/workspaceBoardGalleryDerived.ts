'use client'

import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardCardColor, BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { readCachedBoardList } from '@/features/boards/boardResourceCache'

export function collectCachedBoards(workspaces: TangentWorkspace[]) {
  return workspaces.flatMap((workspace) => readCachedBoardList(workspace.id) ?? [])
}

export function mergeWorkspaceBoardResults(
  currentBoards: BoardPersistenceSummary[],
  workspaces: TangentWorkspace[],
  nextBoardsByWorkspace: Map<string, BoardPersistenceSummary[]>,
) {
  const currentBoardsByWorkspace = new Map<string, BoardPersistenceSummary[]>()
  currentBoards.forEach((board) => {
    const bucket = currentBoardsByWorkspace.get(board.workspaceId) ?? []
    bucket.push(board)
    currentBoardsByWorkspace.set(board.workspaceId, bucket)
  })

  const merged: BoardPersistenceSummary[] = []
  workspaces.forEach((workspace) => {
    merged.push(...(nextBoardsByWorkspace.get(workspace.id) ?? currentBoardsByWorkspace.get(workspace.id) ?? []))
  })
  return merged
}

export function createBoardScopes(
  workspaces: TangentWorkspace[],
  boards: BoardPersistenceSummary[],
  hasSearch: boolean,
) {
  const createScopeSections = (scopedWorkspaces: TangentWorkspace[], hideHeaderForSingle = false) => scopedWorkspaces
    .map((workspace) => {
      const workspaceBoards = boards
        .filter((board) => board.workspaceId === workspace.id)
        .map((board) => ({
          ...board,
          cardColor: board.cardColor ?? getWorkspaceDefaultCardColor(workspace),
        }))
      return {
        boards: workspaceBoards,
        hideHeader: hideHeaderForSingle && scopedWorkspaces.length === 1,
        workspace,
      }
    })
    .filter((section) => (hasSearch ? section.boards.length > 0 : true))

  const privateWorkspaces = workspaces.filter((workspace) => workspace.kind === 'solo_workspace')
  const teamWorkspaces = workspaces.filter((workspace) => workspace.kind === 'team_workspace')
  const groupWorkspaces = workspaces.filter((workspace) => workspace.kind === 'group_workspace')

  return [
    { id: 'private', sections: createScopeSections(privateWorkspaces, true), title: 'Private' },
    { id: 'teams', sections: createScopeSections(teamWorkspaces), title: 'Team boards' },
    { id: 'groups', sections: createScopeSections(groupWorkspaces), title: 'Group boards' },
  ].filter((scope) => scope.sections.length > 0)
}

function getWorkspaceDefaultCardColor(workspace: TangentWorkspace): BoardCardColor {
  if (workspace.kind === 'solo_workspace') return 'mint'
  if (workspace.kind === 'team_workspace') return 'yellow'
  return 'peach'
}
