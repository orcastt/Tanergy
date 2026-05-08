'use client'

import { useState } from 'react'
import {
  acceptWorkspaceInvitation,
  completeBillingPayment,
  createGroupWorkspace,
  createTeamSubscriptionCheckout,
} from '@/features/billing/billingClient'
import type { PlanKey, WorkspaceKind } from '@/features/billing/billingTypes'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'
import type {
  WorkspaceDirectoryItem,
  WorkspaceMembershipRole,
} from '@/features/workspaces/workspaceDirectoryMock'

type WorkspaceDirectoryActionsProps = {
  createLabel: string
  joinLabel: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  onWorkspaceAdded: (item: WorkspaceDirectoryItem) => void
}

export function WorkspaceDirectoryActions({
  createLabel,
  joinLabel,
  kind,
  onWorkspaceAdded,
}: WorkspaceDirectoryActionsProps) {
  const [status, setStatus] = useState<null | string>(null)
  const [isPending, setIsPending] = useState(false)

  return (
    <>
      <div className="workspace-directory-header-actions">
        <button className="product-button product-button-primary" disabled={isPending} onClick={createWorkspace} type="button">
          {createLabel}
        </button>
        <button className="product-button product-button-secondary" disabled={isPending} onClick={joinWorkspace} type="button">
          {joinLabel}
        </button>
      </div>
      {status ? <p className="workspace-directory-status" role="status">{status}</p> : null}
    </>
  )

  async function createWorkspace() {
    setIsPending(true)
    setStatus(null)
    try {
      if (kind === 'group_workspace') {
        await createGroup()
      } else {
        await createTeam()
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Workspace action failed.')
    } finally {
      setIsPending(false)
    }
  }

  async function createGroup() {
    const name = window.prompt('Group name', 'New Group')?.trim()
    if (!name) throw new Error('Group name is required.')
    const response = await createGroupWorkspace({ name })
    onWorkspaceAdded({
      boardCount: 0,
      id: response.workspace.id,
      kind: 'group_workspace',
      memberInitials: [getCurrentSessionSnapshot().user.avatarInitials],
      membershipRole: normalizeMembershipRole(response.workspace.role),
      name: response.workspace.name,
      planKey: 'collaborate_start',
      relationship: 'created',
    })
    setStatus(`${response.workspace.name} created.`)
  }

  async function createTeam() {
    const teamName = window.prompt('Team name', 'New Team')?.trim()
    if (!teamName) throw new Error('Team name is required.')
    const planKey = normalizeTeamPlan(window.prompt('Plan key', 'team_start') ?? 'team_start')
    const quantity = normalizeQuantity(window.prompt('Seats to start with', '2') ?? '2')
    const checkout = await createTeamSubscriptionCheckout({ planKey, quantity, teamName })
    if (!checkout.payment?.id) throw new Error('Checkout did not return a payment id.')
    const completed = await completeBillingPayment(checkout.payment.id)
    const metadata = completed.payment?.metadata ?? {}
    const workspaceId = typeof metadata.workspaceId === 'string' ? metadata.workspaceId : checkout.payment.id
    const workspaceName = typeof metadata.workspaceName === 'string' ? metadata.workspaceName : teamName
    onWorkspaceAdded({
      boardCount: 0,
      id: workspaceId,
      kind: 'team_workspace',
      memberInitials: [getCurrentSessionSnapshot().user.avatarInitials],
      membershipRole: 'owner',
      name: workspaceName,
      planKey,
      relationship: 'created',
    })
    setStatus(`${workspaceName} is active.`)
  }

  async function joinWorkspace() {
    setIsPending(true)
    setStatus(null)
    try {
      const token = parseInviteToken(window.prompt('Invite token or link') ?? '')
      if (!token) throw new Error('Invite token is required.')
      const response = await acceptWorkspaceInvitation(token)
      const workspaceKind = response.result.invitation.metadata.workspaceKind === 'team_workspace'
        ? 'team_workspace'
        : 'group_workspace'
      onWorkspaceAdded({
        boardCount: 0,
        id: response.result.workspaceId,
        kind: workspaceKind,
        memberInitials: [getCurrentSessionSnapshot().user.avatarInitials],
        membershipRole: normalizeMembershipRole(response.result.role),
        name: `Joined ${workspaceKind === 'team_workspace' ? 'Team' : 'Group'}`,
        planKey: workspaceKind === 'team_workspace' ? 'team_start' : 'collaborate_start',
        relationship: 'joined',
      })
      setStatus('Invite accepted.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invite accept failed.')
    } finally {
      setIsPending(false)
    }
  }
}

function normalizeMembershipRole(role: string): WorkspaceMembershipRole {
  if (role === 'admin' || role === 'editor' || role === 'owner' || role === 'viewer') return role
  return 'viewer'
}

function normalizeQuantity(value: string) {
  const quantity = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(quantity) || quantity < 1) throw new Error('Seat quantity must be at least one.')
  return quantity
}

function normalizeTeamPlan(value: string): Extract<PlanKey, 'team_growth' | 'team_start'> {
  const normalized = value.trim()
  if (normalized === 'team_growth' || normalized === 'team_start') return normalized
  throw new Error('Plan must be team_start or team_growth.')
}

function parseInviteToken(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.split('/').filter(Boolean).at(-1) ?? trimmed
}
