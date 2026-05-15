'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { hasRemotePersistenceApi } from '@/features/api/persistenceApi'
import { authProfileGenderOptions } from '@/features/auth/authProfileOptions'
import { updateCurrentAuthProfile } from '@/features/auth/profileClient'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import type { TangentUser } from '@/features/auth/sessionTypes'

type AuthProfileFormProps = {
  allowPristineSubmit?: boolean
  initialDisplayName: string
  initialGender?: null | string
  onSaved?: (user: TangentUser) => void
  submitLabel?: string
  successMessage?: string
}

export function AuthProfileForm({
  allowPristineSubmit = false,
  initialDisplayName,
  initialGender,
  onSaved,
  submitLabel = 'Save profile',
  successMessage = 'Profile saved.',
}: AuthProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [gender, setGender] = useState(initialGender ?? '')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const canPersistProfile = hasRemotePersistenceApi()

  const isDirty = useMemo(() => {
    return displayName.trim() !== initialDisplayName.trim() || gender !== (initialGender ?? '')
  }, [displayName, gender, initialDisplayName, initialGender])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextDisplayName = displayName.trim()
    if (!nextDisplayName) {
      setError('Display name is required.')
      return
    }
    if (!canPersistProfile) {
      setError('Profile editing becomes live once the FastAPI auth backend is connected.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const user = await updateCurrentAuthProfile({
        displayName: nextDisplayName,
        gender: gender || null,
      })
      setDisplayName(user.displayName)
      setGender(user.gender ?? '')
      setMessage(successMessage)
      requestCurrentSessionRefresh()
      onSaved?.(user)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Profile update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="auth-profile-form" onSubmit={submit}>
      <label className="auth-profile-field">
        <span className="management-field-label">Display name</span>
        <input
          autoComplete="nickname"
          maxLength={80}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="How your name appears in Tanergy"
          style={fieldControlStyle}
          type="text"
          value={displayName}
        />
      </label>

      <label className="auth-profile-field">
        <span className="management-field-label">Gender</span>
        <select
          onChange={(event) => setGender(event.target.value)}
          style={fieldControlStyle}
          value={gender}
        >
          {authProfileGenderOptions.map((option) => (
            <option key={option.value || 'unset'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {!canPersistProfile ? (
        <p className="auth-profile-note">
          Profile editing becomes available when the FastAPI auth backend is configured.
        </p>
      ) : null}
      {error ? <p className="auth-profile-status is-error" role="alert">{error}</p> : null}
      {!error && message ? <p className="auth-profile-status" role="status">{message}</p> : null}

      <div className="management-actions is-start">
        <button
          className="product-button product-button-primary"
          disabled={saving || !canPersistProfile || !displayName.trim() || (!allowPristineSubmit && !isDirty && canPersistProfile)}
          type="submit"
        >
          {saving ? 'Saving profile...' : submitLabel}
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
