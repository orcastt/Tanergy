'use client'

import Link from 'next/link'
import { AppShell } from '@/components/app-shell/AppShell'
import { AuthAccountDeletionPanel } from '@/components/auth/AuthAccountDeletionPanel'
import { AuthEmailVerificationPanel } from '@/components/auth/AuthEmailVerificationPanel'
import { AuthPasswordChangeForm } from '@/components/auth/AuthPasswordChangeForm'
import { AuthProfileForm } from '@/components/auth/AuthProfileForm'
import { AuthSignInMethodsPanel } from '@/components/auth/AuthSignInMethodsPanel'
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
    { label: 'Display name', value: session.user.displayName },
    { label: 'Email', value: visibleEmail ?? 'Provided by your sign-in provider' },
    { label: 'Auth mode', value: session.authMode === 'dev' ? 'Development fallback' : 'Required session' },
    { label: 'Active workspace', value: session.activeWorkspace.name },
  ]

  return (
    <AppShell>
      <div className="product-page management-page">
        <section className="product-page-header">
          <p className="product-kicker">Account</p>
          <h1 className="product-page-title">Profile, security, and the line between Tanergy and Clerk.</h1>
          <p className="product-section-copy">
            Email identity, verification and password recovery stay in Clerk. Tanergy stores the
            profile fields that appear inside boards, workspaces and future product features.
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
          <AuthEmailVerificationPanel />
          <article className="management-callout cream">
            <h2>Profile status</h2>
            <p>{session.user.profileCompleted ? 'Profile completed and editable here.' : 'Onboarding still needs a saved profile.'}</p>
            <Link className="product-text-link" href="/workspaces">Open workspace</Link>
          </article>
        </section>

        <section className="management-section-grid" aria-label="Account management">
          <article className="management-panel management-panel-wide">
            <div className="management-panel-heading">
              <div>
                <h2>Profile settings</h2>
                <p className="management-panel-copy">
                  This is the Tanergy-owned layer. Updating it changes the name and profile state
                  the product uses across workspaces, board history and future billing surfaces.
                </p>
              </div>
            </div>
            <AuthProfileForm
              key={session.user.displayName}
              initialDisplayName={session.user.displayName}
              submitLabel="Save profile changes"
            />
          </article>

          <article className="management-panel">
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
            <h2>Security and recovery</h2>
            <p>
              Passwords, password reset, email verification and social sign-in stay with Clerk. Tanergy
              reads the verified identity and keeps product profile fields in our own database.
            </p>
            <div className="management-stack">
              <AuthPasswordChangeForm />
            </div>
            <p className="management-inline-note">
              Social-first Google or Microsoft accounts may not expose a password yet. In that case,
              password change is unavailable until a local email/password credential exists in Clerk.
            </p>
            <p className="management-inline-note">
              Use <Link className="product-text-link" href="/forgot-password">Forgot password</Link> only when you are signed out and need email recovery.
            </p>
          </article>

          <AuthSignInMethodsPanel />

          <article className="management-panel">
            <h2>Ownership boundary</h2>
            <dl className="management-definition-list">
              <div>
                <dt>Clerk owns</dt>
                <dd>Authentication, email verification, password reset, provider subject identity.</dd>
              </div>
              <div>
                <dt>Tanergy owns</dt>
                <dd>Display name, onboarding completion state, workspace-facing profile data.</dd>
              </div>
            </dl>
          </article>

          <article className="management-panel is-warning">
            <h2>Danger zone</h2>
            <p>
              Account deletion is now live for personal accounts. If this user still owns a Team or Group
              workspace, transfer or remove that workspace first and then try again.
            </p>
            <AuthAccountDeletionPanel />
          </article>
        </section>
      </div>
    </AppShell>
  )
}
