'use client'

import { useEffect, useState } from 'react'
import {
  loadAdminAiVersions,
  type AdminAiControlPlaneVersionRecord,
} from './adminAiClient'
import {
  EmptyRow,
  MetaLine,
  formatCompactDateTime,
  selectStyle,
  truncateMiddle,
} from './adminAiShared'

type VersionHistoryResource = {
  error?: string
  ok: boolean
  versions: AdminAiControlPlaneVersionRecord[]
}

type VersionMutation = (note?: string) => Promise<{
  error?: string
  ok: boolean
  version?: AdminAiControlPlaneVersionRecord
}>

type RollbackMutation = (versionId: string, note?: string) => Promise<{
  error?: string
  ok: boolean
  version?: AdminAiControlPlaneVersionRecord
}>

export function AdminAiVersionHistoryPanel({
  limit = 8,
  onChanged,
  publishLabel = 'Publish current',
  publishVersion,
  resourceId,
  resourceLabel = 'versions',
  resourceType,
  rollbackVersion,
  title = 'Version history',
}: {
  limit?: number
  onChanged?: () => void
  publishLabel?: string
  publishVersion: VersionMutation
  resourceId: string
  resourceLabel?: string
  resourceType: string
  rollbackVersion: RollbackMutation
  title?: string
}) {
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [resource, setResource] = useState<VersionHistoryResource>({ ok: true, versions: [] })
  const [resolvedKey, setResolvedKey] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [rollbackingId, setRollbackingId] = useState('')
  const requestKey = JSON.stringify({ limit, reloadToken, resourceId, resourceType })

  useEffect(() => {
    let cancelled = false
    loadAdminAiVersions({ limit, resourceId, resourceType })
      .then((payload) => {
        if (cancelled) return
        setResource(payload)
        setResolvedKey(requestKey)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResource({
          error: error instanceof Error ? error.message : 'Version history unavailable.',
          ok: false,
          versions: [],
        })
        setResolvedKey(requestKey)
      })
    return () => {
      cancelled = true
    }
  }, [limit, requestKey, resourceId, resourceType])

  async function handlePublish() {
    setPublishing(true)
    setMessage('Publishing...')
    try {
      const payload = await publishVersion(optionalNote(note))
      const nextMessage = payload.version ? `Published v${payload.version.versionNumber}.` : 'Published current version.'
      setMessage(nextMessage)
      setNote('')
      onChanged?.()
      setReloadToken((value) => value + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publish failed.')
    } finally {
      setPublishing(false)
    }
  }

  async function handleRollback(versionId: string) {
    setRollbackingId(versionId)
    setMessage(`Rolling back ${versionLabel(resource.versions.find((version) => version.id === versionId))}...`)
    try {
      const payload = await rollbackVersion(versionId, optionalNote(note))
      const nextMessage = payload.version ? `Rolled back to v${payload.version.versionNumber}.` : 'Rollback completed.'
      setMessage(nextMessage)
      setNote('')
      onChanged?.()
      setReloadToken((value) => value + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rollback failed.')
    } finally {
      setRollbackingId('')
    }
  }

  const isResolved = resolvedKey === requestKey
  const status = isResolved ? (resource.ok ? 'ready' : 'error') : 'loading'
  const controlsDisabled = publishing || Boolean(rollbackingId)

  return (
    <section className="admin-route-release-shell" aria-label={title}>
      <div className="management-panel-heading compact">
        <div><h2>{title}</h2></div>
        <div className="management-actions">
          <span className={`management-status ${status === 'ready' ? 'is-success' : ''}`}>{status}</span>
          <button className="product-button product-button-secondary" disabled={controlsDisabled} onClick={() => setReloadToken((value) => value + 1)} type="button">
            Reload
          </button>
          <button className="product-button" disabled={controlsDisabled} onClick={handlePublish} type="button">
            {publishLabel}
          </button>
        </div>
      </div>

      <div className="admin-route-release-toolbar">
        <label className="admin-route-release-note">
          <span className="management-field-label">Version note</span>
          <input onChange={(event) => setNote(event.target.value)} placeholder="Optional publish or rollback note" style={selectStyle} type="text" value={note} />
        </label>
        <span className="management-inline-note">{message || `Recent ${resourceLabel}`}</span>
      </div>

      <div className="management-table-wrap">
        <table className="management-table compact admin-route-version-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Action</th>
              <th>Note</th>
              <th>Published</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {!isResolved ? <EmptyRow colSpan={5} message="Loading version history..." /> : null}
            {isResolved && resource.error ? <EmptyRow colSpan={5} message={resource.error} /> : null}
            {isResolved && !resource.error && resource.versions.length ? resource.versions.map((version) => (
              <tr key={version.id}>
                <td>
                  <strong>{versionLabel(version)}</strong>
                  <MetaLine>{truncateMiddle(version.id, 8, 6)}</MetaLine>
                </td>
                <td>
                  <strong>{formatVersionAction(version.action)}</strong>
                  <MetaLine>{version.actorUserId ? truncateMiddle(version.actorUserId, 10, 6) : 'System'}</MetaLine>
                </td>
                <td>{version.note?.trim() || '-'}</td>
                <td>{formatCompactDateTime(version.publishedAt ?? version.createdAt)}</td>
                <td>
                  <button
                    className="product-button product-button-secondary admin-table-button"
                    disabled={controlsDisabled}
                    onClick={() => handleRollback(version.id)}
                    type="button"
                  >
                    {rollbackingId === version.id ? 'Rolling back' : 'Rollback'}
                  </button>
                </td>
              </tr>
            )) : null}
            {isResolved && !resource.error && !resource.versions.length ? <EmptyRow colSpan={5} message="No versions yet." /> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatVersionAction(value: string) {
  if (value === 'rollback') return 'Rollback'
  if (value === 'publish') return 'Publish'
  return value
}

function optionalNote(value: string) {
  const trimmed = value.trim()
  return trimmed || undefined
}

function versionLabel(version?: AdminAiControlPlaneVersionRecord) {
  return version ? `v${version.versionNumber}` : 'version'
}
