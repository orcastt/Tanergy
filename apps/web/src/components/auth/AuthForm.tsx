'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'verify-email'

type AuthFormProps = {
  mode: AuthMode
}

const copyByMode: Record<AuthMode, {
  title: string
  copy: string
  panelTitle: string
  panelCopy: string
  action: string
  alternate: string
  alternateHref: string
  alternateLabel: string
  surface: 'coral' | 'mint'
}> = {
  login: {
    title: 'Welcome back',
    copy: 'Log in to your workspace.',
    panelTitle: 'Quietly editorial.',
    panelCopy: 'A structured canvas for image work, prompt flow and focused creative decisions.',
    action: 'Sign in',
    alternate: 'Need an account?',
    alternateHref: '/signup',
    alternateLabel: 'Create an account',
    surface: 'coral',
  },
  signup: {
    title: 'Create account',
    copy: 'Begin structuring your creative workspace.',
    panelTitle: 'Crafting organized potential.',
    panelCopy: 'Set up the account layer before your boards, assets and AI runs become real workspace records.',
    action: 'Sign up',
    alternate: 'Already have an account?',
    alternateHref: '/login',
    alternateLabel: 'Log in',
    surface: 'mint',
  },
  'forgot-password': {
    title: 'Reset password',
    copy: "Enter your email and we'll prepare the recovery flow.",
    panelTitle: 'Regain access.',
    panelCopy: 'A narrow account surface keeps recovery calm, direct and easy to scan.',
    action: 'Send reset link',
    alternate: 'Remembered it?',
    alternateHref: '/login',
    alternateLabel: 'Back to log in',
    surface: 'mint',
  },
  'verify-email': {
    title: 'Verify email',
    copy: 'Enter the six digit code for this local account shell.',
    panelTitle: 'One clean handoff.',
    panelCopy: 'Email verification will connect the user, workspace and board permission boundary.',
    action: 'Verify email',
    alternate: 'Need a fresh account?',
    alternateHref: '/signup',
    alternateLabel: 'Sign up',
    surface: 'mint',
  },
}

export function AuthForm({ mode }: AuthFormProps) {
  const copy = copyByMode[mode]
  const [email, setEmail] = useState('dev@tangent.local')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const needsPassword = mode === 'login' || mode === 'signup'
  const needsCode = mode === 'verify-email'
  const helper = useMemo(() => {
    if (mode === 'signup') return 'Use 8 or more characters.'
    if (mode === 'verify-email') return 'Any 6 digit code is accepted locally.'
    if (mode === 'forgot-password') return 'Email delivery is staged for the real Auth provider.'
    return 'Local validation only until real sessions are connected.'
  }, [mode])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (!email.includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    if (needsPassword && password.length < 8) {
      setError('Password must be at least 8 characters for this local check.')
      return
    }
    if (needsCode && !/^\d{6}$/.test(code)) {
      setError('Enter a 6 digit verification code.')
      return
    }
    setMessage('Local mock accepted. Real Auth is still waiting for the backend session and email provider.')
  }

  return (
    <main className={`auth-split auth-split-${copy.surface}`}>
      <section className="auth-side-panel" aria-label="Tanergy account context">
        <Link className="auth-wordmark" href="/">
          Tanergy
        </Link>
        <div className="auth-side-copy">
          <h2>{copy.panelTitle}</h2>
          <p>{copy.panelCopy}</p>
        </div>
        <div className="auth-panel-preview" aria-hidden="true">
          <div className="auth-preview-card is-large">
            <span />
            <strong>Active board</strong>
            <p>Prompt chain, image assets and analysis ready.</p>
          </div>
          <div className="auth-preview-row">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      <section className="auth-canvas">
        <div className="auth-mobile-wordmark">Tanergy</div>
        <div className="auth-form-wrap">
          <header className="auth-header">
            <h1>{copy.title}</h1>
            <p>{copy.copy}</p>
          </header>

          <form className="auth-form-card" onSubmit={submit}>
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                type="email"
                value={email}
              />
            </label>

            {needsPassword ? (
              <label>
                <span>Password</span>
                <span className="auth-password-field">
                  <input
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Min. 8 characters"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="auth-field-action"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
              </label>
            ) : null}

            {needsCode ? (
              <label>
                <span>Verification code</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456"
                  value={code}
                />
              </label>
            ) : null}

            {mode === 'login' ? (
              <div className="auth-form-row">
                <label className="auth-checkbox-label">
                  <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
                  <span>Remember me</span>
                </label>
                <Link className="auth-inline-link" href="/forgot-password">
                  Forgot password?
                </Link>
              </div>
            ) : null}

            <p className="auth-helper">{helper}</p>
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            {message ? <p className="auth-success" role="status">{message}</p> : null}

            <button className="product-button product-button-primary" type="submit">
              {copy.action}
            </button>

            {mode === 'login' || mode === 'signup' ? (
              <button
                className="auth-google-button"
                onClick={() => setMessage('Google sign-in is staged for the real Auth provider.')}
                type="button"
              >
                <span aria-hidden="true">G</span>
                Continue with Google
              </button>
            ) : null}
          </form>

          <footer className="auth-alternate">
            <span>{copy.alternate}</span>
            <Link className="auth-inline-link" href={copy.alternateHref}>
              {copy.alternateLabel}
            </Link>
          </footer>

          {mode === 'signup' ? (
            <p className="auth-legal">
              By continuing, you agree to the future Terms of Service and Privacy Policy.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
