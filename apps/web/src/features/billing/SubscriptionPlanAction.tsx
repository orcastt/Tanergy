'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  createCollaborateSubscriptionCheckout,
  createTeamSubscriptionCheckout,
} from './billingClient'
import { continueBillingCheckout } from './billingCheckoutFlow'
import type { PlanKey } from './billingTypes'

type SubscriptionPlanActionProps = {
  activeCount: number
  className: string
  href: string
  label: string
  planKey: PlanKey
  planName: string
}

export function SubscriptionPlanAction({
  activeCount,
  className,
  href,
  label,
  planKey,
  planName,
}: SubscriptionPlanActionProps) {
  const [status, setStatus] = useState<null | string>(null)
  const [isPending, setIsPending] = useState(false)
  const shouldNavigate = activeCount > 0 || planKey === 'enterprise' || planKey === 'free_canvas'

  if (shouldNavigate) {
    return <Link className={className} href={href}>{label}</Link>
  }

  return (
    <div className="workspace-commerce-action-stack">
      <button className={className} disabled={isPending} onClick={selectPlan} type="button">
        {isPending ? 'Processing' : label}
      </button>
      {status ? <span className="workspace-commerce-note" role="status">{status}</span> : null}
    </div>
  )

  async function selectPlan() {
    setIsPending(true)
    setStatus(null)
    try {
      const checkout = isCollaboratePlan(planKey)
        ? await createCollaborateSubscriptionCheckout({ planKey })
        : isTeamPlan(planKey)
          ? await createTeamCheckout(planKey, planName)
          : null
      if (!checkout) throw new Error('This plan is not available for checkout.')
      const { completed, message, openedHostedCheckout } = await continueBillingCheckout(checkout)
      if (openedHostedCheckout) {
        setStatus(message)
        return
      }
      const workspaceName = completed?.payment?.metadata.workspaceName
      setStatus(typeof workspaceName === 'string' ? `${workspaceName} is active.` : `${planName} is active.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Checkout failed.')
    } finally {
      setIsPending(false)
    }
  }
}

async function createTeamCheckout(planKey: Extract<PlanKey, 'team_growth' | 'team_start'>, planName: string) {
  const teamName = window.prompt('Team name', `${planName} Workspace`)?.trim()
  if (!teamName) throw new Error('Team name is required.')
  const rawQuantity = window.prompt('Seats to start with', '2')?.trim() ?? '2'
  const quantity = Number.parseInt(rawQuantity, 10)
  if (!Number.isFinite(quantity) || quantity < 1) throw new Error('Seat quantity must be at least one.')
  return createTeamSubscriptionCheckout({ planKey, quantity, teamName })
}

function isCollaboratePlan(planKey: PlanKey): planKey is Extract<PlanKey, 'collaborate_plus' | 'collaborate_start'> {
  return planKey === 'collaborate_plus' || planKey === 'collaborate_start'
}

function isTeamPlan(planKey: PlanKey): planKey is Extract<PlanKey, 'team_growth' | 'team_start'> {
  return planKey === 'team_growth' || planKey === 'team_start'
}
