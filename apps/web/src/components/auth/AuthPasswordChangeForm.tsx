'use client'

import { useState, type FormEvent } from 'react'
import { useUser } from '@clerk/nextjs'

export function AuthPasswordChangeForm() {
  const { isLoaded, user } = useUser()
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      setError('You need to be signed in to change the password.')
      return
    }
    if (newPassword.length < 8) {
      setError('Use at least 8 characters for the new password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new password fields need to match.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await user.updatePassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword,
        signOutOfOtherSessions: false,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password updated.')
    } catch (nextError) {
      setError(readClerkError(nextError, 'We could not update the password.'))
    } finally {
      setSaving(false)
    }
  }

  if (!isLoaded) {
    return <p className="auth-profile-note">Loading password settings…</p>
  }

  if (!user) {
    return <p className="auth-profile-note">Sign in to update the password from this page.</p>
  }

  if (!user.passwordEnabled) {
    return (
      <div className="management-stack">
        <p className="auth-profile-note">
          This account is currently using social sign-in only. Pure Google or Microsoft accounts may
          not have a local password to change until an email/password credential is added in Clerk.
        </p>
      </div>
    )
  }

  return (
    <form className="auth-profile-form" onSubmit={submit}>
      <label className="auth-profile-field">
        <span className="management-field-label">Current password</span>
        <input
          autoComplete="current-password"
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="Current password"
          style={fieldControlStyle}
          type="password"
          value={currentPassword}
        />
      </label>

      <label className="auth-profile-field">
        <span className="management-field-label">New password</span>
        <input
          autoComplete="new-password"
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="At least 8 characters"
          style={fieldControlStyle}
          type="password"
          value={newPassword}
        />
      </label>

      <label className="auth-profile-field">
        <span className="management-field-label">Confirm new password</span>
        <input
          autoComplete="new-password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat the new password"
          style={fieldControlStyle}
          type="password"
          value={confirmPassword}
        />
      </label>

      <p className="auth-profile-note">
        Signed-out recovery still uses the Clerk email flow. Social-only accounts may not expose a password to change here until a password credential exists.
      </p>
      {error ? <p className="auth-profile-status is-error" role="alert">{error}</p> : null}
      {!error && message ? <p className="auth-profile-status" role="status">{message}</p> : null}

      <div className="management-actions is-start">
        <button
          className="product-button product-button-primary"
          disabled={saving || !newPassword || !confirmPassword}
          type="submit"
        >
          {saving ? 'Updating password...' : 'Update password'}
        </button>
      </div>
    </form>
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

const fieldControlStyle = {
  width: '100%',
  minHeight: 40,
  border: '1px solid var(--color-hairline)',
  borderRadius: '12px',
  padding: '0 12px',
  background: 'var(--color-canvas)',
}
