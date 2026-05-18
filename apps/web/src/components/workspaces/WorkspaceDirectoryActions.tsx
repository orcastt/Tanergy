'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  acceptWorkspaceInvitation,
  createGroupWorkspace,
} from '@/features/billing/billingClient'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import type { PlanKey, WorkspaceKind } from '@/features/billing/billingTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import type {
  WorkspaceDirectoryItem,
  WorkspaceMembershipRole,
} from '@/features/workspaces/workspacePresentation'
import { normalizeWorkspaceMembershipRole } from '@/features/workspaces/workspacePresentation'
import { parseWorkspaceInvitationToken } from '@/features/workspaces/workspaceInvitationLinks'

type WorkspaceDirectoryActionsProps = {
  createLabel: string
  currentPlanKey?: null | PlanKey
  joinLabel: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  onWorkspaceAdded: (item: WorkspaceDirectoryItem) => void
}

export function WorkspaceDirectoryActions({
  createLabel,
  currentPlanKey,
  joinLabel,
  kind,
  onWorkspaceAdded,
}: WorkspaceDirectoryActionsProps) {
  const router = useRouter()
  const { session, status: sessionStatus } = useTangentSession()
  const [approvalNotice, setApprovalNotice] = useState<ApprovalNotice | null>(null)
  const [status, setStatus] = useState<null | string>(null)
  const [isPending, setIsPending] = useState(false)
  const isDisabled = isPending || sessionStatus !== 'ready'
  const needsAdminApproval = kind === 'team_workspace'
    || (kind === 'group_workspace' && Boolean(currentPlanKey) && currentPlanKey !== 'free_canvas')

  return (
    <>
      <div className="workspace-directory-header-actions">
        <button className="product-button product-button-primary" disabled={isDisabled} onClick={createWorkspace} type="button">
          {createLabel}
        </button>
        <button className="product-button product-button-secondary" disabled={isDisabled} onClick={joinWorkspace} type="button">
          {joinLabel}
        </button>
      </div>
      {status ? <p className="workspace-directory-status" role="status">{status}</p> : null}
      {approvalNotice ? (
        <WorkspaceDirectoryApprovalDialog
          notice={approvalNotice}
          onClose={() => setApprovalNotice(null)}
          onOpenBilling={() => {
            setApprovalNotice(null)
            router.push('/billing')
          }}
        />
      ) : null}
    </>
  )

  async function createWorkspace() {
    if (sessionStatus !== 'ready') return
    if (needsAdminApproval) {
      setStatus(null)
      setApprovalNotice(buildApprovalNotice(kind))
      return
    }
    setIsPending(true)
    setStatus(null)
    try {
      if (kind === 'group_workspace') {
        await createGroup()
      } else {
        await createTeam()
      }
    } catch (error) {
      setApprovalNotice({
        eyebrow: 'Group',
        message: error instanceof Error ? error.message : 'Workspace action failed.',
        title: 'Admin approval required',
      })
    } finally {
      setIsPending(false)
    }
  }

  async function createGroup() {
    const name = window.prompt('Group name', 'New Group')?.trim()
    if (!name) return
    const response = await createGroupWorkspace({ name })
    onWorkspaceAdded({
      boardCount: 0,
      id: response.workspace.id,
      kind: 'group_workspace',
      memberCount: 1,
      memberInitials: [session.user.avatarInitials],
      membershipRole: normalizeMembershipRole(response.workspace.role),
      name: response.workspace.name,
      planKey: 'collaborate_start',
      relationship: 'created',
    })
    requestCurrentSessionRefresh()
    router.refresh()
    setStatus(`${response.workspace.name} created.`)
  }

  async function createTeam() {
    setApprovalNotice(buildApprovalNotice('team_workspace'))
  }

  async function joinWorkspace() {
    if (sessionStatus !== 'ready') return
    setIsPending(true)
    setStatus(null)
    try {
      const token = parseInviteToken(window.prompt('Invite token or link') ?? '')
      if (!token) throw new Error('Invite token is required.')
      const response = await acceptWorkspaceInvitation(token)
      const workspaceKind = response.result.invitation.metadata.workspaceKind === 'team_workspace'
        ? 'team_workspace'
        : 'group_workspace'
      onWorkspaceAdded({
        boardCount: 0,
        id: response.result.workspaceId,
        kind: workspaceKind,
        memberCount: 1,
        memberInitials: [session.user.avatarInitials],
        membershipRole: normalizeMembershipRole(response.result.role),
        name: `Joined ${workspaceKind === 'team_workspace' ? 'team' : 'group'}`,
        planKey: workspaceKind === 'team_workspace' ? 'team_start' : 'collaborate_start',
        relationship: 'joined',
      })
      requestCurrentSessionRefresh()
      router.refresh()
      setStatus('Invite accepted.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invite accept failed.')
    } finally {
      setIsPending(false)
    }
  }
}

type ApprovalNotice = {
  eyebrow: string
  message: string
  title: string
}

function WorkspaceDirectoryApprovalDialog({
  notice,
  onClose,
  onOpenBilling,
}: {
  notice: ApprovalNotice
  onClose: () => void
  onOpenBilling: () => void
}) {
  return (
    <div className="workspace-limit-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-label={notice.title}
        aria-modal="true"
        className="workspace-limit-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="workspace-limit-dialog-copy">
          <span className="workspace-limit-dialog-eyebrow">{notice.eyebrow}</span>
          <h2>{notice.title}</h2>
          <p>{notice.message}</p>
        </div>
        <div className="workspace-limit-dialog-actions">
          <button className="product-button product-button-secondary" onClick={onClose} type="button">
            Not now
          </button>
          <button className="product-button product-button-primary" onClick={onOpenBilling} type="button">
            Open Subscription
          </button>
        </div>
      </section>
    </div>
  )
}

function buildApprovalNotice(kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>): ApprovalNotice {
  if (kind === 'team_workspace') {
    return {
      eyebrow: 'Team',
      message: 'Team workspaces require manual admin approval while payments and seats are still controlled from Admin Finance.',
      title: 'Admin approval required',
    }
  }
  return {
    eyebrow: 'Group',
    message: 'Paid Group capacity is enabled by admin approval during beta. Please open Subscription to review the available plan path.',
    title: 'Admin approval required',
  }
}

function normalizeMembershipRole(role: string): WorkspaceMembershipRole {
  return normalizeWorkspaceMembershipRole(role)
}

function parseInviteToken(value: string) {
  return parseWorkspaceInvitationToken(value)
}
