import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'

const subscriptionRows = [
  { label: 'Subscription provider', value: 'Stripe not connected' },
  { label: 'Credit ledger', value: 'Planned after Auth and AiRun persistence' },
  { label: 'AI cost guard', value: 'Server-side budget switch planned before real providers' },
]

export default function BillingPage() {
  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Subscription</p>
          <h1 className="product-page-title">Plan and usage shell, without fake payment state.</h1>
          <p className="product-section-copy">
            Subscription is intentionally separated from Settings. This page reserves the commercial
            surface while P0 focuses on Board persistence, Auth, AI Run logging and cost controls.
          </p>
        </section>

        <section className="management-summary-grid" aria-label="Subscription summary">
          <article className="management-callout cream">
            <span>Current plan</span>
            <h2>Development</h2>
            <p>No paid workspace, invoices or subscription state exists in local development.</p>
          </article>
          <article className="management-callout mint">
            <span>Usage</span>
            <h2>Mock only</h2>
            <p>Real usage requires persisted AiRun rows, provider costs and workspace credits.</p>
          </article>
          <article className="management-callout">
            <span>Payments</span>
            <h2>Not wired</h2>
            <p>Stripe Checkout and webhooks are P1 after the P0 creative loop is stable.</p>
          </article>
        </section>

        <section className="management-section-grid" aria-label="Subscription details">
          <article className="management-panel management-panel-wide">
            <h2>Commercial boundary</h2>
            <dl className="management-definition-list">
              {subscriptionRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="management-panel is-warning">
            <h2>Upgrade action</h2>
            <p>
              Upgrade buttons are visible as route semantics only. They must stay disabled until
              Stripe products, credit rules and webhook verification are implemented.
            </p>
            <button className="product-button product-button-secondary" disabled type="button">
              Upgrade unavailable
            </button>
          </article>
        </section>

        <section className="management-notice">
          <div>
            <h2>Keep shipping the P0 creative loop first.</h2>
            <p>
              The subscription page is ready to receive real plan data later, but the next valuable
              engineering work is Auth, staging resources and real AI provider logging.
            </p>
          </div>
          <Link className="product-button product-button-primary" href="/settings">Review settings</Link>
        </section>
      </div>
    </AppShell>
  )
}
