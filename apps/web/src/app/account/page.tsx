'use client'

import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'
import { useTangentSession } from '@/features/auth/useTangentSession'
import { getPublicUserEmail, getPublicUserInitials, getPublicUserLabel } from '@/features/shared/publicUserDisplay'

export default function AccountPage() {
  const { error, session, status } = useTangentSession()
  const visibleEmail = getPublicUserEmail(session.user.email)
  const visibleName = getPublicUserLabel({
    displayName: session.user.displayName,
    email: session.user.email,
    fallback: 'You',
    userId: session.user.id,
  })
  const visibleInitials = getPublicUserInitials({
    displayName: session.user.displayName,
    email: session.user.email,
    fallback: 'You',
    userId: session.user.id,
  })
  const profileRows = [
    { label: 'Email', value: visibleEmail ?? 'Provided by your sign-in provider' },
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
            This page now reads the live web session contract, so profile, workspace, and auth mode
            stay aligned with the backend instead of falling back to mock account data.
          </p>
          {status === 'loading' ? <p className="workspace-detail-status">Loading live account session…</p> : null}
          {status === 'error' ? <p className="workspace-detail-status">{error ?? 'Session lookup failed.'}</p> : null}
        </section>

        <section className="management-summary-grid" aria-label="Account summary">
          <article className="management-profile-card">
            <div className="management-avatar" aria-hidden="true">{visibleInitials}</div>
            <div>
              <h2>{visibleName}</h2>
              <p>{visibleEmail ?? 'Signed in with your connected account'}</p>
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
