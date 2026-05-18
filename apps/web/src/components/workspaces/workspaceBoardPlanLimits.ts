'use client'

import { loadBillingPlans } from '@/features/billing/billingClient'
import { planCatalog } from '@/features/billing/billingContracts'
import type { WorkspacePlanSummary } from '@/features/billing/billingTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import type { BoardPersistenceSummary } from '@/features/boards/boardTypes'
import { readCachedBoardList } from '@/features/boards/boardResourceCache'
import { formatWorkspacePlanName } from '@/features/workspaces/workspacePresentation'

export type WorkspaceBoardLimitAction = 'copy' | 'create'

export type WorkspaceBoardLimitDialogState = {
  message: string
  planName: string
  workspaceName: string
}

export async function resolveWorkspaceBoardLimitDialog(
  workspace: TangentWorkspace,
  boards: BoardPersistenceSummary[],
  loadedWorkspaceIds: ReadonlySet<string>,
  action: WorkspaceBoardLimitAction,
) {
  if (!workspace.planKey) return null
  const plan = await resolveWorkspacePlan(workspace)
  const boardLimit = plan?.boardLimit
  const boardCount = resolveWorkspaceBoardCount(workspace, boards, loadedWorkspaceIds)
  if (typeof boardLimit !== 'number' || boardCount < boardLimit) return null
  const planName = plan?.name?.trim() || formatWorkspacePlanName(workspace.planKey)
  return buildWorkspaceBoardLimitDialogState(planName, boardLimit, workspace, action)
}

export function describeWorkspaceBoardLimitError(
  workspace: TangentWorkspace | null | undefined,
  message: string,
  action: WorkspaceBoardLimitAction,
) {
  if (!isWorkspaceBoardLimitMessage(message)) return null
  return {
    message: `${normalizeLimitMessage(message)} Upgrade before you ${action} another board.`,
    planName: workspace?.planKey ? formatWorkspacePlanName(workspace.planKey) : 'Current plan',
    workspaceName: workspace?.name ?? 'Current workspace',
  } satisfies WorkspaceBoardLimitDialogState
}

function buildWorkspaceBoardLimitDialogState(
  planName: string,
  boardLimit: number,
  workspace: TangentWorkspace,
  action: WorkspaceBoardLimitAction,
): WorkspaceBoardLimitDialogState {
  const boardLabel = boardLimit === 1 ? 'board' : 'boards'
  return {
    message: `${planName} allows up to ${boardLimit} ${boardLabel} in ${formatWorkspaceScopeLabel(workspace)}. Upgrade before you ${action} another board.`,
    planName,
    workspaceName: workspace.name,
  }
}

function resolveWorkspaceBoardCount(
  workspace: TangentWorkspace,
  boards: BoardPersistenceSummary[],
  loadedWorkspaceIds: ReadonlySet<string>,
) {
  const cachedBoardCount = readCachedBoardList(workspace.id)?.length ?? 0
  const liveBoardCount = boards.filter((board) => board.workspaceId === workspace.id).length
  if (loadedWorkspaceIds.has(workspace.id)) {
    return Math.max(cachedBoardCount, liveBoardCount)
  }
  return Math.max(workspace.boardCount, cachedBoardCount, liveBoardCount)
}

function formatWorkspaceScopeLabel(workspace: TangentWorkspace) {
  if (workspace.kind === 'team_workspace') return 'this Team workspace'
  if (workspace.kind === 'group_workspace') return 'this Group workspace'
  return 'this Private workspace'
}

function isWorkspaceBoardLimitMessage(message: string) {
  return /allows up to\s+\d+\s+board/i.test(message)
}

function normalizeLimitMessage(message: string) {
  return message.replace(/\b1 boards\b/i, '1 board').trim()
}

async function resolveWorkspacePlan(workspace: TangentWorkspace): Promise<WorkspacePlanSummary | null> {
  if (!workspace.planKey) return null
  try {
    const response = await loadBillingPlans()
    return response.plans.find((item) => item.planKey === workspace.planKey) ?? planCatalog[workspace.planKey] ?? null
  } catch {
    return planCatalog[workspace.planKey] ?? null
  }
}
