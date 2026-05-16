'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { WorkspaceKind } from '@/features/billing/billingTypes'
import { formatCredits } from '@/features/billing/billingPresentation'
import { WorkspaceDirectoryActions } from './WorkspaceDirectoryActions'
import {
  formatWorkspacePlanName,
  formatWorkspaceMembershipRole,
  type WorkspaceDirectoryItem,
} from '@/features/workspaces/workspacePresentation'

type DirectoryViewMode = 'gallery' | 'list'

type WorkspaceDirectoryViewProps = {
  createLabel: string
  emptyCreatedLabel: string
  emptyJoinedLabel: string
  featuredSummary?: null | {
    currentPeriodEnd?: null | string
    label: string
    meta: string
    planLabel: string
    remainingCredits: number
    title: string
    totalCredits: number
    usedThisCycle: number
  }
  isLoading?: boolean
  joinLabel: string
  kind: Extract<WorkspaceKind, 'group_workspace' | 'team_workspace'>
  items: WorkspaceDirectoryItem[]
  statusMessage?: null | string
  title: string
}

export function WorkspaceDirectoryView({
  createLabel,
  emptyCreatedLabel,
  emptyJoinedLabel,
  featuredSummary = null,
  isLoading = false,
  joinLabel,
  kind,
  items,
  statusMessage = null,
  title,
}: WorkspaceDirectoryViewProps) {
  const [optimisticItems, setOptimisticItems] = useState<WorkspaceDirectoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<DirectoryViewMode>('gallery')
  const directoryItems = useMemo(() => mergeWorkspaceItems(items, optimisticItems), [items, optimisticItems])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return directoryItems
    return directoryItems.filter((item) => (
      item.name.toLowerCase().includes(query)
      || item.membershipRole.includes(query)
    ))
  }, [directoryItems, searchQuery])

  const createdItems = filteredItems.filter((item) => item.relationship === 'created')
  const joinedItems = filteredItems.filter((item) => item.relationship === 'joined')

  return (
    <div className="product-page workspace-directory-page">
      <section className="product-page-header workspace-directory-header">
        <div className="workspace-directory-header-main">
          <h1 className="product-page-title">{title}</h1>
          <WorkspaceDirectoryActions
            createLabel={createLabel}
            joinLabel={joinLabel}
            kind={kind}
            onWorkspaceAdded={appendDirectoryItem}
          />
        </div>
      </section>
      {statusMessage ? <p className="workspace-directory-status" role="status">{statusMessage}</p> : null}

      <section className="workspace-toolbar workspace-directory-toolbar" aria-label={`${title} tools`}>
        <label className="workspace-search-field">
          <span aria-hidden="true" className="workspace-search-glyph" />
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
            value={searchQuery}
          />
        </label>
        <div className="workspace-view-toggle" aria-label="View mode">
          <button className={viewMode === 'gallery' ? 'is-active' : ''} onClick={() => setViewMode('gallery')} type="button">
            Gallery
          </button>
          <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} type="button">
            List
          </button>
        </div>
      </section>

      <div className="workspace-directory-stack">
        {featuredSummary ? <FeaturedSummaryCard summary={featuredSummary} /> : null}
        <DirectorySection
          emptyLabel={emptyCreatedLabel}
          isLoading={isLoading}
          items={createdItems}
          title="Created by me"
          viewMode={viewMode}
        />
        <DirectorySection
          emptyLabel={emptyJoinedLabel}
          isLoading={isLoading}
          items={joinedItems}
          title="Joined"
          viewMode={viewMode}
        />
      </div>
    </div>
  )

  function appendDirectoryItem(item: WorkspaceDirectoryItem) {
    if (item.kind !== kind) return
    const href = item.kind === 'team_workspace' ? `/team/${encodeURIComponent(item.id)}` : `/group/${encodeURIComponent(item.id)}`
    setOptimisticItems((current) => [
      { ...item, href },
      ...current.filter((existing) => existing.id !== item.id),
    ])
  }
}

function DirectorySection({
  emptyLabel,
  isLoading,
  items,
  title,
  viewMode,
}: {
  emptyLabel: string
  isLoading: boolean
  items: WorkspaceDirectoryItem[]
  title: string
  viewMode: DirectoryViewMode
}) {
  return (
    <section className="workspace-directory-section">
      <header className="workspace-directory-section-header">
        <h2>{title}</h2>
      </header>
      {isLoading && items.length === 0 ? (
        <div className="workspace-directory-loading">Refreshing live workspace details…</div>
      ) : items.length === 0 ? (
        <div className="workspace-directory-empty">{emptyLabel}</div>
      ) : (
        <>
          {isLoading ? <div className="workspace-directory-loading">Refreshing live workspace details…</div> : null}
          <div className={viewMode === 'gallery' ? 'workspace-directory-grid' : 'workspace-directory-list'}>
            {items.map((item) => (
              <DirectoryCard
                href={item.href ?? null}
                item={item}
                key={item.id}
                viewMode={viewMode}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function DirectoryCard({
  href,
  item,
  viewMode,
}: {
  href: null | string
  item: WorkspaceDirectoryItem
  viewMode: DirectoryViewMode
}) {
  const className = `workspace-directory-card ${viewMode === 'list' ? 'is-list' : ''}${href ? ' is-link' : ''}`
  const content = (
    <>
      <div className="workspace-directory-card-preview" data-kind={item.kind}>
        <span>{getWorkspaceInitials(item.name)}</span>
      </div>
      <div className="workspace-directory-card-body">
        <div className="workspace-directory-card-top">
          <h3>{item.name}</h3>
          <span className={`workspace-directory-role is-${item.membershipRole}`}>
            {formatWorkspaceMembershipRole(item.membershipRole)}
          </span>
        </div>
        <div className="workspace-directory-card-meta">
          <span>{formatBoardCount(item.boardCount)}</span>
          <span>{formatMemberCount(item.memberCount)}</span>
        </div>
        {item.remainingCredits !== undefined && item.totalCredits !== undefined ? (
          <div className="workspace-directory-card-usage">
            <div className="workspace-directory-card-usage-head">
              <span>{formatWorkspacePlanName(item.planKey)}</span>
              <strong>{formatCredits(item.remainingCredits)} / {formatCredits(item.totalCredits)}</strong>
            </div>
            <div className="workspace-directory-card-progress" aria-hidden="true">
              <span style={{ width: `${percent(item.remainingCredits, item.totalCredits)}%` }} />
            </div>
            <div className="workspace-directory-card-usage-meta">
              <span>{formatUsageWindow(item.usedThisCycle, item.currentPeriodEnd)}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="workspace-directory-card-footer">
        <div className="workspace-directory-members" aria-label="Members preview">
          {item.memberInitials.map((initial, index) => (
            <span key={`${item.id}-${initial}-${index}`}>{initial}</span>
          ))}
        </div>
      </div>
    </>
  )

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    )
  }

  return (
    <article className={className}>
      {content}
    </article>
  )
}

function FeaturedSummaryCard({
  summary,
}: {
  summary: NonNullable<WorkspaceDirectoryViewProps['featuredSummary']>
}) {
  return (
    <section className="workspace-directory-summary-card">
      <div className="workspace-directory-summary-copy">
        <span className="workspace-directory-summary-label">{summary.label}</span>
        <h2>{summary.title}</h2>
        <p>{summary.planLabel}</p>
      </div>
      <div className="workspace-directory-summary-credits">
        <strong>{formatCredits(summary.remainingCredits)}</strong>
        <span>{formatCredits(summary.totalCredits)} total</span>
      </div>
      <div className="workspace-directory-summary-progress" aria-hidden="true">
        <span style={{ width: `${percent(summary.remainingCredits, summary.totalCredits)}%` }} />
      </div>
      <div className="workspace-directory-summary-meta">
        <span>{summary.meta}</span>
        <span>{formatUsageWindow(summary.usedThisCycle, summary.currentPeriodEnd)}</span>
      </div>
    </section>
  )
}

function getWorkspaceInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TW'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function formatBoardCount(value: number) {
  return value === 1 ? '1 board' : `${value} boards`
}

function formatMemberCount(value: number) {
  return value === 1 ? '1 member' : `${value} members`
}

function formatUsageWindow(usedThisCycle?: number, currentPeriodEnd?: null | string) {
  const usage = usedThisCycle && usedThisCycle > 0 ? `${formatCredits(usedThisCycle)} used` : 'Fresh cycle'
  if (!currentPeriodEnd) return usage
  const date = new Date(currentPeriodEnd)
  if (Number.isNaN(date.getTime())) return usage
  return `${usage} · valid until ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}`
}

function percent(value: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function mergeWorkspaceItems(
  baseItems: WorkspaceDirectoryItem[],
  optimisticItems: WorkspaceDirectoryItem[],
) {
  const seen = new Set<string>()
  return [...optimisticItems.filter((item) => !baseItems.some((existing) => existing.id === item.id)), ...baseItems].filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
