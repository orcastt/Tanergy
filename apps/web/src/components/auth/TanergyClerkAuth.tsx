'use client'

import Link from 'next/link'
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn, SignUp } from '@clerk/nextjs'

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
  const AuthComponent = isSignUp ? SignUp : SignIn
  const title = isSignUp ? 'Create your Tanergy account.' : 'Welcome back to Tanergy.'
  const copy = isSignUp
    ? 'Register with email, Google or GitHub, then enter your workspace.'
    : 'Log in with email, Google or GitHub to continue.'
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
            fallbackRedirectUrl="/workspaces"
            path={`/${mode}`}
            routing="path"
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
          />
        </ClerkLoaded>
      </section>
    </main>
  )
}
