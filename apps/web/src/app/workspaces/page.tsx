import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'
import { mockSession } from '@/features/auth/mockSession'

export default function WorkspacesPage() {
  return (
    <AppShell>
      <div className="product-page">
        <section className="product-hero-band">
          <p className="product-kicker">Workspace shell</p>
          <h1>One personal workspace, ready for real ownership later.</h1>
          <p className="product-hero-copy">
            The local shell keeps workspace behavior deliberately narrow: a single personal
            workspace that links into boards while the real Auth and membership tables wait
            for Postgres and email.
          </p>
          <div className="product-hero-actions">
            <Link className="product-button product-button-primary" href="/boards">
              Open boards
            </Link>
            <Link className="product-button product-button-secondary" href="/settings">
              Review settings
            </Link>
          </div>
        </section>

        <section className="product-signature">
          <div>
            <h2>{mockSession.activeWorkspace.name}</h2>
            <p>
              Mock owner workspace for local P0 testing. Future team roles and invites stay
              behind the Auth and workspace permission boundary.
            </p>
          </div>
          <div className="product-ui-fragment" aria-hidden="true">
            <div className="product-ui-row">
              <span className="product-ui-line" />
              <span className="product-ui-chip" />
            </div>
            <div className="product-ui-row">
              <span className="product-ui-line" />
              <span className="product-ui-chip" />
            </div>
            <div className="product-ui-row">
              <span className="product-ui-line" />
              <span className="product-ui-chip" />
            </div>
          </div>
        </section>

        <section className="product-grid" aria-label="Workspace status">
          <article className="product-card">
            <h2>Role</h2>
            <p>{mockSession.activeWorkspace.role}</p>
          </article>
          <article className="product-card">
            <h2>Boards</h2>
            <p>{mockSession.activeWorkspace.boardCount} local board contract connected.</p>
          </article>
          <article className="product-card">
            <h2>Next boundary</h2>
            <p>Real workspace membership starts after users, sessions and email verification.</p>
          </article>
        </section>
      </div>
    </AppShell>
  )
}
