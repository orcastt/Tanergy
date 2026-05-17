'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import {
  deleteCurrentWorkspace,
  updateCurrentWorkspace,
} from '@/features/billing/billingClient'
import type { PlanKey } from '@/features/billing/billingTypes'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { formatWorkspacePlanName } from '@/features/workspaces/workspacePresentation'

type WorkspaceSettingsPanelProps = {
  kind: 'group' | 'team'
  onWorkspaceRefresh?: () => void
  planKey: Extract<PlanKey, 'collaborate_plus' | 'collaborate_start' | 'team_growth' | 'team_start'>
  workspace: TangentWorkspace
}

export function WorkspaceSettingsPanel({
  kind,
  onWorkspaceRefresh,
  planKey,
  workspace,
}: WorkspaceSettingsPanelProps) {
  const router = useRouter()
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [draftName, setDraftName] = useState(workspace.name)
  const [error, setError] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const canManageSettings = workspace.role === 'owner'
  const kindLabel = kind === 'team' ? 'Team' : 'Group'
  const planLabel = formatWorkspacePlanName(planKey)
  const settingsFacts = [
    { label: 'Plan', value: planLabel },
    { label: 'AI billing', value: kind === 'team' ? 'Team wallet' : 'Personal credits' },
    { label: 'Delete effect', value: 'Boards, members, invites removed' },
    { label: 'Credits after delete', value: 'Stay on active plan' },
  ]

  return (
    <>
      <section className="workspace-detail-panel workspace-detail-side-panel">
        <div className="workspace-detail-panel-head">
          <div>
            <h2>Settings</h2>
            <small>
              Rename this {kindLabel.toLowerCase()} or remove its boards, invite links, and collaborators.
            </small>
          </div>
        </div>

        <div className="workspace-detail-settings-facts">
          {settingsFacts.map((fact) => (
            <div className="workspace-detail-settings-fact" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>

        <form className="workspace-detail-settings-form" onSubmit={submitRename}>
          <label className="workspace-detail-field">
            <span>{kindLabel} name</span>
            <input
              disabled={!canManageSettings || isDeleting || isSaving}
              maxLength={80}
              onChange={(event) => setDraftName(event.target.value)}
              value={draftName}
            />
          </label>

          <div className="workspace-detail-settings-actions">
            <button
              className="workspace-detail-muted-button"
              disabled={!canManageSettings || isDeleting || isSaving || isPristineName(draftName, workspace.name)}
              type="submit"
            >
              {isSaving ? 'Saving...' : 'Save name'}
            </button>
            <button
              className="workspace-detail-danger-button workspace-detail-danger-button-soft"
              disabled={!canManageSettings || isDeleting || isSaving}
              onClick={() => {
                setDeleteConfirmation('')
                setError(null)
                setStatus(null)
                setIsDeleteDialogOpen(true)
              }}
              type="button"
            >
              Delete {kindLabel}
            </button>
          </div>
        </form>

        <div className="workspace-detail-settings-note">
          <strong>{planLabel}</strong>
          <p>
            {kind === 'team'
              ? 'Team AI always charges the Team wallet. Deleting this Team clears boards, pages, invites, and members, but does not erase the subscribed credit pack.'
              : 'Group AI always charges each member’s own personal credits. Deleting this Group clears boards, pages, invites, and members, but does not merge or remove personal credits.'}
          </p>
        </div>

        {!canManageSettings ? (
          <small className="workspace-detail-status">Only the owner can rename or delete this {kindLabel.toLowerCase()}.</small>
        ) : null}
        {error ? <small className="workspace-detail-status" role="alert">{error}</small> : null}
        {status ? <small className="workspace-detail-status" role="status">{status}</small> : null}
      </section>

      {isDeleteDialogOpen ? (
        <div className="auth-profile-modal-backdrop" role="presentation">
          <section
            aria-labelledby="workspace-delete-title"
            aria-modal="true"
            className="auth-profile-modal auth-profile-modal-compact"
            role="dialog"
          >
            <div className="auth-profile-modal-copy">
              <h2 id="workspace-delete-title">Delete {workspace.name}?</h2>
              <p>
                This removes boards and projects from the {kindLabel.toLowerCase()}, revokes invite links, and removes collaborators.
              </p>
              <p>
                Remaining credits stay on the {planLabel} plan.
              </p>
            </div>

            <form className="auth-profile-form" onSubmit={submitDelete}>
              <label className="workspace-detail-field">
                <span>Type DELETE to confirm</span>
                <input
                  autoFocus
                  disabled={isDeleting}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder="DELETE"
                  value={deleteConfirmation}
                />
              </label>

              {error ? <p className="workspace-detail-status" role="alert">{error}</p> : null}

              <div className="workspace-settings-dialog-actions">
                <button
                  className="workspace-detail-muted-button"
                  disabled={isDeleting}
                  onClick={() => {
                    setDeleteConfirmation('')
                    setIsDeleteDialogOpen(false)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="workspace-detail-danger-button workspace-settings-dialog-delete"
                  disabled={isDeleting}
                  type="submit"
                >
                  {isDeleting ? `Deleting ${kindLabel}...` : `Delete ${kindLabel}`}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManageSettings || isPristineName(draftName, workspace.name)) return

    setIsSaving(true)
    setError(null)
    setStatus(null)
    try {
      const nextWorkspace = await updateCurrentWorkspace({ name: draftName }, { workspace })
      setDraftName(nextWorkspace.name)
      setStatus(`${kindLabel} name saved.`)
      onWorkspaceRefresh?.()
      requestCurrentSessionRefresh()
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `${kindLabel} rename failed.`)
    } finally {
      setIsSaving(false)
    }
  }

  async function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManageSettings) return

    setIsDeleting(true)
    setError(null)
    try {
      await deleteCurrentWorkspace({ confirmation: deleteConfirmation }, { workspace })
      requestCurrentSessionRefresh()
      onWorkspaceRefresh?.()
      router.replace(`/${kind}`)
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `${kindLabel} deletion failed.`)
      setIsDeleting(false)
    }
  }
}

function isPristineName(nextName: string, currentName: string) {
  return normalizeName(nextName) === normalizeName(currentName)
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}
