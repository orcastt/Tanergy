import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'

export default function HomePage() {
  const session = getCurrentSessionSnapshot()

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Home</p>
          <h1 className="product-page-title">Start from the active workspace.</h1>
          <p className="product-section-copy">
            Home is the quiet app landing surface for the current local session. It points back
            to the Board workspace while real onboarding, recents and account setup wait for Auth.
          </p>
        </section>

        <section className="management-summary-grid" aria-label="Home summary">
          <article className="management-callout mint">
            <span>Workspace</span>
            <h2>{session.activeWorkspace.name}</h2>
            <p>{session.activeWorkspace.boardCount} saved board in the mock workspace.</p>
            <Link className="product-text-link" href="/workspaces">Open workspace</Link>
          </article>
          <article className="management-callout cream">
            <span>Collection</span>
            <h2>Coming together</h2>
            <p>Reusable assets and saved references will live in Collection later.</p>
            <Link className="product-text-link" href="/collections">View collection shell</Link>
          </article>
          <article className="management-callout">
            <span>Session</span>
            <h2>{session.user.displayName}</h2>
            <p>Using the development fallback account until real Auth is wired.</p>
            <Link className="product-text-link" href="/account">Open account</Link>
          </article>
        </section>

        <section className="management-notice">
          <div>
            <h2>The Board workspace is still the main P0 surface.</h2>
            <p>
              Use Home as an orientation page, then continue into Workspace for real Board
              gallery/list actions.
            </p>
          </div>
          <Link className="product-button product-button-primary" href="/workspaces">Go to workspace</Link>
        </section>
      </div>
    </AppShell>
  )
}
