'use client'

import { useMemo } from 'react'
import type { AdminDirectoryUserRecord, AdminDirectoryWorkspaceRecord } from './adminTypes'

type TrendPoint = {
  date: string
  users: number
  workspaces: number
}

export function AdminOverviewTrendChart({
  users,
  workspaces,
}: {
  users: AdminDirectoryUserRecord[]
  workspaces: AdminDirectoryWorkspaceRecord[]
}) {
  const points = useMemo(() => buildTrendPoints(users, workspaces), [users, workspaces])
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.users, point.workspaces]))
  const userPath = linePath(points.map((point) => point.users), maxValue)
  const workspacePath = linePath(points.map((point) => point.workspaces), maxValue)
  const firstLabel = formatTick(points[0]?.date)
  const middleLabel = formatTick(points[Math.floor(points.length / 2)]?.date)
  const lastLabel = formatTick(points[points.length - 1]?.date)

  return (
    <article className="management-panel management-panel-wide admin-overview-trend">
      <div className="management-panel-heading">
        <div><h2>Activity trend</h2></div>
        <div className="admin-trend-legend" aria-label="Trend legend">
          <span><i className="is-users" />Users</span>
          <span><i className="is-workspaces" />Workspaces</span>
        </div>
      </div>
      <div className="admin-trend-chart" aria-label="14 day activity trend">
        <svg role="img" viewBox="0 0 640 220">
          <path className="admin-trend-grid" d="M36 32H616M36 92H616M36 152H616" />
          <path className="admin-trend-axis" d="M36 28V176H616" />
          <path className="admin-trend-line is-users" d={userPath} />
          <path className="admin-trend-line is-workspaces" d={workspacePath} />
          <text className="admin-trend-y" x="4" y="36">{maxValue}</text>
          <text className="admin-trend-y" x="4" y="176">0</text>
          <text className="admin-trend-x" x="36" y="206">{firstLabel}</text>
          <text className="admin-trend-x" x="310" y="206">{middleLabel}</text>
          <text className="admin-trend-x" textAnchor="end" x="616" y="206">{lastLabel}</text>
        </svg>
      </div>
    </article>
  )
}

function buildTrendPoints(users: AdminDirectoryUserRecord[], workspaces: AdminDirectoryWorkspaceRecord[]): TrendPoint[] {
  const days = lastDays(14)
  return days.map((date) => ({
    date,
    users: countByDate(users, date),
    workspaces: countByDate(workspaces, date),
  }))
}

function countByDate(records: Array<{ createdAt: string }>, date: string) {
  return records.filter((record) => normalizeDate(record.createdAt) === date).length
}

function lastDays(count: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (count - 1 - index))
    return normalizeDate(date.toISOString())
  })
}

function linePath(values: number[], maxValue: number) {
  const left = 36
  const top = 28
  const width = 580
  const height = 148
  if (!values.length) return ''
  return values.map((value, index) => {
    const x = left + (values.length === 1 ? 0 : (index / (values.length - 1)) * width)
    const y = top + height - (Math.max(0, value) / maxValue) * height
    return `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`
  }).join(' ')
}

function normalizeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function formatTick(value?: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date)
}

function round(value: number) {
  return Math.round(value * 10) / 10
}
