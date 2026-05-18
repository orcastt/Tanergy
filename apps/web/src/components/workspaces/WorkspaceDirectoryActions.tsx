'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  acceptWorkspaceInvitation,
  createGroupWorkspace,
} from '@/features/billing/billingClient'
import { requestCurrentSessionRefresh } from '@/features/auth/sessionClient'
import type { WorkspaceKind } from '@/features/billing/billingTypes'
import { useTangentSession } from '@/features/auth/useTangentSession'
import type {
  WorkspaceDirectoryItem,
  WorkspaceMembershipRole,
} from '@/features/workspaces/workspacePresentation'
import { normalizeWorkspaceMembershipRole } from '@/features/workspaces/workspacePresentation'
import { parseWorkspaceInvitationToken } from '@/features/workspaces/workspaceInvitationLinks'

type WorkspaceDirectoryActionsProps = {
  createLabel: string
  joinLabel: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  onWorkspaceAdded: (item: WorkspaceDirectoryItem) => void
}

export function WorkspaceDirectoryActions({
  createLabel,
  joinLabel,
  kind,
  onWorkspaceAdded,
}: WorkspaceDirectoryActionsProps) {
  const router = useRouter()
  const { session, status: sessionStatus } = useTangentSession()
  const [status, setStatus] = useState<null | string>(null)
  const [isPending, setIsPending] = useState(false)
  const isDisabled = isPending || sessionStatus !== 'ready'

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
    </>
  )

  async function createWorkspace() {
    if (sessionStatus !== 'ready') return
    setIsPending(true)
    setStatus(null)
    try {
      if (kind === 'group_workspace') {
        await createGroup()
      } else {
        await createTeam()
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Workspace action failed.')
    } finally {
      setIsPending(false)
    }
  }

  async function createGroup() {
    const name = window.prompt('Group name', 'New Group')?.trim()
    if (!name) throw new Error('Group name is required.')
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
    setStatus('Team workspaces are enabled from Admin Finance during beta.')
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

function normalizeMembershipRole(role: string): WorkspaceMembershipRole {
  return normalizeWorkspaceMembershipRole(role)
}

function parseInviteToken(value: string) {
  return parseWorkspaceInvitationToken(value)
}
