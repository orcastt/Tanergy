'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'

export function AuthEmailVerificationPanel() {
  const { isLoaded, user } = useUser()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const primaryEmail = user?.primaryEmailAddress ?? null
  const emailAddress = primaryEmail?.emailAddress ?? null
  const verificationStatus = primaryEmail?.verification.status ?? null
  const isVerified = verificationStatus === 'verified'

  async function resendVerification() {
    if (!primaryEmail || isVerified) return
    setSending(true)
    setError(null)
    setMessage(null)
    try {
      await primaryEmail.prepareVerification({
        redirectUrl: `${window.location.origin}/account`,
        strategy: 'email_link',
      })
      setMessage('Verification email sent. Open the link from your inbox to finish verification.')
    } catch (nextError) {
      setError(readClerkError(nextError, 'We could not resend the verification email.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <article className="management-callout mint">
      <span>Email verification</span>
      <h2>{!emailAddress ? 'No email on file' : isVerified ? 'Verified' : 'Pending'}</h2>
      <p>
        {!isLoaded
          ? 'Loading email verification state.'
          : !emailAddress
            ? 'This account does not currently expose an email credential for verification.'
            : isVerified
              ? `${emailAddress} is verified through Clerk.`
              : `${emailAddress} still needs verification before the account is fully settled.`}
      </p>
      {!isVerified && emailAddress ? (
        <button
          className="product-button product-button-secondary"
          disabled={sending}
          onClick={() => void resendVerification()}
          type="button"
        >
          {sending ? 'Sending verification...' : 'Resend verification'}
        </button>
      ) : null}
      {error ? <p className="auth-profile-status is-error" role="alert">{error}</p> : null}
      {!error && message ? <p className="auth-profile-status" role="status">{message}</p> : null}
    </article>
  )
}

function readClerkError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'object' && error !== null) {
    const maybeErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors
    if (Array.isArray(maybeErrors)) {
      const first = maybeErrors.find((item) => item?.longMessage || item?.message)
      if (first?.longMessage) return first.longMessage
      if (first?.message) return first.message
    }
  }
  return fallback
}
