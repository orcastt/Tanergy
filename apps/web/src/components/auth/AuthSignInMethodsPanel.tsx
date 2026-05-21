'use client'

import { useMemo } from 'react'
import { useUser } from '@clerk/nextjs'

type MethodStatusTone = 'default' | 'success'

type MethodRow = {
  detail: string
  label: string
  status: string
  tone: MethodStatusTone
}

export function AuthSignInMethodsPanel() {
  const { isLoaded, user } = useUser()

  const methodRows = useMemo<MethodRow[]>(() => {
    if (!user) {
      return [
        { detail: 'Sign in to inspect connected login methods.', label: 'Google', status: 'Unavailable', tone: 'default' },
        { detail: 'Sign in to inspect connected login methods.', label: 'Microsoft', status: 'Unavailable', tone: 'default' },
        { detail: 'Sign in to inspect connected login methods.', label: 'Email', status: 'Unavailable', tone: 'default' },
      ]
    }

    const googleAccount = user.externalAccounts.find((account) => account.provider === 'google')
    const microsoftAccount = user.externalAccounts.find((account) => account.provider === 'microsoft')
    const primaryEmail = user.primaryEmailAddress
    const emailVerificationStatus = primaryEmail?.verification.status

    return [
      buildConnectedAccountRow('Google', googleAccount?.emailAddress ?? googleAccount?.accountIdentifier?.()),
      buildConnectedAccountRow('Microsoft', microsoftAccount?.emailAddress ?? microsoftAccount?.accountIdentifier?.()),
      {
        detail: primaryEmail?.emailAddress ?? 'No email credential is attached to this account yet.',
        label: 'Email',
        status: !primaryEmail
          ? 'Not enabled'
          : emailVerificationStatus === 'verified'
            ? 'Verified'
            : 'Pending verification',
        tone: emailVerificationStatus === 'verified' ? 'success' : 'default',
      },
    ]
  }, [user])

  return (
    <article className="management-panel">
      <h2>Sign-in methods</h2>
      <p>
        This shows which login methods are currently attached to the signed-in account.
      </p>
      {!isLoaded ? <p className="auth-profile-note">Loading connected login methods…</p> : null}
      <div className="management-method-list" role="list">
        {methodRows.map((row) => (
          <div className="management-method-row" key={row.label} role="listitem">
            <div>
              <span className="management-field-label">{row.label}</span>
              <p className="management-method-detail">{row.detail}</p>
            </div>
            <span className={`management-status-pill${row.tone === 'success' ? ' is-success' : ''}`}>
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}

function buildConnectedAccountRow(label: string, identifier?: string) {
  if (!identifier) {
    return {
      detail: `${label} is not connected to this account.`,
      label,
      status: 'Not connected',
      tone: 'default' as const,
    }
  }
  return {
    detail: identifier,
    label,
    status: 'Connected',
    tone: 'success' as const,
  }
}
