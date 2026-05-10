'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { EmptyRow, FilterTextInput, MetaLine, limitOptions } from './adminAiShared'
import { AdminWorkspaceDetailPanel } from './AdminWorkspaceDetailPanel'
import {
  groupWorkspaceDirectoryKind,
  loadAdminWorkspaceDirectoryResource,
  primeAdminWorkspaceDirectoryResource,
  readAdminWorkspaceDirectoryResource,
  teamWorkspaceDirectoryKind,
} from './adminDirectoryCache'
import {
  loadAdminDirectoryWorkspaceDetail,
  type AdminDirectoryWorkspaceDetailResource,
  type AdminDirectoryWorkspacesResource,
} from './adminDirectoryClient'
import { loadClientResource } from '@/features/shared/clientResourceCache'

type DirectoryStatus = 'error' | 'loading' | 'ready' | 'refreshing'

const emptyDirectory: AdminDirectoryWorkspacesResource = { limit: 25, offset: 0, ok: false, totalCount: 0, workspaces: [] }
const emptyDetail: AdminDirectoryWorkspaceDetailResource = { boards: [], members: [], ok: false }
const workspaceDetailStore = new Map<string, {
  data?: AdminDirectoryWorkspaceDetailResource
  error?: string | null
  promise?: Promise<AdminDirectoryWorkspaceDetailResource>
  updatedAt: number
}>()

export function AdminWorkspacesDashboard({
  enabled,
  kind,
  label,
  seedResource,
}: {
  enabled: boolean
  kind: 'group' | 'team'
  label: string
  seedResource: AdminDirectoryWorkspacesResource
}) {
  const initialLimit = limitOptions.includes(seedResource.limit as (typeof limitOptions)[number])
    ? seedResource.limit as (typeof limitOptions)[number]
    : 25
  const workspaceKind = kind === 'team' ? teamWorkspaceDirectoryKind : groupWorkspaceDirectoryKind
  const [limit, setLimit] = useState<(typeof limitOptions)[number]>(initialLimit)
  const [offset, setOffset] = useState(seedResource.ok ? seedResource.offset : 0)
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(seedResource.workspaces[0]?.id ?? '')
  const [detail, setDetail] = useState<AdminDirectoryWorkspaceDetailResource>(emptyDetail)
  const [detailStatus, setDetailStatus] = useState<'error' | 'loading' | 'ready'>(selectedWorkspaceId ? 'loading' : 'ready')
  const [reloadToken, setReloadToken] = useState(0)
  const [loadedReloadToken, setLoadedReloadToken] = useState(seedResource.ok ? 0 : -1)
  const [detailReloadToken, setDetailReloadToken] = useState(0)
  const [loadedDetailReloadToken, setLoadedDetailReloadToken] = useState(0)

  const directoryQuery = useMemo(() => ({ kind: workspaceKind, limit, offset, search: searchQuery || undefined }), [limit, offset, searchQuery, workspaceKind])
  const requestSignature = workspaceDirectorySignature(directoryQuery)
  const seedSignature = workspaceDirectorySignature({ kind: workspaceKind, limit: seedResource.limit || initialLimit, offset: seedResource.offset || 0 })
  const directorySnapshot = readAdminWorkspaceDirectoryResource(directoryQuery)
  const seedMatchesCurrentQuery = seedResource.ok && !searchQuery && requestSignature === seedSignature
  const initialDirectory = seedMatchesCurrentQuery ? seedResource : directorySnapshot.data ?? emptyDirectory
  const [directory, setDirectory] = useState<AdminDirectoryWorkspacesResource>(initialDirectory)
  const [directoryError, setDirectoryError] = useState<string | null>(seedMatchesCurrentQuery ? (seedResource.error ?? directorySnapshot.error ?? null) : (directorySnapshot.error ?? null))
  const [loadedSignature, setLoadedSignature] = useState(seedMatchesCurrentQuery || directorySnapshot.data ? requestSignature : '')
  const shouldFetch = enabled && (requestSignature !== loadedSignature || reloadToken !== loadedReloadToken)
  const workspaces = directory.workspaces
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0] ?? null
  const rangeLabel = workspaces.length
    ? `${directory.offset + 1}-${directory.offset + workspaces.length} of ${directory.totalCount.toLocaleString('en-US')}`
    : `0 of ${directory.totalCount.toLocaleString('en-US')}`
  const canGoBack = offset > 0
  const canGoNext = offset + limit < directory.totalCount
  const hasActiveSearch = Boolean(searchDraft.trim()) || Boolean(searchQuery)
  const directoryStatus: DirectoryStatus = !enabled
    ? 'ready'
    : shouldFetch && !workspaces.length
      ? 'loading'
      : shouldFetch
        ? 'refreshing'
        : directoryError
          ? 'error'
          : 'ready'

  useEffect(() => {
    if (!seedResource.ok) return
    primeAdminWorkspaceDirectoryResource({ kind: workspaceKind, limit: seedResource.limit || initialLimit, offset: seedResource.offset || 0 }, seedResource)
  }, [initialLimit, seedResource, workspaceKind])

  useEffect(() => {
    if (!shouldFetch) return
    let cancelled = false

    loadAdminWorkspaceDirectoryResource(directoryQuery, {
      force: reloadToken !== loadedReloadToken,
    })
      .then((nextDirectory) => {
        if (cancelled) return
        setDirectory(nextDirectory)
        setDirectoryError(nextDirectory.error ?? null)
        setLoadedSignature(requestSignature)
        setLoadedReloadToken(reloadToken)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDirectoryError(error instanceof Error ? error.message : `${label} directory failed to load.`)
        setLoadedSignature(requestSignature)
        setLoadedReloadToken(reloadToken)
      })

    return () => {
      cancelled = true
    }
  }, [directoryQuery, label, loadedReloadToken, reloadToken, requestSignature, shouldFetch])

  useEffect(() => {
    if (!enabled || !selectedWorkspace?.id) return
    let cancelled = false
    const detailKey = `${kind}:${selectedWorkspace.id}`

    loadClientResource(
      workspaceDetailStore,
      detailKey,
      () => loadAdminDirectoryWorkspaceDetail(selectedWorkspace.id),
      {
        force: detailReloadToken !== loadedDetailReloadToken,
        storage: 'local',
        storageKey: `tanergy.admin-workspace-detail.${detailKey}`,
        ttlMs: 300_000,
      },
    )
      .then((nextDetail) => {
        if (cancelled) return
        setDetail(nextDetail)
        setDetailStatus('ready')
        setLoadedDetailReloadToken(detailReloadToken)
      })
      .catch(() => {
        if (cancelled) return
        setDetail(emptyDetail)
        setDetailStatus('error')
        setLoadedDetailReloadToken(detailReloadToken)
      })

    return () => {
      cancelled = true
    }
  }, [detailReloadToken, enabled, kind, loadedDetailReloadToken, selectedWorkspace?.id])

  function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setOffset(0)
    setSearchQuery(searchDraft.trim())
  }

  function clearSearch() {
    setOffset(0)
    setSearchDraft('')
    setSearchQuery('')
  }

  function refresh() {
    setDetailStatus(selectedWorkspace ? 'loading' : 'ready')
    setReloadToken((value) => value + 1)
    setDetailReloadToken((value) => value + 1)
  }

  return (
    <section className="management-workspace-layout" aria-label={`${label} dashboard`}>
      <article className="management-panel management-panel-wide">
        <div className="management-panel-heading">
          <div><h2>{label}</h2></div>
          <div className="management-actions">
            <span className="management-inline-note">{rangeLabel}</span>
            <div className="management-segmented">
              {limitOptions.map((option) => (
                <button
                  key={option}
                  className={option === limit ? 'is-active' : undefined}
                  onClick={() => {
                    setLimit(option)
                    setOffset(0)
                  }}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <button className="product-button product-button-secondary" onClick={refresh} type="button">
              Reload
            </button>
            <span className={`management-status ${directoryStatus === 'ready' ? 'is-success' : ''}`}>{directoryStatus}</span>
          </div>
        </div>
        {directoryError ? <p>{directoryError}</p> : null}
        <div className="admin-users-toolbar">
          <form className="admin-users-search-form" onSubmit={submitSearch}>
            <FilterTextInput
              label={`Search ${label.toLowerCase()}`}
              leadingIcon="search"
              onChange={setSearchDraft}
              placeholder="name, owner, or workspace_id"
              value={searchDraft}
            />
            <button className="product-button" type="submit">Search</button>
            <button className="product-button product-button-secondary" disabled={!hasActiveSearch} onClick={clearSearch} type="button">
              Clear
            </button>
          </form>
          <div className="admin-users-toolbar-actions">
            <button className="product-button product-button-secondary" disabled={!canGoBack} onClick={() => setOffset(Math.max(0, offset - limit))} type="button">
              Previous
            </button>
            <button className="product-button product-button-secondary" disabled={!canGoNext} onClick={() => setOffset(offset + limit)} type="button">
              Next
            </button>
          </div>
        </div>
        <div className="management-table-wrap">
          <table className="management-table admin-workspaces-table">
            <thead><tr><th>Name</th><th>Owner</th><th>Members</th><th>Boards</th><th>Plan</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {directoryStatus === 'loading' ? <EmptyRow colSpan={7} message={`Loading ${label.toLowerCase()}...`} /> : null}
              {directoryStatus !== 'loading' && workspaces.length ? workspaces.map((workspace) => (
                <tr
                  key={workspace.id}
                  className={workspace.id === selectedWorkspace?.id ? 'is-selected' : undefined}
                  onClick={() => {
                    if (workspace.id === selectedWorkspace?.id) return
                    setSelectedWorkspaceId(workspace.id)
                    setDetailStatus('loading')
                  }}
                >
                  <td><strong>{workspace.name}</strong><MetaLine>{workspace.id}</MetaLine></td>
                  <td>{workspace.ownerEmail || workspace.ownerId || 'Unknown'}</td>
                  <td>{workspace.memberCount}</td>
                  <td>{workspace.boardCount}</td>
                  <td>{workspace.planKey ?? workspace.ownerCollaboratePlanKey ?? 'free'}</td>
                  <td><span className={`management-status ${workspace.status === 'active' ? 'is-success' : ''}`}>{workspace.status}</span></td>
                  <td>
                    <button
                      className="product-button product-button-secondary admin-table-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (workspace.id === selectedWorkspace?.id) return
                        setSelectedWorkspaceId(workspace.id)
                        setDetailStatus('loading')
                      }}
                      type="button"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              )) : null}
              {directoryStatus !== 'loading' && !workspaces.length ? <EmptyRow colSpan={7} message={`No ${label.toLowerCase()} found.`} /> : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="management-panel">
        {selectedWorkspace ? (
          <AdminWorkspaceDetailPanel
            detail={detail}
            detailStatus={detailStatus}
            enabled={enabled}
            kind={kind}
            onMutated={refresh}
            workspace={selectedWorkspace}
          />
        ) : <p>No {label.toLowerCase()} selected.</p>}
      </article>
    </section>
  )
}

function workspaceDirectorySignature(query: { kind: string; limit: number; offset: number; search?: string }) {
  return JSON.stringify({ kind: query.kind, limit: query.limit, offset: query.offset, search: query.search?.trim() ?? '' })
}
