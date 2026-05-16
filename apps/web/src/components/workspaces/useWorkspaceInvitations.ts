'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listWorkspaceInvitations } from '@/features/billing/billingClient'
import type { WorkspaceInvitationRecord } from '@/features/billing/billingTypes'
import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { sortInvitations, type InviteView } from './workspaceInviteHistory'

type UseWorkspaceInvitationsOptions = {
  workspace: TangentWorkspace
}

const maxVisibleInvites = 5

export function useWorkspaceInvitations({ workspace }: UseWorkspaceInvitationsOptions) {
  const [invitations, setInvitations] = useState<WorkspaceInvitationRecord[]>([])
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true)
  const [isRefreshingInvitations, setIsRefreshingInvitations] = useState(false)
  const [inviteLoadError, setInviteLoadError] = useState<null | string>(null)
  const [inviteView, setInviteView] = useState<InviteView>('pending')
  const [expandedViews, setExpandedViews] = useState<Record<InviteView, boolean>>({
    accepted: false,
    pending: false,
    revoked: false,
  })

  const inviteGroups = useMemo(() => ({
    accepted: sortInvitations(
      invitations.filter((invite) => Boolean(invite.acceptedAt)),
      (invite) => invite.acceptedAt ?? invite.createdAt,
    ),
    pending: sortInvitations(
      invitations.filter((invite) => !invite.acceptedAt && !invite.revokedAt),
      (invite) => invite.createdAt,
    ),
    revoked: sortInvitations(
      invitations.filter((invite) => !invite.acceptedAt && Boolean(invite.revokedAt)),
      (invite) => invite.revokedAt ?? invite.createdAt,
    ),
  }), [invitations])

  const currentInvites = inviteGroups[inviteView]
  const hasExpandableView = currentInvites.length > maxVisibleInvites
  const isExpanded = expandedViews[inviteView]
  const visibleInvites = isExpanded ? currentInvites : currentInvites.slice(0, maxVisibleInvites)
  const hiddenInviteCount = Math.max(0, currentInvites.length - visibleInvites.length)
  const totalInviteCount = invitations.length

  const loadInvitations = useCallback(async (options: { isMounted?: () => boolean } = {}) => {
    try {
      const response = await listWorkspaceInvitations({ workspace })
      if (options.isMounted && !options.isMounted()) return
      setInvitations(response.invitations)
      setInviteLoadError(null)
    } catch {
      if (options.isMounted && !options.isMounted()) return
      setInvitations([])
      setInviteLoadError('Invite history is unavailable right now.')
      throw new Error('Invite history is unavailable right now.')
    } finally {
      if (options.isMounted && !options.isMounted()) return
      setIsLoadingInvitations(false)
    }
  }, [workspace])

  useEffect(() => {
    let isMounted = true
    const timeout = window.setTimeout(() => {
      setIsLoadingInvitations(true)
      setInviteLoadError(null)
      void loadInvitations({
        isMounted: () => isMounted,
      }).catch(() => {})
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timeout)
    }
  }, [loadInvitations])

  const prependInvitation = useCallback((invite: WorkspaceInvitationRecord) => {
    setInvitations((current) => [invite, ...current])
  }, [])

  const replaceInvitation = useCallback((nextInvite: WorkspaceInvitationRecord) => {
    setInvitations((current) => current.map((invite) => (
      invite.id === nextInvite.id ? nextInvite : invite
    )))
  }, [])

  const collapseInviteView = useCallback((view: InviteView) => {
    setExpandedViews((current) => ({ ...current, [view]: false }))
  }, [])

  const toggleExpandedView = useCallback((view: InviteView) => {
    setExpandedViews((current) => ({ ...current, [view]: !current[view] }))
  }, [])

  const refreshInvitations = useCallback(async () => {
    setIsRefreshingInvitations(true)
    try {
      await loadInvitations()
    } finally {
      setIsRefreshingInvitations(false)
    }
  }, [loadInvitations])

  return {
    collapseInviteView,
    currentInvites,
    hasExpandableView,
    hiddenInviteCount,
    inviteGroups,
    inviteLoadError,
    inviteView,
    invitations,
    isExpanded,
    isLoadingInvitations,
    isRefreshingInvitations,
    prependInvitation,
    refreshInvitations,
    replaceInvitation,
    setInviteView,
    toggleExpandedView,
    totalInviteCount,
    visibleInvites,
  }
}
