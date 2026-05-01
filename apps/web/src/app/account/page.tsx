import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'

export default function AccountPage() {
  const session = getCurrentSessionSnapshot()

  return (
    <AppShell>
      <div className="product-page">
        <section className="product-page-header">
          <p className="product-kicker">Account shell</p>
          <h1 className="product-page-title">A mock profile with the right future seams.</h1>
          <p className="product-section-copy">
            Account data is static in local development. The page exists now so registration,
            email verification, workspace ownership and protected routes have a visible home.
          </p>
        </section>

        <section className="product-grid" aria-label="Account details">
          <article className="product-demo-card peach">
            <h2>{session.user.displayName}</h2>
            <p>{session.user.email}</p>
          </article>
          <article className="product-demo-card mint">
            <h2>Email status</h2>
            <p>{session.user.emailVerified ? 'Verified' : 'Pending real provider setup'}</p>
          </article>
          <article className="product-demo-card cream">
            <h2>Workspace</h2>
            <p>{session.activeWorkspace.name}</p>
          </article>
        </section>

        <section className="product-signature">
          <div>
            <h2>Verification is designed, not wired.</h2>
            <p>
              The interface is ready for Email OTP or magic link, but delivery waits for
              sender domain setup, SPF, DKIM and DMARC.
            </p>
          </div>
          <Link className="product-button product-button-secondary" href="/verify-email">
            Preview verification
          </Link>
        </section>
      </div>
    </AppShell>
  )
}
