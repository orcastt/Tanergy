'use client'

import { useEffect, useState } from 'react'
import {
  loadAdminDirectoryUsers,
  loadAdminDirectoryWorkspaces,
  type AdminDirectoryUsersResource,
  type AdminDirectoryWorkspacesResource,
} from './adminDirectoryClient'

type DirectoryState = 'error' | 'loading' | 'ready'

const emptyUsers: AdminDirectoryUsersResource = { ok: false, users: [] }
const emptyTeams: AdminDirectoryWorkspacesResource = { ok: false, workspaces: [] }
const emptyGroups: AdminDirectoryWorkspacesResource = { ok: false, workspaces: [] }

export function useAdminDirectoryResources(enabled: boolean, limit: number) {
  const [users, setUsers] = useState<AdminDirectoryUsersResource>(emptyUsers)
  const [teams, setTeams] = useState<AdminDirectoryWorkspacesResource>(emptyTeams)
  const [groups, setGroups] = useState<AdminDirectoryWorkspacesResource>(emptyGroups)
  const [status, setStatus] = useState<DirectoryState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    Promise.all([
      loadAdminDirectoryUsers(limit),
      loadAdminDirectoryWorkspaces({ kind: 'team_workspace', limit }),
      loadAdminDirectoryWorkspaces({ kind: 'group_workspace', limit }),
    ])
      .then(([nextUsers, nextTeams, nextGroups]) => {
        if (cancelled) return
        setUsers(nextUsers)
        setTeams(nextTeams)
        setGroups(nextGroups)
        setError(null)
        setStatus('ready')
      })
      .catch((nextError: unknown) => {
        if (cancelled) return
        setUsers(emptyUsers)
        setTeams(emptyTeams)
        setGroups(emptyGroups)
        setError(nextError instanceof Error ? nextError.message : 'Admin directory failed to load.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, limit, reloadToken])

  return {
    error: enabled ? error : null,
    groups: enabled ? groups : emptyGroups,
    reload: () => setReloadToken((value) => value + 1),
    status: enabled ? status : 'ready',
    teams: enabled ? teams : emptyTeams,
    users: enabled ? users : emptyUsers,
  }
}
