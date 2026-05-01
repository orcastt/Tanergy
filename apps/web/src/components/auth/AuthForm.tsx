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
  action: string
  alternate: string
  alternateHref: string
  alternateLabel: string
}> = {
  login: {
    title: 'Log in to your canvas',
    copy: 'Use the local shell to preview the account flow. Real sessions arrive after the Auth backend is wired.',
    action: 'Continue',
    alternate: 'Need an account?',
    alternateHref: '/signup',
    alternateLabel: 'Sign up',
  },
  signup: {
    title: 'Create your workspace',
    copy: 'This creates a mock local account shape for now. Email verification and workspace ownership come later.',
    action: 'Create account',
    alternate: 'Already have an account?',
    alternateHref: '/login',
    alternateLabel: 'Log in',
  },
  'forgot-password': {
    title: 'Reset access',
    copy: 'Password reset email sending is intentionally stubbed until an email provider is configured.',
    action: 'Prepare reset',
    alternate: 'Remembered it?',
    alternateHref: '/login',
    alternateLabel: 'Back to log in',
  },
  'verify-email': {
    title: 'Verify your email',
    copy: 'Enter a mock code to test the verification surface. Real OTP delivery waits for SPF, DKIM and DMARC.',
    action: 'Verify locally',
    alternate: 'Need a fresh account?',
    alternateHref: '/signup',
    alternateLabel: 'Sign up',
  },
}

export function AuthForm({ mode }: AuthFormProps) {
  const copy = copyByMode[mode]
  const [email, setEmail] = useState('dev@tangent.local')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const needsPassword = mode === 'login' || mode === 'signup'
  const needsCode = mode === 'verify-email'
  const helper = useMemo(() => {
    if (mode === 'signup') return 'Use 8 or more characters for the mock password check.'
    if (mode === 'verify-email') return 'Any 6 digit code is accepted by this local shell.'
    return 'No real session or email is created yet.'
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
    <section className="auth-layout">
      <div className="auth-editorial">
        <p className="product-kicker">TANGENT account shell</p>
        <h1>{copy.title}</h1>
        <p>{copy.copy}</p>
        <div className="auth-signature-card">
          <h2>Personal workspace first</h2>
          <p>
            P0 keeps the account model narrow: one mock user, one personal workspace,
            and protected routes shaped for the real session layer.
          </p>
        </div>
      </div>

      <form className="auth-form-card" onSubmit={submit}>
        <label>
          Email
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>

        {needsPassword ? (
          <label>
            Password
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8+ characters"
              type="password"
              value={password}
            />
          </label>
        ) : null}

        {needsCode ? (
          <label>
            Verification code
            <input
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              value={code}
            />
          </label>
        ) : null}

        <p className="auth-helper">{helper}</p>
        {error ? <p className="auth-error">{error}</p> : null}
        {message ? <p className="auth-success">{message}</p> : null}

        <button className="product-button product-button-primary" type="submit">
          {copy.action}
        </button>

        <p className="auth-alternate">
          {copy.alternate}{' '}
          <Link className="product-text-link" href={copy.alternateHref}>
            {copy.alternateLabel}
          </Link>
        </p>
        {mode === 'login' ? (
          <Link className="product-text-link" href="/forgot-password">
            Forgot password?
          </Link>
        ) : null}
      </form>
    </section>
  )
}
