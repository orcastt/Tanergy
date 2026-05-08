import Link from 'next/link'

type BillingCheckoutReturnViewProps = {
  kind: 'cancel' | 'success'
}

export function BillingCheckoutReturnView({ kind }: BillingCheckoutReturnViewProps) {
  const isSuccess = kind === 'success'
  return (
    <div className="product-page workspace-commerce-page">
      <section className="product-page-header workspace-commerce-header">
        <div className="workspace-commerce-header-copy">
          <h1 className="product-page-title">{isSuccess ? 'Checkout received' : 'Checkout canceled'}</h1>
          <p className="workspace-commerce-status">
            {isSuccess
              ? 'We are waiting for the payment webhook to update your wallet and subscription.'
              : 'No wallet or subscription change was applied.'}
          </p>
        </div>
      </section>

      <section className="workspace-commerce-summary-grid" aria-label="Checkout next steps">
        <ReturnCard href="/billing" label="Subscription" value="Plans" />
        <ReturnCard href="/usage" label="Usage" value="Wallets" />
        <ReturnCard href="/team" label="Teams" value="Team workspaces" />
        <ReturnCard href="/group" label="Groups" value="Collaborate" />
      </section>
    </div>
  )
}

function ReturnCard({
  href,
  label,
  value,
}: {
  href: string
  label: string
  value: string
}) {
  return (
    <Link className="workspace-commerce-summary-card workspace-commerce-return-card" href={href}>
      <span className="workspace-commerce-summary-label">{label}</span>
      <strong className="workspace-commerce-summary-value">{value}</strong>
      <span className="workspace-commerce-summary-meta">Open</span>
    </Link>
  )
}
