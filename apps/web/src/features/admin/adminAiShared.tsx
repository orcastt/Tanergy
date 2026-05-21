'use client'

import type { ReactNode } from 'react'

export const limitOptions = [25, 50, 100] as const
export const selectStyle = {
  width: '100%',
  minHeight: 40,
  border: '1px solid var(--color-hairline)',
  borderRadius: '12px',
  padding: '0 12px',
  background: 'var(--color-canvas)',
}

export type BooleanFilter = 'all' | 'disabled' | 'enabled'

export function AiCallout({ label, value }: { body?: string; label: string; value: string }) {
  return <article className="management-callout"><span>{label}</span><h2>{value}</h2></article>
}

export function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }> | string[]
  value: string
}) {
  const resolvedOptions = Array.isArray(options) && typeof options[0] === 'string'
    ? (options as string[]).map((option) => ({ label: option, value: option }))
    : (options as Array<{ label: string; value: string }>)

  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} style={selectStyle} value={value}>
        <option value="">All</option>
        {resolvedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export function FilterTextInput({
  leadingIcon,
  label,
  onChange,
  placeholder,
  value,
}: {
  leadingIcon?: 'search'
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  const inputStyle = leadingIcon
    ? { ...selectStyle, paddingLeft: 40 }
    : selectStyle

  return (
    <label className="admin-filter-shell">
      <span className="management-field-label">{label}</span>
      <span className="admin-filter-input-wrap">
        {leadingIcon === 'search' ? <SearchIcon /> : null}
        <input
          className={leadingIcon ? 'has-leading-icon' : undefined}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          style={inputStyle}
          type="text"
          value={value}
        />
      </span>
    </label>
  )
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return <tr><td colSpan={colSpan}>{message}</td></tr>
}

export function MetaLine({ children }: { children: ReactNode }) {
  if (!children) return null
  return <small style={{ display: 'block', marginTop: 2, color: 'var(--color-muted)' }}>{children}</small>
}

export function filterGridStyle(columns: number) {
  return {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    marginBottom: 20,
  }
}

export function resolveBooleanFilter(value: BooleanFilter) {
  if (value === 'enabled') return true
  if (value === 'disabled') return false
  return undefined
}

export function uniqueValues(values: Array<null | string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right))
}

export function truncate(value?: null | string) {
  if (!value) return 'No prompt preview'
  return value.length > 48 ? `${value.slice(0, 45)}...` : value
}

export function schemaPreview(value: Record<string, unknown>) {
  const text = JSON.stringify(value)
  return text.length > 56 ? `${text.slice(0, 53)}...` : text
}

export function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatCompactDateTime(value?: null | string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

export function formatCompactDate(value?: null | string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toLocaleString('en-US') : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function truncateMiddle(value?: null | string, start = 14, end = 8) {
  if (!value) return '-'
  const normalized = value.trim()
  if (normalized.length <= start + end + 1) return normalized
  return `${normalized.slice(0, start)}...${normalized.slice(-end)}`
}

export function buildStableListKey(parts: Array<null | number | string | undefined>, index: number) {
  const base = parts
    .map((part) => (typeof part === 'number' ? String(part) : part?.trim()))
    .filter(Boolean)
    .join(':')
  return base ? `${base}:${index}` : `row:${index}`
}

function SearchIcon() {
  return (
    <span aria-hidden="true" className="admin-filter-input-icon">
      <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    </span>
  )
}
