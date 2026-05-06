'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/app-shell/AppShell'
import { loadBillingMe } from '@/features/billing/billingClient'
import type { BillingMeResponse } from '@/features/billing/billingTypes'

type LoadState = 'error' | 'loading' | 'ready'

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingMeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<LoadState>('loading')

  useEffect(() => {
    let isCancelled = false
    loadBillingMe()
      .then((payload) => {
        if (isCancelled) return
        setBilling(payload)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (isCancelled) return
        setError(nextError instanceof Error ? nextError.message : 'Billing lookup failed.')
        setStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [])

  const usagePercent = useMemo(() => {
    if (!billing?.credits.includedTotal) return 0
    return Math.min(100, Math.round((billing.credits.usedThisCycle / billing.credits.includedTotal) * 100))
  }, [billing])

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Billing</p>
          <h1 className="product-page-title">Plan and AI credits</h1>
        </section>

        {status === 'error' ? (
          <section className="management-notice" role="status">
            <div>
              <h2>Billing contract unavailable</h2>
              <p>{error}</p>
            </div>
          </section>
        ) : null}

        {billing ? (
          <>
            <section className="management-summary-grid" aria-label="Billing summary">
              <article className="management-callout mint">
                <span>Current plan</span>
                <h2>{billing.plan.name}</h2>
                <p>{formatPrice(billing.plan.monthlyPriceUsd)} · {billing.plan.seatRange ?? 'single user'}</p>
              </article>
              <article className="management-callout cream">
                <span>Included credits</span>
                <h2>{formatCredits(billing.credits.includedTotal)}</h2>
                <p>{formatCredits(billing.credits.includedRemaining)} remaining this cycle</p>
              </article>
              <article className="management-callout">
                <span>AI run payer</span>
                <h2>{billing.chargeScope === 'workspace_pool' ? 'Workspace' : 'You'}</h2>
                <p>{billing.payerLabel}</p>
              </article>
            </section>

            <section className="management-section-grid" aria-label="Billing details">
              <article className="management-panel">
                <div className="management-panel-heading">
                  <div>
                    <h2>Credit usage</h2>
                    <p>{formatCredits(billing.credits.usedThisCycle)} used this cycle</p>
                  </div>
                  <span className="management-badge">{usagePercent}%</span>
                </div>
                <div className="management-progress" aria-label="Included credit usage">
                  <span style={{ width: `${usagePercent}%` }} />
                </div>
                <dl className="management-definition-list">
                  <div>
                    <dt>Top-up balance</dt>
                    <dd>{formatCredits(billing.credits.topUpBalance)}</dd>
                  </div>
                  <div>
                    <dt>Billing period</dt>
                    <dd>{formatLabel(billing.plan.billingPeriod)}</dd>
                  </div>
                </dl>
              </article>

              <article className="management-panel">
                <h2>Workspace context</h2>
                <dl className="management-definition-list">
                  <div>
                    <dt>Workspace</dt>
                    <dd>{billing.workspace.name}</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{formatLabel(billing.workspace.kind)}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{formatLabel(billing.workspace.role)}</dd>
                  </div>
                </dl>
              </article>
            </section>
          </>
        ) : status === 'loading' ? (
          <section className="management-panel management-panel-wide" role="status">
            <h2>Loading billing contract</h2>
          </section>
        ) : null}
      </div>
    </AppShell>
  )
}

function formatCredits(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatPrice(value?: null | number) {
  if (value === null || value === undefined) return 'Custom'
  if (value === 0) return '$0'
  return `$${value}/month`
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ')
}
