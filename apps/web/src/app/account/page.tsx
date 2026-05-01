import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'
import { getCurrentSessionSnapshot } from '@/features/auth/mockSession'

export default function AccountPage() {
  const session = getCurrentSessionSnapshot()
  const profileRows = [
    { label: 'User ID', value: session.user.id },
    { label: 'Email', value: session.user.email },
    { label: 'Auth mode', value: session.authMode === 'dev' ? 'Development fallback' : 'Required session' },
    { label: 'Active workspace', value: session.activeWorkspace.name },
  ]

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Account</p>
          <h1 className="product-page-title">Personal profile and session boundary.</h1>
          <p className="product-section-copy">
            This page is a clean account center for the current mock session. It shows the
            future Auth seams without pretending that email delivery, OAuth or logout sessions
            are already live.
          </p>
        </section>

        <section className="management-summary-grid" aria-label="Account summary">
          <article className="management-profile-card">
            <div className="management-avatar" aria-hidden="true">{session.user.avatarInitials}</div>
            <div>
              <h2>{session.user.displayName}</h2>
              <p>{session.user.email}</p>
            </div>
          </article>
          <article className="management-callout mint">
            <h2>Email status</h2>
            <p>{session.user.emailVerified ? 'Verified' : 'Waiting for real email provider setup.'}</p>
            <Link className="product-text-link" href="/verify-email">Preview verification</Link>
          </article>
          <article className="management-callout cream">
            <h2>Workspace ownership</h2>
            <p>{session.activeWorkspace.role} of {session.activeWorkspace.name}</p>
            <Link className="product-text-link" href="/workspaces">Open workspace</Link>
          </article>
        </section>

        <section className="management-section-grid" aria-label="Account management">
          <article className="management-panel management-panel-wide">
            <h2>Profile snapshot</h2>
            <dl className="management-definition-list">
              {profileRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="management-panel">
            <h2>Session guard</h2>
            <p>
              Local development uses explicit request-context headers. Production must replace
              this with a server-issued session or JWT before public users arrive.
            </p>
            <div className="management-badge-row">
              <span>Dev fallback</span>
              <span>Protected route shape</span>
            </div>
          </article>

          <article className="management-panel is-warning">
            <h2>Danger zone</h2>
            <p>
              Account deletion and data export are real backend workflows. They stay disabled
              until user records, workspace ownership and object cleanup are connected.
            </p>
            <button className="product-button product-button-secondary" disabled type="button">
              Delete account unavailable
            </button>
          </article>
        </section>
      </div>
    </AppShell>
  )
}
