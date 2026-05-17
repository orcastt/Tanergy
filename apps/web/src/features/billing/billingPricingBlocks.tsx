'use client'

import type { ReactNode } from 'react'

export function PricingBand({
  actions,
  badge,
  children,
  eyebrow,
  price,
  priceHint,
  title,
  tone,
}: {
  actions?: ReactNode
  badge?: ReactNode
  children: ReactNode
  eyebrow: string
  price: ReactNode
  priceHint?: ReactNode
  title: string
  tone?: 'group' | 'muted' | 'team'
}) {
  return (
    <article className={`workspace-pricing-band${tone ? ` is-${tone}` : ''}`}>
      <div className="workspace-pricing-band__hero">
        <div className="workspace-pricing-band__copy">
          <span className="workspace-commerce-card-eyebrow">{eyebrow}</span>
          <div className="workspace-pricing-band__title-row">
            <h3>{title}</h3>
            {badge ? <div className="workspace-pricing-band__badge">{badge}</div> : null}
          </div>
          <div className="workspace-pricing-band__price">
            <strong>{price}</strong>
            {priceHint ? <small>{priceHint}</small> : null}
          </div>
        </div>
        {actions ? <div className="workspace-pricing-band__actions">{actions}</div> : null}
      </div>
      <div className="workspace-pricing-band__body">{children}</div>
    </article>
  )
}

export function PricingMetricList({
  children,
  title,
}: {
  children: ReactNode
  title?: ReactNode
}) {
  return (
    <section className="workspace-pricing-metric-list">
      {title ? <strong className="workspace-pricing-metric-list__title">{title}</strong> : null}
      <div className="workspace-pricing-metric-list__grid">{children}</div>
    </section>
  )
}

export function PricingMetric({
  hint,
  label,
  value,
}: {
  hint?: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="workspace-pricing-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}

export function PricingTagList({
  items,
}: {
  items: ReactNode[]
}) {
  return (
    <div className="workspace-pricing-tag-list">
      {items.map((item, index) => (
        <span key={index}>{item}</span>
      ))}
    </div>
  )
}
