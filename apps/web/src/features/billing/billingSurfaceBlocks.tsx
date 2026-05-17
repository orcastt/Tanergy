'use client'

import type { ReactNode } from 'react'
import { formatDateOnly, formatPeriodRange } from './billingPresentation'

export function BillingSectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode
  description?: ReactNode
  title: string
}) {
  return (
    <div className="workspace-commerce-section-head">
      <div className="workspace-commerce-section-copy">
        <h2>{title}</h2>
        {description ? <p className="workspace-commerce-section-note">{description}</p> : null}
      </div>
      {action ? <div className="workspace-commerce-section-action">{action}</div> : null}
    </div>
  )
}

export function BillingBand({
  actions,
  badge,
  children,
  eyebrow,
  title,
  tone,
}: {
  actions?: ReactNode
  badge?: ReactNode
  children: ReactNode
  eyebrow: string
  title: string
  tone?: 'group' | 'muted' | 'team'
}) {
  return (
    <article className={`workspace-commerce-band${tone ? ` is-${tone}` : ''}`}>
      <div className="workspace-commerce-band-head">
        <div className="workspace-commerce-band-copy">
          <span className="workspace-commerce-card-eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        {badge ? <div className="workspace-commerce-band-badge">{badge}</div> : null}
      </div>
      <div className="workspace-commerce-band-body">{children}</div>
      {actions ? <div className="workspace-commerce-band-actions">{actions}</div> : null}
    </article>
  )
}

export function BillingStatusPill({ children }: { children: ReactNode }) {
  return <span className="workspace-commerce-plan-badge">{children}</span>
}

export function BillingFactGrid({
  children,
  columns = 4,
}: {
  children: ReactNode
  columns?: 2 | 3 | 4
}) {
  return <div className={`workspace-commerce-fact-grid columns-${columns}`}>{children}</div>
}

export function BillingFact({
  hint,
  label,
  value,
}: {
  hint?: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="workspace-commerce-fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}

export function BillingPeriodFacts({
  currentPeriodEnd,
  currentPeriodStart,
  nextRefreshAt,
}: {
  currentPeriodEnd?: null | string
  currentPeriodStart?: null | string
  nextRefreshAt?: null | string
}) {
  return (
    <BillingFactGrid columns={3}>
      <BillingFact label="Current period" value={formatPeriodRange(currentPeriodStart, currentPeriodEnd)} />
      <BillingFact label="Valid until" value={formatDateOnly(currentPeriodEnd)} />
      <BillingFact label="Next refresh" value={formatDateOnly(nextRefreshAt)} />
    </BillingFactGrid>
  )
}

export function BillingProgress({
  remaining,
  total,
}: {
  remaining: number
  total: number
}) {
  const width = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0
  return (
    <div className="workspace-commerce-progress" aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </div>
  )
}

export function BillingEmptyState({
  message,
}: {
  message: string
}) {
  return <div className="workspace-commerce-empty-card">{message}</div>
}

export function BillingInlineList({
  items,
}: {
  items: ReactNode[]
}) {
  return (
    <div className="workspace-commerce-inline-list">
      {items.map((item, index) => (
        <span key={index}>{item}</span>
      ))}
    </div>
  )
}
