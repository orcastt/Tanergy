'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn, SignUp } from '@clerk/nextjs'
import { resolveAuthRedirectPath } from '@/features/auth/authRedirect'

type TanergyClerkAuthProps = {
  mode: 'sign-in' | 'sign-up'
}

const clerkAppearance = {
  elements: {
    cardBox: 'tanergy-clerk-card-box',
    card: 'tanergy-clerk-card',
    headerTitle: 'tanergy-clerk-title',
    headerSubtitle: 'tanergy-clerk-subtitle',
    socialButtonsBlockButton: 'tanergy-clerk-social-button',
    socialButtonsBlockButtonText: 'tanergy-clerk-social-text',
    formButtonPrimary: 'tanergy-clerk-primary',
    formFieldInput: 'tanergy-clerk-input',
    footerActionLink: 'tanergy-clerk-link',
  },
  variables: {
    borderRadius: '10px',
    colorPrimary: '#181d26',
    colorText: '#181d26',
    colorTextSecondary: '#45474b',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
}

export function TanergyClerkAuth({ mode }: TanergyClerkAuthProps) {
  const isSignUp = mode === 'sign-up'
  const searchParams = useSearchParams()
  const [devBypassError, setDevBypassError] = useState<string | null>(null)
  const [devBypassBusy, setDevBypassBusy] = useState(false)
  const AuthComponent = isSignUp ? SignUp : SignIn
  const redirectPath = resolveAuthRedirectPath(searchParams)
  const title = isSignUp ? 'Create your Tanergy account.' : 'Welcome back to Tanergy.'
  const copy = isSignUp
    ? 'Register with email, Google or Microsoft, then enter your workspace.'
    : 'Log in with email, Google or Microsoft to continue.'
  const showDevBypass = process.env.NODE_ENV !== 'production'
    && process.env.NEXT_PUBLIC_TANGENT_ENABLE_DEV_AUTH_BYPASS === '1'

  async function continueAsLocalAdmin() {
    setDevBypassBusy(true)
    setDevBypassError(null)
    try {
      const response = await fetch('/api/auth/dev-bypass', { method: 'POST' })
      const payload = await response.json() as { error?: string; next?: string; ok?: boolean }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Local dev access failed.')
      window.location.assign(payload.next || '/admin')
    } catch (error) {
      setDevBypassError(error instanceof Error ? error.message : 'Local dev access failed.')
      setDevBypassBusy(false)
    }
  }

  return (
    <main className={`tanergy-auth tanergy-auth-${isSignUp ? 'mint' : 'coral'}`}>
      <section className="tanergy-auth-panel" aria-label="Tanergy account context">
        <Link className="tanergy-auth-brand" href="/">
          Tanergy
        </Link>
        <div className="tanergy-auth-art" aria-hidden="true">
          <div className="tanergy-auth-art-card large">
            <span>Prompt</span>
            <strong>Structure creative decisions before the canvas fills up.</strong>
          </div>
          <div className="tanergy-auth-art-row">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="tanergy-auth-copy">
          <h1>Quietly editorial.</h1>
          <p>
            The account layer keeps boards, assets, pages and AI runs scoped to the right workspace.
          </p>
        </div>
      </section>

      <section className="tanergy-auth-form-area">
        <Link className="tanergy-auth-mobile-brand" href="/">
          Tanergy
        </Link>
        <div className="tanergy-auth-heading">
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
        <ClerkLoading>
          <div className="tanergy-clerk-status">Loading account form.</div>
        </ClerkLoading>
        <ClerkFailed>
          <div className="tanergy-clerk-status" role="alert">
            Clerk could not load. Check the publishable key, allowed origin and network access.
          </div>
        </ClerkFailed>
        <ClerkLoaded>
          <AuthComponent
            appearance={clerkAppearance}
            fallbackRedirectUrl={redirectPath}
            path={`/${mode}`}
            routing="path"
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
          />
        </ClerkLoaded>
        {isSignUp ? null : (
          <div className="tanergy-auth-support-row">
            <Link className="tanergy-auth-support-link" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
        )}
        {showDevBypass ? (
          <div className="tanergy-dev-auth">
            <button
              className="tanergy-dev-auth-button"
              disabled={devBypassBusy}
              onClick={continueAsLocalAdmin}
              type="button"
            >
              {devBypassBusy ? 'Opening local admin.' : 'Continue as local admin'}
            </button>
            {devBypassError ? <p role="alert">{devBypassError}</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
