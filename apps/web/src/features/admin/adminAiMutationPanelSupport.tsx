'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import {
  loadAdminAiVersions,
  type AdminAiControlPlaneVersionRecord,
} from './adminAiClient'
import { selectStyle } from './adminAiShared'

const textAreaStyle = {
  ...selectStyle,
  minHeight: 108,
  padding: '12px',
}

export function EditorHeading({ title }: { title: string }) {
  return (
    <div className="management-panel-heading">
      <div>
        <h2>{title}</h2>
      </div>
    </div>
  )
}

export function EditorFormShell({ children, message }: { children: ReactNode; message: null | string }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {message ? <p>{message}</p> : null}
      {children}
    </div>
  )
}

export function EditorInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} style={selectStyle} type="text" value={value} />
    </label>
  )
}

export function EditorTextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <textarea onChange={(event) => onChange(event.target.value)} style={textAreaStyle} value={value} />
    </label>
  )
}

export function EditorSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export function EditorCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>
}

export function VersionActions({
  onSaved,
  publishVersion,
  resourceId,
  resourceType,
  rollbackVersion,
}: {
  onSaved: (message: string) => void
  publishVersion: () => Promise<{ error?: string; ok: boolean; version?: AdminAiControlPlaneVersionRecord }>
  resourceId: string
  resourceType: string
  rollbackVersion: (versionId: string) => Promise<{ error?: string; ok: boolean; version?: AdminAiControlPlaneVersionRecord }>
}) {
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [versions, setVersions] = useState<AdminAiControlPlaneVersionRecord[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        if (cancelled) return
        setHistoryStatus('loading')
        const payload = await loadAdminAiVersions({ limit: 5, resourceId, resourceType })
        if (cancelled) return
        setVersions(payload.versions)
        setHistoryStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setMessage(error instanceof Error ? error.message : 'Version history unavailable.')
        setHistoryStatus('idle')
      })
    return () => {
      cancelled = true
    }
  }, [resourceId, resourceType])

  async function handlePublish() {
    try {
      const payload = await publishVersion()
      const nextMessage = payload.version ? `Published version ${payload.version.versionNumber}.` : 'Published current version.'
      setMessage(nextMessage)
      onSaved(nextMessage)
      const reloaded = await loadAdminAiVersions({ limit: 5, resourceId, resourceType })
      setVersions(reloaded.versions)
      setHistoryStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publish failed.')
    }
  }

  async function handleRollback(versionId: string) {
    try {
      const payload = await rollbackVersion(versionId)
      const nextMessage = payload.version ? `Rolled back to version ${payload.version.versionNumber}.` : 'Rollback completed.'
      setMessage(nextMessage)
      onSaved(nextMessage)
      const reloaded = await loadAdminAiVersions({ limit: 5, resourceId, resourceType })
      setVersions(reloaded.versions)
      setHistoryStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rollback failed.')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <strong style={{ fontSize: 13 }}>Version history</strong>
        <button className="product-button product-button-secondary" onClick={handlePublish} type="button">Publish current</button>
      </div>
      {message ? <p>{message}</p> : null}
      {historyStatus === 'loading' ? <p>Loading versions…</p> : null}
      {versions.length ? (
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Action</th>
                <th>Published</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td>v{version.versionNumber}</td>
                  <td>{formatVersionAction(version.action)}</td>
                  <td>{version.publishedAt ?? version.createdAt}</td>
                  <td>
                    <button className="product-button product-button-secondary" onClick={() => handleRollback(version.id)} type="button">Rollback</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : historyStatus === 'ready' ? <p>No published versions yet.</p> : null}
    </div>
  )
}

function formatVersionAction(value: string) {
  return value === 'rollback' ? 'Rollback' : 'Publish'
}
