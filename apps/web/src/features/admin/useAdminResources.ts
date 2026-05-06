'use client'

import { useEffect, useState } from 'react'
import {
  loadAdminAuditLogs,
  loadAdminBoards,
  loadAdminSummary,
  loadAdminUsers,
  loadAdminWorkspaces,
  type AdminAuditLogsResource,
  type AdminBoardsResource,
  type AdminSummaryResource,
  type AdminUsersResource,
  type AdminWorkspacesResource,
} from './adminClient'

type AdminResourceState = 'error' | 'loading' | 'ready'

type AdminResourceOptions = {
  auditAction?: string
  auditActorUserId?: string
  auditLimit: number
  auditTargetUserId?: string
  boardLimit: number
  userLimit: number
  workspaceLimit: number
}

const emptySummary: AdminSummaryResource = { ok: false }
const emptyUsers: AdminUsersResource = { ok: false, users: [] }
const emptyWorkspaces: AdminWorkspacesResource = { ok: false, workspaces: [] }
const emptyBoards: AdminBoardsResource = { ok: false, boards: [] }
const emptyAuditLogs: AdminAuditLogsResource = { ok: false, logs: [] }

export function useAdminResources(enabled: boolean, options: AdminResourceOptions) {
  const [summary, setSummary] = useState<AdminSummaryResource>(emptySummary)
  const [users, setUsers] = useState<AdminUsersResource>(emptyUsers)
  const [workspaces, setWorkspaces] = useState<AdminWorkspacesResource>(emptyWorkspaces)
  const [boards, setBoards] = useState<AdminBoardsResource>(emptyBoards)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogsResource>(emptyAuditLogs)
  const [status, setStatus] = useState<AdminResourceState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let isCancelled = false

    Promise.all([
      loadAdminSummary(),
      loadAdminUsers(options.userLimit),
      loadAdminWorkspaces(options.workspaceLimit),
      loadAdminBoards(options.boardLimit),
      loadAdminAuditLogs({
        action: options.auditAction,
        actorUserId: options.auditActorUserId,
        limit: options.auditLimit,
        targetUserId: options.auditTargetUserId,
      }),
    ])
      .then(([nextSummary, nextUsers, nextWorkspaces, nextBoards, nextAuditLogs]) => {
        if (isCancelled) return
        setSummary(nextSummary)
        setUsers(nextUsers)
        setWorkspaces(nextWorkspaces)
        setBoards(nextBoards)
        setAuditLogs(nextAuditLogs)
        setError(null)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (isCancelled) return
        setSummary(emptySummary)
        setUsers(emptyUsers)
        setWorkspaces(emptyWorkspaces)
        setBoards(emptyBoards)
        setAuditLogs(emptyAuditLogs)
        setError(nextError instanceof Error ? nextError.message : 'Admin resources failed to load.')
        setStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [
    enabled,
    options.auditAction,
    options.auditActorUserId,
    options.auditLimit,
    options.auditTargetUserId,
    options.boardLimit,
    options.userLimit,
    options.workspaceLimit,
    reloadToken,
  ])

  return {
    auditLogs: enabled ? auditLogs : emptyAuditLogs,
    boards: enabled ? boards : emptyBoards,
    error: enabled ? error : null,
    reload: () => setReloadToken((value) => value + 1),
    status: enabled ? status : 'ready',
    summary: enabled ? summary : emptySummary,
    users: enabled ? users : emptyUsers,
    workspaces: enabled ? workspaces : emptyWorkspaces,
  }
}
