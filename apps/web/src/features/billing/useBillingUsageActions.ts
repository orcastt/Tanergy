'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { continueBillingCheckout } from './billingCheckoutFlow'
import {
  createBillingTopupCheckout,
  createGroupWorkspace,
  createWorkspaceSeatCheckout,
  createWorkspaceTopupCheckout,
} from './billingClient'
import { formatCredits } from './billingPresentation'
import type {
  GroupBillingSummary,
  TeamBillingCard,
  WorkspaceCommerceActivity,
} from './workspaceCommerceMock'

type BillingUsageActionsInput = {
  groupSummary: GroupBillingSummary
  setActivity: Dispatch<SetStateAction<WorkspaceCommerceActivity[]>>
  setGroupSummary: Dispatch<SetStateAction<GroupBillingSummary>>
  setTeamCards: Dispatch<SetStateAction<TeamBillingCard[]>>
}

export function useBillingUsageActions({
  groupSummary,
  setActivity,
  setGroupSummary,
  setTeamCards,
}: BillingUsageActionsInput) {
  const [isPending, setIsPending] = useState<null | string>(null)
  const [status, setStatus] = useState<null | string>(null)

  return {
    handleGroupAdd,
    handleGroupTopUp,
    handleTeamSeat,
    handleTeamTopUp,
    isPending,
    status,
  }

  async function handleTeamTopUp(card: TeamBillingCard) {
    if (!card.canManageBilling) return
    const credits = card.planKey === 'team_growth' ? 1200 : 800
    await runAction(`${card.id}:topup`, async () => {
      const workspace = teamWorkspaceFromCard(card)
      const checkout = await createWorkspaceTopupCheckout({
        credits,
        metadata: { action: 'team_wallet_topup', workspaceId: card.id },
      }, { workspace })
      const result = await continueBillingCheckout(checkout, { manualCompleteWorkspace: workspace })
      if (!result.openedHostedCheckout) {
        updateTeamCard(card.id, (current) => ({
          ...current,
          remainingCredits: current.remainingCredits + credits,
          totalCredits: current.totalCredits + credits,
        }), teamActivityEntry('Top-up', `+${formatCredits(credits)} credits`, card))
      }
      return result.message
    })
  }

  async function handleTeamSeat(card: TeamBillingCard) {
    if (!card.canManageBilling) return
    await runAction(`${card.id}:seat`, async () => {
      const workspace = teamWorkspaceFromCard(card)
      const checkout = await createWorkspaceSeatCheckout({
        metadata: { action: 'team_seat_purchase', workspaceId: card.id },
        planKey: card.planKey,
        quantity: 1,
      }, { workspace })
      const result = await continueBillingCheckout(checkout, { manualCompleteWorkspace: workspace })
      if (!result.openedHostedCheckout) {
        updateTeamCard(card.id, (current) => ({ ...current, seatLimit: current.seatLimit + 1 }), teamActivityEntry('Seat added', '+1 seat', card))
      }
      return result.message
    })
  }

  async function handleGroupTopUp() {
    const credits = 400
    await runAction('group:topup', async () => {
      const checkout = await createBillingTopupCheckout({
        credits,
        metadata: { action: 'personal_group_topup' },
      })
      const result = await continueBillingCheckout(checkout)
      if (!result.openedHostedCheckout) {
        updateGroupSummary((current) => ({
          ...current,
          remainingCredits: current.remainingCredits + credits,
          totalCredits: current.totalCredits + credits,
        }), groupActivityEntry('Top-up', `+${formatCredits(credits)} credits`))
      }
      return result.message
    })
  }

  async function handleGroupAdd() {
    await runAction('group:add', async () => {
      const name = window.prompt('Group name', 'New Group')?.trim()
      if (!name) throw new Error('Group name is required.')
      const response = await createGroupWorkspace({ name })
      updateGroupSummary((current) => ({
        ...current,
        groupsCreated: Math.min(current.groupLimit, current.groupsCreated + 1),
      }), groupActivityEntry('Group added', '+1 group', response.workspace.id))
      return `${response.workspace.name} created.`
    })
  }

  async function runAction(actionId: string, action: () => Promise<string>) {
    setIsPending(actionId)
    setStatus(null)
    try {
      setStatus(await action())
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Billing action failed.')
    } finally {
      setIsPending(null)
    }
  }

  function updateTeamCard(
    teamId: string,
    updater: (card: TeamBillingCard) => TeamBillingCard,
    entry: WorkspaceCommerceActivity,
  ) {
    setTeamCards((current) => current.map((card) => (card.id === teamId ? updater(card) : card)))
    recordActivity(entry)
  }

  function updateGroupSummary(
    updater: (card: GroupBillingSummary) => GroupBillingSummary,
    entry: WorkspaceCommerceActivity,
  ) {
    setGroupSummary((current) => updater(current))
    recordActivity(entry)
  }

  function recordActivity(entry: WorkspaceCommerceActivity) {
    setActivity((current) => [entry, ...current].slice(0, 20))
  }

  function groupActivityEntry(actionLabel: string, amountLabel: string, workspaceId = groupSummary.id) {
    return {
      actionLabel,
      amountLabel,
      happenedAt: new Date().toISOString(),
      id: `activity-group-${Date.now()}`,
      scope: 'group' as const,
      scopeLabel: 'Group',
      workspaceId,
    }
  }
}

function teamActivityEntry(actionLabel: string, amountLabel: string, card: TeamBillingCard) {
  return {
    actionLabel,
    amountLabel,
    happenedAt: new Date().toISOString(),
    id: `activity-${card.id}-${Date.now()}`,
    scope: 'team' as const,
    scopeLabel: card.name,
    workspaceId: card.id,
  }
}

function teamWorkspaceFromCard(card: TeamBillingCard): TangentWorkspace {
  return {
    boardCount: 0,
    id: card.id,
    kind: 'team_workspace',
    name: card.name,
    planKey: card.planKey,
    role: card.membershipRole,
  }
}
