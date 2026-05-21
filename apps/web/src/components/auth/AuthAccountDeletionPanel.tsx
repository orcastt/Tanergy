'use client'

import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import {
  AuthAccountDeleteError,
  type AuthAccountDeleteBlocker,
  deleteCurrentAuthAccount,
} from '@/features/auth/profileClient'
import { clearSessionScopedClientState } from '@/features/auth/sessionClient'

export function AuthAccountDeletionPanel() {
  const clerk = useClerk()
  const router = useRouter()
  const [confirmation, setConfirmation] = useState('')
  const [blockers, setBlockers] = useState<AuthAccountDeleteBlocker[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (confirmation.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm account deletion.')
      return
    }

    setIsDeleting(true)
    setBlockers([])
    setError(null)
    try {
      await deleteCurrentAuthAccount({
        confirmation,
        reason: 'Self-service account deletion',
      })
      clearSessionScopedClientState()
      try {
        await clerk.signOut({ redirectUrl: '/' })
      } catch {
        router.replace('/')
      }
    } catch (nextError) {
      if (nextError instanceof AuthAccountDeleteError) {
        setBlockers(nextError.detail?.blockers ?? [])
      } else {
        setBlockers([])
      }
      setError(nextError instanceof Error ? nextError.message : 'Account deletion failed.')
      setIsDeleting(false)
    }
  }

  return (
    <form className="auth-profile-form" onSubmit={submit}>
      <p className="management-inline-note">
        Deleting your account removes your Tanergy profile, solo workspace data, and linked sign-in account.
        Team or Group workspaces you still own must be transferred or removed first.
      </p>

      <label className="auth-profile-field">
        <span className="management-field-label">Type DELETE to confirm</span>
        <input
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="DELETE"
          style={fieldControlStyle}
          type="text"
          value={confirmation}
        />
      </label>

      {error ? <p className="auth-profile-status is-error" role="alert">{error}</p> : null}
      {blockers.length > 0 ? (
        <ul className="management-inline-note" role="list">
          {blockers.map((blocker, index) => (
            <li key={`${blocker.code ?? 'blocker'}-${index}`}>
              {blocker.message ?? blocker.workspaceName ?? blocker.code ?? 'Account deletion is blocked.'}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="management-actions is-start">
        <button
          className="product-button product-button-secondary"
          data-tone="danger"
          disabled={isDeleting}
          type="submit"
        >
          {isDeleting ? 'Deleting account...' : 'Delete account'}
        </button>
      </div>
    </form>
  )
}

const fieldControlStyle = {
  width: '100%',
  minHeight: 40,
  border: '1px solid var(--color-hairline)',
  borderRadius: '12px',
  padding: '0 12px',
  background: 'var(--color-canvas)',
}
