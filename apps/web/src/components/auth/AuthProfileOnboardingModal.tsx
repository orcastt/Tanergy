'use client'

import { useState } from 'react'
import { AuthProfileForm } from './AuthProfileForm'
import type { TangentUser } from '@/features/auth/sessionTypes'

type AuthProfileOnboardingModalProps = {
  user: Pick<TangentUser, 'displayName' | 'profileCompleted'>
}

export function AuthProfileOnboardingModal({ user }: AuthProfileOnboardingModalProps) {
  const [completedOptimistically, setCompletedOptimistically] = useState(false)

  if (user.profileCompleted || completedOptimistically) return null

  return (
    <div className="auth-profile-modal-backdrop" role="presentation">
      <section
        aria-describedby="auth-profile-onboarding-copy"
        aria-labelledby="auth-profile-onboarding-title"
        aria-modal="true"
        className="auth-profile-modal"
        role="dialog"
      >
        <div className="auth-profile-modal-copy">
          <span className="management-badge">Profile setup</span>
          <h2 id="auth-profile-onboarding-title">Finish your Tanergy profile before you keep going.</h2>
          <p id="auth-profile-onboarding-copy">
            Clerk keeps sign-in, password reset, and email verification. Tanergy stores the display
            name and profile details that appear across boards and workspaces.
          </p>
        </div>

        <div className="auth-profile-modal-grid">
          <AuthProfileForm
            allowPristineSubmit
            key={user.displayName}
            initialDisplayName={user.displayName}
            onSaved={() => setCompletedOptimistically(true)}
            submitLabel="Continue to workspace"
            successMessage="Profile saved. Opening your workspace."
          />

          <aside className="auth-profile-modal-aside">
            <div>
              <span className="management-field-label">Managed by Clerk</span>
              <p>Authentication, password recovery, email verification, provider identity.</p>
            </div>
            <div>
              <span className="management-field-label">Managed by Tanergy</span>
              <p>Display name, workspace-facing profile state, future product preferences.</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
