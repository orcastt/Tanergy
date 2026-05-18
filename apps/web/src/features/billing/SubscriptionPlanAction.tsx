'use client'

import Link from 'next/link'
import type { BillingInterval, PlanKey } from './billingTypes'

type SubscriptionPlanActionProps = {
  activeCount: number
  billingInterval?: Extract<BillingInterval, 'annual' | 'monthly'>
  className: string
  href: string
  label: string
  planKey: PlanKey
}

export function SubscriptionPlanAction({
  activeCount,
  className,
  href,
  label,
  planKey,
}: SubscriptionPlanActionProps) {
  const shouldNavigate = activeCount > 0 || planKey === 'enterprise' || planKey === 'free_canvas'

  if (shouldNavigate) {
    return <Link className={className} href={href}>{label}</Link>
  }

  return (
    <div className="workspace-commerce-action-stack">
      <button className={className} disabled type="button">
        Admin setup only
      </button>
    </div>
  )
}
