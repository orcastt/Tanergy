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
        aria-labelledby="auth-profile-onboarding-title"
        aria-modal="true"
        className="auth-profile-modal auth-profile-modal-compact"
        role="dialog"
      >
        <div className="auth-profile-modal-copy">
          <h2 id="auth-profile-onboarding-title">Set your display name</h2>
        </div>
        <AuthProfileForm
          allowPristineSubmit
          key={user.displayName}
          initialDisplayName={user.displayName}
          onSaved={() => setCompletedOptimistically(true)}
          submitLabel="Continue to workspace"
          successMessage="Profile saved. Opening your workspace."
        />
      </section>
    </div>
  )
}
