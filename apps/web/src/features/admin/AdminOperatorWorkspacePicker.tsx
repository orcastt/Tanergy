'use client'

import { useEffect, useMemo, useState } from 'react'
import { FilterTextInput, selectStyle } from './adminAiShared'
import { loadAdminWorkspaceLookup, readAdminWorkspaceLookup } from './adminWorkspaceLookupCache'
import type { AdminDirectoryWorkspaceRecord } from './adminTypes'

export function AdminOperatorWorkspacePicker({
  excludedWorkspaceIds = [],
  kind,
  onChange,
  value,
}: {
  excludedWorkspaceIds?: string[]
  kind: 'group_workspace' | 'team_workspace'
  onChange: (value: string) => void
  value: string
}) {
  const [search, setSearch] = useState('')
  const query = useMemo(() => ({ kind, limit: 50, search: search.trim() || undefined }), [kind, search])
  const initialResource = readAdminWorkspaceLookup(query)
  const [records, setRecords] = useState<AdminDirectoryWorkspaceRecord[]>(initialResource.data ?? [])
  const [error, setError] = useState<string | null>(initialResource.error ?? null)
  const excluded = useMemo(() => new Set(excludedWorkspaceIds), [excludedWorkspaceIds])

  useEffect(() => {
    let cancelled = false
    loadAdminWorkspaceLookup(query)
      .then((nextRecords) => {
        if (cancelled) return
        setRecords(nextRecords)
        setError(null)
      })
      .catch((nextError) => {
        if (cancelled) return
        setError(nextError instanceof Error ? nextError.message : 'Workspace lookup failed.')
      })
    return () => {
      cancelled = true
    }
  }, [query])

  const visibleRecords = useMemo(
    () => records.filter((record) => !excluded.has(record.id)),
    [excluded, records],
  )
  const selected = visibleRecords.find((record) => record.id === value) ?? null

  useEffect(() => {
    if (value && visibleRecords.some((record) => record.id === value)) return
    if (!visibleRecords.length) {
      if (value) onChange('')
      return
    }
    onChange(visibleRecords[0].id)
  }, [onChange, value, visibleRecords])

  return (
    <>
      <FilterTextInput
        label="Search workspace"
        leadingIcon="search"
        onChange={setSearch}
        placeholder={kind === 'team_workspace' ? 'team name, owner, workspace_id' : 'group name, owner, workspace_id'}
        value={search}
      />
      <label style={{ display: 'grid', gap: 6 }}>
        <span className="management-field-label">Workspace</span>
        <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
          {!visibleRecords.length ? <option value="">No workspace</option> : null}
          {visibleRecords.map((record) => (
            <option key={record.id} value={record.id}>
              {record.name} · {record.ownerEmail || record.ownerDisplayName || record.id}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <div className="admin-modal-plan-summary-card admin-modal-grid-span">
          <div className="admin-modal-plan-summary-main">
            <strong>{selected.name}</strong>
            <small className="is-active">{selected.ownerEmail || selected.ownerDisplayName || selected.ownerId || '-'}</small>
          </div>
          <div className="management-badge-row">
            <span className="management-badge">{selected.planKey || kind}</span>
            <span className="management-badge">{selected.memberCount} members</span>
            <span className="management-badge">{selected.boardCount} boards</span>
          </div>
        </div>
      ) : null}
      {error ? <span className="management-inline-note">{error}</span> : null}
      {!error && !visibleRecords.length ? <span className="management-inline-note">No workspace</span> : null}
    </>
  )
}
