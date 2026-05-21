'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { SignOutButton, useAuth, useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

type ForgotPasswordStep = 'request' | 'verify' | 'reset' | 'success'

export function ForgotPasswordFlow() {
  const { isLoaded, isSignedIn } = useAuth()
  const { fetchStatus, signIn } = useSignIn()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [step, setStep] = useState<ForgotPasswordStep>('request')
  const [submitting, setSubmitting] = useState(false)

  const heading = useMemo(() => {
    if (step === 'success') return 'Password reset complete.'
    if (step === 'reset') return 'Enter the code and your new password.'
    if (step === 'verify') return 'Verify the recovery code from your email.'
    return 'Reset your Tanergy password.'
  }, [step])

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) {
      setError('Enter the email address on your account.')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const created = await signIn.create({
        identifier: email.trim(),
      })
      if (created.error) throw created.error
      const sent = await signIn.resetPasswordEmailCode.sendCode()
      if (sent.error) throw sent.error
      setStep('verify')
      setMessage('A verification code has been sent. Enter it below to keep going.')
    } catch (nextError) {
      setError(readClerkError(nextError, 'We could not start the password reset flow.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!code.trim()) {
      setError('Enter the verification code from your email.')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const verified = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() })
      if (verified.error) throw verified.error
      setStep('reset')
      setMessage('Code verified. You can set a new password now.')
    } catch (nextError) {
      setError(readClerkError(nextError, 'We could not verify that recovery code.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword.length < 8) {
      setError('Use at least 8 characters for the new password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new password fields need to match.')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const completed = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
      })
      if (completed.error) throw completed.error
      if (signIn.status === 'complete') {
        const finalized = await signIn.finalize({
          navigate: async ({ session, decorateUrl }) => {
            if (session?.currentTask) return
            const url = decorateUrl('/workspaces')
            if (url.startsWith('http')) {
              window.location.href = url
              return
            }
            router.push(url)
          },
        })
        if (finalized.error) throw finalized.error
        setStep('success')
        setMessage('Your password has been updated. Redirecting you into the app.')
        return
      }
      if (signIn.status === 'needs_second_factor') {
        throw new Error('This account needs two-factor verification before the reset can finish.')
      }
      throw new Error('Password reset did not finish cleanly. Please try signing in again.')
    } catch (nextError) {
      setError(readClerkError(nextError, 'We could not update the password.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function resendCode() {
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const sent = await signIn.resetPasswordEmailCode.sendCode()
      if (sent.error) throw sent.error
      setMessage('A fresh verification code has been sent.')
    } catch (nextError) {
      setError(readClerkError(nextError, 'We could not resend the verification code.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoaded && isSignedIn) {
    return (
      <main className="tanergy-auth tanergy-auth-mint">
        <section className="tanergy-auth-panel" aria-label="Tanergy account context">
          <Link className="tanergy-auth-brand" href="/">
            Tanergy
          </Link>
          <div className="tanergy-auth-art" aria-hidden="true">
            <div className="tanergy-auth-art-card large">
              <span>Security</span>
              <strong>Signed-in password changes live in Clerk account security, not the recovery flow.</strong>
            </div>
            <div className="tanergy-auth-art-row">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="tanergy-auth-copy">
            <h1>You are already signed in.</h1>
            <p>Open account security to change the current password, or sign out first if you want the email recovery flow.</p>
          </div>
        </section>

        <section className="tanergy-auth-form-area">
          <Link className="tanergy-auth-mobile-brand" href="/">
            Tanergy
          </Link>
          <div className="tanergy-auth-heading">
            <h2>Use account security instead.</h2>
            <p>Recovery codes are for signed-out access recovery. While you are in the product, change password from the Clerk-managed security page.</p>
          </div>

          <div className="tanergy-clerk-status tanergy-reset-card">
            <p>Open the security page to update the password on this account.</p>
            <div className="tanergy-auth-support-row">
              <Link className="product-button product-button-primary" href="/account">
                Open account security
              </Link>
              <SignOutButton redirectUrl="/forgot-password">
                <button className="product-button product-button-secondary" type="button">
                  Sign out and use recovery email
                </button>
              </SignOutButton>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="tanergy-auth tanergy-auth-mint">
      <section className="tanergy-auth-panel" aria-label="Tanergy account context">
        <Link className="tanergy-auth-brand" href="/">
          Tanergy
        </Link>
        <div className="tanergy-auth-art" aria-hidden="true">
          <div className="tanergy-auth-art-card large">
            <span>Security</span>
            <strong>Clerk handles password reset. Tanergy keeps the recovery path visible.</strong>
          </div>
          <div className="tanergy-auth-art-row">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="tanergy-auth-copy">
          <h1>Regain access without the maze.</h1>
          <p>Reset flows stay with Clerk. Your product profile and boards stay on the Tanergy side.</p>
        </div>
      </section>

      <section className="tanergy-auth-form-area">
        <Link className="tanergy-auth-mobile-brand" href="/">
          Tanergy
        </Link>
        <div className="tanergy-auth-heading">
          <h2>{heading}</h2>
          <p>
            {step === 'success'
              ? 'Your account is ready for sign-in again.'
              : step === 'reset'
                ? 'Choose a new password now that the recovery code is verified.'
                : step === 'verify'
                  ? 'Enter the code from your inbox so Clerk can unlock password change.'
                : 'Enter the account email and we will send a recovery code.'}
          </p>
        </div>

        <div className="tanergy-clerk-status tanergy-reset-card">
          {fetchStatus === 'fetching' ? <p>Loading password reset…</p> : null}
          {step === 'request' ? (
            <form className="tanergy-reset-form" onSubmit={requestReset}>
              <label className="auth-profile-field">
                <span className="management-field-label">Email address</span>
                <input
                  autoComplete="email"
                  className="tanergy-reset-input"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  type="email"
                  value={email}
                />
              </label>
              <button className="product-button product-button-primary" disabled={submitting || !email.trim()} type="submit">
                {submitting ? 'Sending code...' : 'Send recovery code'}
              </button>
            </form>
          ) : null}

          {step === 'verify' ? (
            <form className="tanergy-reset-form" onSubmit={verifyCode}>
              <label className="auth-profile-field">
                <span className="management-field-label">Verification code</span>
                <input
                  className="tanergy-reset-input"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456"
                  value={code}
                />
              </label>

              <div className="tanergy-auth-support-row">
                <button className="product-button product-button-primary" disabled={submitting || !code.trim()} type="submit">
                  {submitting ? 'Verifying code...' : 'Verify code'}
                </button>
                <button className="product-button product-button-secondary" disabled={submitting} onClick={() => void resendCode()} type="button">
                  Resend code
                </button>
              </div>

              <button
                className="tanergy-auth-support-link is-button"
                disabled={submitting}
                onClick={() => {
                  setCode('')
                  setError(null)
                  setMessage(null)
                  setStep('request')
                }}
                type="button"
              >
                Use another email
              </button>
            </form>
          ) : null}

          {step === 'reset' ? (
            <form className="tanergy-reset-form" onSubmit={submitNewPassword}>
              <label className="auth-profile-field">
                <span className="management-field-label">New password</span>
                <input
                  autoComplete="new-password"
                  className="tanergy-reset-input"
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  type="password"
                  value={newPassword}
                />
              </label>

              <label className="auth-profile-field">
                <span className="management-field-label">Confirm password</span>
                <input
                  autoComplete="new-password"
                  className="tanergy-reset-input"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat the new password"
                  type="password"
                  value={confirmPassword}
                />
              </label>

              <div className="tanergy-auth-support-row">
                <button className="product-button product-button-primary" disabled={submitting} type="submit">
                  {submitting ? 'Resetting password...' : 'Update password'}
                </button>
              </div>
            </form>
          ) : null}

          {step === 'success' ? (
            <div className="tanergy-reset-success">
              <p>{message}</p>
              <Link className="product-button product-button-primary" href="/sign-in">
                Return to sign in
              </Link>
            </div>
          ) : null}

          {step !== 'success' && error ? <p className="auth-profile-status is-error" role="alert">{error}</p> : null}
          {step !== 'success' && !error && message ? <p className="auth-profile-status" role="status">{message}</p> : null}
        </div>

        <div className="tanergy-auth-support-row">
          <Link className="tanergy-auth-support-link" href="/sign-in">
            Back to sign in
          </Link>
          <Link className="tanergy-auth-support-link" href="/sign-up">
            Create account
          </Link>
        </div>
      </section>
    </main>
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
